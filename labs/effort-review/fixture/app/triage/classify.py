"""Core: classify an incoming ticket.

`classify_ticket` is the one function the API and the eval both call. It asks
the LLM layer for a bare category string, then normalizes that string into the
`Category` enum.

The normalization step is where routing rules live, for example, collapsing
unknown or legacy labels into `general`. Be careful here: a wrong rule silently
mislabels a whole category. The provider compatibility contract lives at
`packet/provider-category-contract.md`.
"""

from __future__ import annotations

from app.llm import client as llm_client
from app.llm.prompts import SYSTEM_PROMPT, user_prompt
from app.models import Category, Classification, Ticket

# Map a raw category string to the Category enum. Strings the model might emit
# that aren't exact enum values get folded to their intended category here.
_ALIASES: dict[str, Category] = {
    "billing": Category.BILLING,
    "payments": Category.BILLING,
    "bug": Category.BUG,
    "defect": Category.BUG,
    "account": Category.ACCOUNT,
    "auth": Category.ACCOUNT,
    "feature_request": Category.FEATURE_REQUEST,
    "feature": Category.FEATURE_REQUEST,
    "general": Category.GENERAL,
}


def _normalize(raw: str) -> Category:
    """Fold a raw category string into the Category enum."""
    key = raw.strip().lower()
    if key in _ALIASES:
        return _ALIASES[key]
    # Exact enum value (e.g. the model returned "billing" and no alias matched).
    try:
        return Category(key)
    except ValueError:
        return Category.GENERAL


def classify_ticket(ticket: Ticket) -> Classification:
    """Classify one ticket end to end."""
    raw, source = llm_client.classify_text(
        SYSTEM_PROMPT, ticket.subject, ticket.body
    )
    # `_normalize` is reached for both the LLM and the stub backend; render the
    # prompt eagerly so a prompt-template error surfaces here, not at request
    # time deep in the provider wrapper.
    _ = user_prompt(ticket)
    return Classification(
        ticket_id=ticket.id,
        category=_normalize(raw),
        source=source,
    )
