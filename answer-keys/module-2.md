# Answer Key - Module 2 (Specification)

Ground truth for the specification lab. **Spoilers.** Write and review your own
spec before reading this file.

## The vague request

```text
Add a confidence score from 0 to 1. Plan first.
```

This leaves Claude to choose the meaning of confidence, the values, the files,
the tests, and whether unrelated billing work is in scope.

## A complete specification

```text
GOAL
Classification returns a confidence value that tells the caller whether the category came from a matched rule or from the fallback.

CONTEXT
Read app/models.py, app/triage/classify.py, and tests/test_classify.py.

ACCEPTANCE
A keyword-rule match scores 0.9.
The general fallback scores 0.3.
The value is never outside 0.0-1.0.
One test covers a keyword match.
One test covers the fallback.

CONSTRAINTS / NON-GOALS
Only edit the files named above.
Do not change eval/.
Do not fix the billing bug.

VERIFICATION
Run .venv/bin/pytest -q and paste the output.

PLAN FIRST
Show the plan and files before editing.
```

The student now owns all 7 important fields: goal, context, acceptance,
constraints, non-goals, verification, and plan-first.

## One valid implementation

In `app/models.py`, add a bounded field to `Classification`:

```python
confidence: float = Field(
    0.3, ge=0.0, le=1.0, description="0.0-1.0 confidence in the label."
)
```

In `app/triage/classify.py`, return both the normalized category and confidence:

```python
_MATCH_CONFIDENCE = 0.9
_FALLBACK_CONFIDENCE = 0.3


def _normalize(raw: str) -> tuple[Category, float]:
    key = raw.strip().lower()
    if key == "general":
        return Category.GENERAL, _FALLBACK_CONFIDENCE
    if key in _ALIASES:
        return _ALIASES[key], _MATCH_CONFIDENCE
    try:
        return Category(key), _MATCH_CONFIDENCE
    except ValueError:
        return Category.GENERAL, _FALLBACK_CONFIDENCE
```

Pass both values into `Classification`, then add one keyword-match test and one
fallback test in `tests/test_classify.py`.

## Expected verification

```text
pytest: 2 failed, 9 passed
eval:   7/10 correct = 0.70, FAIL
```

The two new confidence tests pass. The existing billing cases stay red because
the spec explicitly says not to fix billing. That is expected, not a failed
confidence implementation.

The build should change only:

- `app/models.py`
- `app/triage/classify.py`
- `tests/test_classify.py`

If the plan edits `app/llm/client.py`, `eval/`, or the billing alias, cut those
steps before code.
