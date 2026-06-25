# Answer Key — Module 3 (Verification)

Ground truth for the verification slice. **Spoilers.** Don't read this before
you've tried the exercise — it tells you exactly what's wrong and how to fix it.

## The seeded bug

**Symptom.** Billing tickets are classified as `general` instead of `billing`.
The classifier's underlying judgment is correct — the offline stub and the LLM
both produce the raw label `"billing"` — but a routing step rewrites it.

**Root cause.** `app/triage/classify.py`, the `_ALIASES` map. One entry is wrong:

```python
"billing": Category.GENERAL,  # legacy: route billing through the general queue
```

`_normalize()` folds every raw label through `_ALIASES` before returning it, so
a correct `"billing"` verdict is silently downgraded to `Category.GENERAL`. The
comment frames it as an intentional legacy rule, which is exactly how this kind
of bug survives review.

## The fix

Map `"billing"` to its own category:

```python
"billing": Category.BILLING,
```

That single-line change is the whole fix. Nothing else needs to move.

## How it's verified

| Check | Before the fix | After the fix |
|---|---|---|
| `pytest -q` | `test_billing_ticket_is_labeled_billing` FAILS (2 params), rest green | all green |
| `python -m eval.run` | `7/10 = 0.70`, below baseline `0.80`, **exit 1** | `10/10 = 1.00`, **exit 0** |

The eval misses are exactly the three billing cases (`E-01`, `E-02`, `E-03`),
which is the tell: a whole category is wrong, not scattered edge cases. That
pattern — one category systematically misrouted — points straight at a routing
rule rather than a prompt or a model miss.

## Why it's shaped this way (for instructors)

- The **stub** returns the right raw label, so the failure is reproducible with
  no API key and is unambiguously a code bug, not model nondeterminism.
- The bug lives in **normalization**, not in the prompt — so the lesson is
  "verify behavior, then read the seam the behavior flows through," not "tweak
  the prompt until it looks right."
- The **red test** encodes the desired behavior up front (tests-as-spec); the
  **eval** turns the same behavior into a number with a committed floor
  (eval-driven). The two together are the verification loop the lesson teaches.
