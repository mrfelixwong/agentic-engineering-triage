"""Offline eval for the Triage classifier.

Run it:  python -m eval.run

Scores the classifier on a held-out set (`eval/cases.jsonl`) and exits non-zero
if accuracy falls below the committed baseline. This is the gate a prompt or
routing change has to clear — it turns "looks right" into a number.

It runs the OFFLINE stub backend by default, so it needs no API key and no
network. Set TRIAGE_USE_LLM=1 (with ANTHROPIC_API_KEY) to score the real model.

Committed baseline: 0.80. With the seeded billing bug present the score is
0.70 and this exits 1; once the bug is fixed it reaches 1.00 and exits 0.
"""

from __future__ import annotations

import json
import pathlib
import sys

from app.models import Ticket
from app.triage.classify import classify_ticket

BASELINE = 0.80
CASES_PATH = pathlib.Path(__file__).with_name("cases.jsonl")


def load_cases() -> list[dict[str, str]]:
    with CASES_PATH.open() as f:
        return [json.loads(line) for line in f if line.strip()]


def main() -> int:
    cases = load_cases()
    correct = 0
    misses: list[str] = []

    for case in cases:
        ticket = Ticket(id=case["id"], subject=case["subject"], body=case["body"])
        got = classify_ticket(ticket).category.value
        expected = case["expected"]
        if got == expected:
            correct += 1
        else:
            misses.append(f"  {case['id']}: expected {expected!r}, got {got!r}")

    total = len(cases)
    score = correct / total if total else 0.0

    print(f"Triage eval: {correct}/{total} correct = {score:.2f} (baseline {BASELINE:.2f})")
    if misses:
        print("Misses:")
        print("\n".join(misses))

    if score < BASELINE:
        print(f"FAIL: {score:.2f} is below the baseline {BASELINE:.2f}.")
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
