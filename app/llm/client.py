"""LLM provider wrapper.

One job: turn a rendered prompt into a category string. It has two backends:

- A real Claude call (the `anthropic` SDK), used when `TRIAGE_USE_LLM=1` and an
  API key is present.
- A deterministic OFFLINE stub (keyword rules), used otherwise — so tests and
  the eval run with no network and no key. The stub is intentionally simple;
  it stands in for the model's judgment, not for the model.

Both return a bare category string; mapping to the `Category` enum and the
seeded routing logic live in `app/triage/classify.py`.

Default model id is Claude Opus 4.8 (`claude-opus-4-8`). Thinking is adaptive.
Tool/JSON output is parsed with `json.loads`, never raw string-matched.
"""

from __future__ import annotations

import json
import os

DEFAULT_MODEL = "claude-opus-4-8"

# Keyword rules for the offline stub. First matching category wins, in this
# order. This is the deterministic backend the tests and eval rely on.
_STUB_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("billing", ("invoice", "charge", "charged", "refund", "payment", "billed",
                 "billing", "overcharg", "subscription", "price", "pricing", "credit card")),
    ("account", ("login", "log in", "password", "sign in", "access", "locked out",
                 "2fa", "permission", "reset my")),
    ("bug", ("error", "crash", "broken", "doesn't work", "does not work", "bug",
             "exception", "500", "stack trace", "fails")),
    ("feature_request", ("feature request", "would be nice", "can you add",
                         "please add", "wish", "support for", "ability to")),
]


def classify_via_stub(subject: str, body: str) -> str:
    """Deterministic offline classifier. Returns a bare category string."""
    text = f"{subject}\n{body}".lower()
    for category, keywords in _STUB_RULES:
        if any(k in text for k in keywords):
            return category
    return "general"


def _use_llm() -> bool:
    return os.environ.get("TRIAGE_USE_LLM") == "1" and bool(
        os.environ.get("ANTHROPIC_API_KEY")
    )


def classify_via_llm(system_prompt: str, user_text: str) -> str:
    """Call Claude and return a bare category string.

    Falls back to the stub on any import/runtime failure so the app never hard-
    fails just because the network or the SDK is unavailable.
    """
    try:
        import anthropic
    except ImportError:
        return classify_via_stub("", user_text)

    client = anthropic.Anthropic()
    try:
        response = client.messages.create(
            model=os.environ.get("TRIAGE_MODEL", DEFAULT_MODEL),
            max_tokens=256,
            thinking={"type": "adaptive"},
            system=system_prompt,
            messages=[{"role": "user", "content": user_text}],
        )
    except Exception:  # network, auth, rate limit — degrade to the stub
        return classify_via_stub("", user_text)

    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        return str(json.loads(text)["category"]).strip().lower()
    except (json.JSONDecodeError, KeyError, TypeError):
        return "general"


def classify_text(system_prompt: str, subject: str, body: str) -> tuple[str, str]:
    """Return (category_string, source) where source is "llm" or "stub"."""
    if _use_llm():
        return classify_via_llm(system_prompt, f"{subject}\n\n{body}"), "llm"
    return classify_via_stub(subject, body), "stub"
