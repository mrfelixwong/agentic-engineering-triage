# Answer Key — Module 2 (Specification)

Ground truth for the spec slice. **Spoilers.** Don't read this until you've written your own spec and built the
feature — it shows a finished spec and one valid implementation.

## The exercise (build-forward)

The request is deliberately vague: *"add a confidence score to the classification output."* Turn it into a spec
— acceptance criteria, steps, constraints — then drive the agent to build it. You are *constructing* a new
feature and proving it works, not fixing a planted bug.

## A Great spec

```text
Goal: add a `confidence` field (float, 0.0–1.0) to the classifier output.

Acceptance criteria:
  - every Classification includes `confidence`, with 0.0 <= confidence <= 1.0
  - a clearly on-topic ticket (a billing keyword) scores higher than one that
    falls through to `general`
  - existing tests still pass; the eval holds its 0.80 baseline

Steps:
  1. add `confidence: float` to `Classification` (app/models.py), constrained 0–1
  2. compute it in the offline stub (app/llm/client.py): return (category, confidence)
  3. thread it through `classify_ticket` (app/triage/classify.py)

Constraints:
  - don't change the routing / `_ALIASES` logic
  - keep it deterministic offline (no API key needed)

Show me the plan before editing anything.
```

## One valid implementation

`app/models.py` — add to `Classification`:

```python
confidence: float = Field(1.0, ge=0.0, le=1.0, description="0–1 confidence in the label.")
```

`app/llm/client.py` — have the stub return a confidence alongside the category, then thread it through so it
reaches the `Classification`:

```python
def classify_via_stub(subject: str, body: str) -> tuple[str, float]:
    text = f"{subject}\n{body}".lower()
    for category, keywords in _STUB_RULES:
        if any(k in text for k in keywords):
            return category, 0.9     # a keyword matched -> high confidence
    return "general", 0.3            # fell through -> low confidence
```

(The LLM path can default to a fixed confidence, e.g. `1.0`, until you ask the model for one.)

## Verify (build-forward grading)

After building, copy this into `tests/` and run `pytest` — it should pass:

```python
from app.models import Ticket
from app.triage.classify import classify_ticket

def test_confidence_is_in_range_and_informative():
    strong = classify_ticket(Ticket(id="T-1", subject="Refund", body="I was charged twice"))
    weak   = classify_ticket(Ticket(id="T-2", subject="Hi", body="just saying hello"))
    assert 0.0 <= strong.confidence <= 1.0
    assert 0.0 <= weak.confidence <= 1.0
    assert strong.confidence > weak.confidence   # a clear billing ticket beats an ambiguous one
```

You did it right if that test passes, every `Classification` carries a confidence in range, and the existing
tests and the eval still hold. The spec is the real artifact here: a vague request became something the agent
could build and you could check.
