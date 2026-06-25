"""Pydantic models for Triage.

These are the contract every layer agrees on: the HTTP API, the classifier,
and the eval all speak in `Ticket` / `Classification`. Keep the `Category`
enum and the API in sync — adding a category here is the first step in any
"add a label" exercise.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Category(str, Enum):
    """The labels Triage can assign to an incoming ticket."""

    BILLING = "billing"
    BUG = "bug"
    ACCOUNT = "account"
    FEATURE_REQUEST = "feature_request"
    GENERAL = "general"


class Ticket(BaseModel):
    """An incoming support ticket."""

    id: str = Field(..., description="Stable ticket id, e.g. 'T-1042'.")
    subject: str = Field(..., description="One-line subject as the user typed it.")
    body: str = Field(..., description="Full ticket body.")


class Classification(BaseModel):
    """The classifier's verdict on a ticket."""

    ticket_id: str
    category: Category
    # Where the verdict came from: "llm" when a real model answered, "stub"
    # when the offline deterministic classifier did. Lets tests and the eval
    # run with no API key and still assert on behavior.
    source: str = Field("stub", description='"llm" or "stub".')
