"""FastAPI entrypoint for Triage.

Run it:  uvicorn app.main:app --reload
Then:    curl -s localhost:8000/classify \\
             -H 'content-type: application/json' \\
             -d '{"id":"T-1","subject":"refund","body":"I was charged twice"}'

By default the classifier runs the OFFLINE deterministic stub. Set
TRIAGE_USE_LLM=1 (with ANTHROPIC_API_KEY) to route through Claude instead.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.models import Classification, Ticket
from app.triage.classify import classify_ticket

app = FastAPI(title="Triage", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/classify", response_model=Classification)
def classify(ticket: Ticket) -> Classification:
    """Classify a single incoming ticket."""
    return classify_ticket(ticket)
