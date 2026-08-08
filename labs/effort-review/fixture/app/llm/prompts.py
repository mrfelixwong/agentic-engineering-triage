"""Prompt templates for Triage's classifier.

Kept in one place so a prompt change is a single, reviewable diff — and so the
eval (`eval/run.py`) has one thing to point at when a prompt edit moves the
score. The category list here must match `app.models.Category`.
"""

from __future__ import annotations

from app.models import Category, Ticket

CATEGORY_GUIDE = """\
- billing: invoices, charges, refunds, payment methods, pricing, subscriptions, being overcharged.
- bug: something is broken, errors, crashes, a feature not working as documented.
- account: login, password reset, access, permissions, profile or security settings.
- feature_request: asking for something the product does not do yet.
- general: anything that does not clearly fit the above.\
"""

SYSTEM_PROMPT = f"""\
You are the triage classifier for a support desk. Read an incoming ticket and \
assign exactly one category. Categories:

{CATEGORY_GUIDE}

Respond with a single JSON object and nothing else: {{"category": "<one of: \
{", ".join(c.value for c in Category)}>"}}."""


def user_prompt(ticket: Ticket) -> str:
    """Render one ticket into the user turn."""
    return f"Subject: {ticket.subject}\n\nBody: {ticket.body}"
