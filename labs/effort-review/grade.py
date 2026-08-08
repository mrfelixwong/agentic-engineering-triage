from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


@dataclass(frozen=True)
class Mutant:
    id: str
    impact: str
    file: str
    replacements: tuple[tuple[str, str], ...]


MUTANTS = (
    Mutant(
        "ROLLOUT-RESTART",
        "customers can move in or out of a rollout after a service restart",
        "app/triage/operations.py",
        ((
            '    payload = f"{rollout_key}\\0{customer_id}".encode("utf-8")\n'
            "    digest = hashlib.sha256(payload).digest()\n"
            '    return int.from_bytes(digest[:8], "big") % 100',
            '    return hash(f"{rollout_key}\\0{customer_id}") % 100',
        ),),
    ),
    Mutant(
        "ROLLOUT-KEY",
        "two independent rollouts can assign every customer to the same bucket",
        "app/triage/operations.py",
        ((
            '    payload = f"{rollout_key}\\0{customer_id}".encode("utf-8")',
            '    payload = customer_id.encode("utf-8")',
        ),),
    ),
    Mutant(
        "CACHE-TENANT",
        "one tenant can receive another tenant's routing decision",
        "app/triage/operations.py",
        (
            ("self._values[(tenant_id, ticket_id)] = queue", "self._values[ticket_id] = queue"),
            ("return self._values.get((tenant_id, ticket_id))", "return self._values.get(ticket_id)"),
            ("self._values.pop((tenant_id, ticket_id), None)", "self._values.pop(ticket_id, None)"),
        ),
    ),
    Mutant(
        "CACHE-INVALIDATE",
        "invalidating one tenant's ticket removes cached routing for every tenant",
        "app/triage/operations.py",
        ((
            "self._values.pop((tenant_id, ticket_id), None)",
            "self._values.clear()",
        ),),
    ),
    Mutant(
        "PAGE-TIE",
        "tickets sharing a timestamp can be skipped between pages",
        "app/triage/operations.py",
        ((
            "return row.created_at, row.ticket_id",
            'return row.created_at, ""',
        ),),
    ),
    Mutant(
        "PAGE-BOUNDARY",
        "the last ticket on one page can appear again on the next page",
        "app/triage/operations.py",
        ((
            "if _row_key(row) > cursor_key",
            "if _row_key(row) >= cursor_key",
        ),),
    ),
    Mutant(
        "PROVIDER-ALIAS",
        "legacy payment labels send billing customers to the general queue",
        "app/triage/classify.py",
        ((
            '    "payments": Category.BILLING,\n',
            "",
        ),),
    ),
    Mutant(
        "PROVIDER-FORMAT",
        "uppercase or space-padded provider labels route to the wrong queue",
        "app/triage/classify.py",
        ((
            "    key = raw.strip().lower()",
            "    key = raw",
        ),),
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Measure how many release regressions the tests block.")
    parser.add_argument("repository")
    parser.add_argument("--json", action="store_true", help="Print machine-readable results only")
    return parser.parse_args()


def run_tests(target: Path, venv: Path) -> tuple[int, str]:
    env = {**os.environ, "PYTHONPATH": str(target)}
    result = subprocess.run(
        [str(venv / "bin" / "pytest"), "-q"],
        cwd=target,
        env=env,
        text=True,
        capture_output=True,
        timeout=120,
    )
    return result.returncode, f"{result.stdout}{result.stderr}"


def changed_paths(target: Path) -> list[str]:
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=target,
        text=True,
        capture_output=True,
        check=True,
    )
    paths = []
    for line in result.stdout.splitlines():
        if not line:
            continue
        paths.append(line[3:].split(" -> ")[-1])
    return paths


def copy_repository(source: Path, destination: Path) -> None:
    shutil.copytree(
        source,
        destination,
        ignore=shutil.ignore_patterns(
            ".git", ".venv", ".pytest_cache", "__pycache__", "*.pyc", ".venv-*", ".venv_*"
        ),
    )


def apply_mutant(target: Path, mutant: Mutant) -> None:
    file = target / mutant.file
    text = file.read_text()
    for before, after in mutant.replacements:
        if before not in text:
            raise RuntimeError(f"{mutant.id}: expected source text missing in {mutant.file}")
        text = text.replace(before, after, 1)
    file.write_text(text)


def main() -> int:
    args = parse_args()
    target = Path(args.repository).expanduser().resolve()
    venv = Path(os.environ.get("TRIAGE_LAB_VENV", REPO / ".venv")).resolve()
    if not (venv / "bin" / "pytest").exists():
        print(json.dumps({"error": f"missing test environment: {venv}"}) if args.json else f"missing {venv}")
        return 2

    paths = changed_paths(target)
    invalid_paths = [path for path in paths if not path.startswith("tests/")]
    baseline_exit, baseline_output = run_tests(target, venv)

    mutant_results = []
    if baseline_exit == 0 and not invalid_paths:
        with tempfile.TemporaryDirectory(prefix="triage-effort-mutants-") as temp:
            temp_root = Path(temp)
            for mutant in MUTANTS:
                mutant_repo = temp_root / mutant.id.lower()
                copy_repository(target, mutant_repo)
                apply_mutant(mutant_repo, mutant)
                exit_code, output = run_tests(mutant_repo, venv)
                mutant_results.append({
                    "id": mutant.id,
                    "impact": mutant.impact,
                    "killed": exit_code != 0,
                    "pytestExit": exit_code,
                    "output": output,
                })

    killed = [result["id"] for result in mutant_results if result["killed"]]
    survived = [result["id"] for result in mutant_results if not result["killed"]]
    valid = baseline_exit == 0 and not invalid_paths
    score = round(100 * len(killed) / len(MUTANTS), 1) if valid else 0.0
    result = {
        "valid": valid,
        "baselinePass": baseline_exit == 0,
        "baselineOutput": baseline_output,
        "changedPaths": paths,
        "invalidPaths": invalid_paths,
        "killed": killed,
        "survived": survived,
        "killedCount": len(killed),
        "totalMutants": len(MUTANTS),
        "qualityScore": score,
        "mutants": mutant_results,
    }

    if args.json:
        print(json.dumps(result))
    else:
        print("RELEASE-SAFETY-MUTATION-GRADER")
        print(f"Correct implementation: {'PASS' if baseline_exit == 0 else 'FAIL'}")
        if invalid_paths:
            print(f"INVALID: only tests/ may change; found {', '.join(invalid_paths)}")
        for mutant_result in mutant_results:
            state = "CAUGHT" if mutant_result["killed"] else "MISSED"
            print(f"{state}: {mutant_result['id']} - {mutant_result['impact']}")
        print(f"QUALITY: {len(killed)}/{len(MUTANTS)} production regressions caught = {score:.1f}/100")
        if survived:
            print(f"MISSED IMPACTS: {len(survived)} plausible regressions would pass the submitted tests")

    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
