from __future__ import annotations

import argparse
import hashlib
import json
import os
import shlex
import shutil
import subprocess
import tempfile
from pathlib import Path


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
FIXTURE = HERE / "fixture"
CANDIDATE = FIXTURE / "candidate"
FIXTURE_VERSION = 2


def run(command: list[str], cwd: Path) -> None:
    subprocess.run(command, cwd=cwd, check=True)


def fixture_hash() -> str:
    digest = hashlib.sha256()
    for file in sorted(path for path in FIXTURE.rglob("*") if path.is_file()):
        digest.update(file.relative_to(FIXTURE).as_posix().encode())
        digest.update(b"\0")
        digest.update(file.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def commit(target: Path, message: str) -> None:
    run(["git", "add", "-A"], target)
    run(["git", "commit", "-qm", message], target)


def write_venv_wrappers(target: Path, venv: Path) -> None:
    bin_dir = target / ".venv" / "bin"
    bin_dir.mkdir(parents=True)
    root_expr = 'ROOT="$(cd "$(dirname "$0")/../.." && pwd)"'
    for name in ("python", "pytest"):
        executable = shlex.quote(str(venv / "bin" / name))
        wrapper = f'#!/bin/sh\n{root_expr}\nPYTHONPATH="$ROOT" exec {executable} "$@"\n'
        path = bin_dir / name
        path.write_text(wrapper)
        path.chmod(0o755)


def prepare_repository(target: Path, venv: Path) -> None:
    shutil.copytree(
        FIXTURE,
        target,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns("candidate", "__pycache__", "*.pyc"),
    )
    metadata = {
        "fixtureVersion": FIXTURE_VERSION,
        "fixtureSha256": fixture_hash(),
    }
    (target / "packet" / "lab-fixture.json").write_text(
        json.dumps(metadata, indent=2) + "\n"
    )

    run(["git", "init", "-q", "-b", "main"], target)
    run(["git", "config", "user.name", "Effort Lab"], target)
    run(["git", "config", "user.email", "effort-lab@example.com"], target)
    commit(target, "Add ticket classification service")

    shutil.copytree(CANDIDATE, target, dirs_exist_ok=True)
    commit(target, "Add release routing operations")
    write_venv_wrappers(target, venv)


def validated_target(value: str | None) -> Path:
    if value is None:
        return Path(tempfile.mkdtemp(prefix="triage-effort-quality-"))

    target = Path(value).expanduser().resolve()
    temp_root = Path(tempfile.gettempdir()).resolve()
    try:
        target.relative_to(temp_root)
    except ValueError as exc:
        raise ValueError(f"target must be inside the system temp directory: {temp_root}") from exc
    if not target.name.startswith("triage-effort-quality-"):
        raise ValueError("target name must start with triage-effort-quality-")
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    return target


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare a fresh effort-quality test-design repository."
    )
    parser.add_argument("--target", help="Optional path inside the system temp directory")
    parser.add_argument(
        "--path-only",
        action="store_true",
        help="Print only the prepared repository path",
    )
    parser.add_argument(
        "--fixture-hash",
        action="store_true",
        help="Print the frozen fixture SHA-256 and exit",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.fixture_hash:
        print(fixture_hash())
        return 0

    venv = Path(os.environ.get("TRIAGE_LAB_VENV", REPO / ".venv")).resolve()
    if not (venv / "bin" / "pytest").exists():
        print(f"missing {venv}; run ./setup.sh from the Triage repository first")
        return 2

    try:
        target = validated_target(args.target)
    except ValueError as exc:
        print(exc)
        return 2

    prepare_repository(target, venv)
    if args.path_only:
        print(target)
    else:
        print(f"prepared effort-quality lab: {target}")
        print("latest commit: Add release routing operations")
        print("run next: .venv/bin/pytest -q")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
