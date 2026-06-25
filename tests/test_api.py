"""Smoke tests for the HTTP surface.

These confirm the API wiring (routes, request/response models) works. They use
the offline stub backend, so they're deterministic and need no API key.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_classify_returns_a_known_category() -> None:
    resp = client.post(
        "/classify",
        json={"id": "T-1", "subject": "App crashes", "body": "500 error on save"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ticket_id"] == "T-1"
    assert body["category"] in {"billing", "bug", "account", "feature_request", "general"}
    assert body["source"] == "stub"
