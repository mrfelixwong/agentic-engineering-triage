"""Tests for the core classifier.

These run against the OFFLINE stub backend (no API key, no network), so they
are deterministic. The stub returns the correct raw category for each ticket;
any wrong verdict here is a normalization/routing bug, not a model miss.

One test is RED BY DESIGN — see `test_billing_ticket_is_labeled_billing`.
It encodes the behavior the verification lesson asks you to make pass. Until
the seeded bug is fixed it fails; that failure is the lesson. Everything else
is green. See `answer-keys/module-3.md` for the ground truth.
"""

from __future__ import annotations

import pytest

from app.models import Category, Ticket
from app.triage.classify import classify_ticket


def _classify(subject: str, body: str) -> Category:
    return classify_ticket(Ticket(id="T-x", subject=subject, body=body)).category


def test_bug_ticket_is_labeled_bug() -> None:
    assert _classify("App crashes", "I get a 500 error on every save") == Category.BUG


def test_account_ticket_is_labeled_account() -> None:
    assert _classify("Can't log in", "Password reset link never arrives") == Category.ACCOUNT


def test_feature_request_is_labeled_feature_request() -> None:
    assert (
        _classify("Dark mode", "Would be nice to have support for a dark theme")
        == Category.FEATURE_REQUEST
    )


def test_unclassifiable_falls_back_to_general() -> None:
    assert _classify("Hello", "Just saying thanks for the great product") == Category.GENERAL


def test_source_is_stub_offline() -> None:
    # With no API key / TRIAGE_USE_LLM unset, the deterministic stub answers.
    result = classify_ticket(Ticket(id="T-s", subject="hi", body="thanks"))
    assert result.source == "stub"


# --- RED BY DESIGN: this is the failing case the lesson fixes -----------------
@pytest.mark.parametrize(
    "subject, body",
    [
        ("Refund please", "I was charged twice for my subscription this month"),
        ("Overcharged", "My invoice shows a payment I never made"),
    ],
)
def test_billing_ticket_is_labeled_billing(subject: str, body: str) -> None:
    """Billing tickets must be labeled `billing`, not `general`.

    Currently FAILS: a routing alias folds 'billing' into the general queue.
    Fixing that mapping is the verification exercise.
    """
    assert _classify(subject, body) == Category.BILLING
