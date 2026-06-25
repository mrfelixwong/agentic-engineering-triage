# Answer Key — Module 4 (Tools & Skills)

Ground truth for the skills slice. **Spoilers.** Don't read this until you've built your own skill — it shows a
finished one.

## The exercise (build-forward)

You keep running the same multi-step check by hand after any change to the classifier: run the tests, run the
eval, compare to the baseline. Capture it as a reusable skill. You are *constructing* a tool you keep.

## The recurring workflow (what to capture)

```bash
.venv/bin/pytest -q
.venv/bin/python -m eval.run     # exits non-zero below the 0.80 baseline
```

## A Good skill vs a Great skill

A **Good** skill saves typing — it just runs the two commands. A **Great** skill encodes the judgment: it runs
both, reports the eval score against the baseline, and refuses to bless a change on a regression. For example,
`.claude/skills/check-change/SKILL.md`:

```markdown
---
name: check-change
description: After any change to Triage, verify it — run the tests and the eval, and fail if the eval drops below the 0.80 baseline.
user_invocable: true
---

Run, in order, and report the result of each:

1. `.venv/bin/pytest -q` — every test must pass. If any fails, stop and show the failure.
2. `.venv/bin/python -m eval.run` — report the score and whether it holds the 0.80 baseline.

Conclude "ready to commit" only if the tests pass AND the eval holds. Otherwise, say exactly what regressed.
```

## Verify (build-forward grading)

You did it right if invoking your skill runs both checks end to end and **refuses to bless a change** when a
test fails or the eval drops — without you running the commands by hand. Break the classifier on purpose and
run your skill: it should stop you.

The test for whether a workflow earns a skill: you have done it by hand more than twice, and it is the same
sequence every time.
