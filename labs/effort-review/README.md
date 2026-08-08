# Effort Quality Lab: How Many Production Bugs Would Your Tests Block?

This lab teaches when additional model effort improves work quality. Students
strengthen tests for a correct release candidate. A deterministic mutation
grader then measures how many plausible broken implementations those tests
would reject.

The student impact is concrete: every surviving mutant is a production problem
that the submitted tests would allow to ship.

## Why this replaced the binary review

Two earlier candidates reached a ceiling:

- A one-bug implementation task was solved at every tested effort.
- A balanced `MERGE` or `REJECT` review produced 6/6 correct decisions at both
  low and max effort.

The new lab scores eight independent regression risks, so deeper work has room
to improve quality. See `CANDIDATES.md` for the selection record.

## Student setup

This lab supports macOS and Linux. From the Triage repository root, run
`./setup.sh` once, then prepare a fresh temporary repository:

```sh
LAB_ROOT="$PWD"
LAB_DIR=$("$LAB_ROOT/.venv/bin/python" \
  "$LAB_ROOT/labs/effort-review/prepare.py" --path-only)
cd "$LAB_DIR"
.venv/bin/pytest -q
.venv/bin/python -m eval.run
```

The correct release candidate should pass both visible checks.

## Student task

The instructor assigns one effort level:

```sh
EFFORT=low
claude --model claude-sonnet-5 --effort "$EFFORT"
```

Send exactly this prompt:

```text
Strengthen the release-safety tests for the latest commit.

Read the changed code, its callers, and the repository contracts. Add focused
regression tests for consequential production failures that the current tests
do not cover. Do not stop after the first gap.

Only change files under tests/. Do not edit application code, contracts, test
configuration, or evaluation data. The tests must pass the correct
implementation and fail plausible broken implementations.

Run the repository tests and evaluation. Return the risks covered, files
changed, and exact command outputs.
```

Exit Claude, then reveal the mutation score:

```sh
"$LAB_ROOT/.venv/bin/python" \
  "$LAB_ROOT/labs/effort-review/grade.py" "$LAB_DIR"
```

`CAUGHT` means the tests rejected that broken implementation. `MISSED` means
the broken behavior still passed. The grader first runs the tests against the
correct code; tests that fail the correct implementation receive no score.

## Instructor benchmark

Pilot low and max before freezing a final benchmark:

```sh
TRIAGE_LAB_VENV="$PWD/.venv" node labs/effort-review/benchmark.mjs \
  --stage pilot --efforts low,max --repetitions 3 --concurrency 4
```

The candidate advances only if max averages at least 15 points above low and
does not reduce the valid-run rate. The frozen final uses ten fresh runs at
each effort:

```sh
TRIAGE_LAB_VENV="$PWD/.venv" node labs/effort-review/benchmark.mjs \
  --stage final --efforts low,medium,high,max --repetitions 10 --concurrency 4
```

The final quality claim requires max to beat low by at least 20 points on
average and in at least seven of ten matched repetitions. Full captures and
the generated report live beside this README.

## Captured result

The frozen 40-run benchmark passed:

| Effort | Mean quality | Mean regressions blocked | Mean time | Mean cost |
|---|---:|---:|---:|---:|
| Low | 61.25/100 | 4.9/8 | 55.5s | $0.258 |
| Medium | 68.75/100 | 5.5/8 | 81.8s | $0.355 |
| High | 68.75/100 | 5.5/8 | 129.7s | $0.507 |
| Max | 96.25/100 | 7.7/8 | 461.7s | $1.643 |

Max beat low in all 10 matched repetitions. All 40 submissions passed the
correct implementation and stayed inside `tests/`. Total model cost was
$27.62. Open `RESULTS.html` for the actual Claude answers, exact grader
results, every run, and the evidence boundary.
