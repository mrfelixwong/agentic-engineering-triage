"""Operational helpers used by the ticket-routing release."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib


def rollout_bucket(customer_id: str, rollout_key: str) -> int:
    """Return a stable bucket from 0 through 99 for one rollout."""
    payload = f"{rollout_key}\0{customer_id}".encode("utf-8")
    digest = hashlib.sha256(payload).digest()
    return int.from_bytes(digest[:8], "big") % 100


class RoutingCache:
    """Store queue decisions without crossing tenant boundaries."""

    def __init__(self) -> None:
        self._values: dict[tuple[str, str], str] = {}

    def put(self, tenant_id: str, ticket_id: str, queue: str) -> None:
        self._values[(tenant_id, ticket_id)] = queue

    def get(self, tenant_id: str, ticket_id: str) -> str | None:
        return self._values.get((tenant_id, ticket_id))

    def invalidate(self, tenant_id: str, ticket_id: str) -> None:
        self._values.pop((tenant_id, ticket_id), None)


@dataclass(frozen=True)
class TicketRow:
    ticket_id: str
    created_at: str


def _row_key(row: TicketRow) -> tuple[str, str]:
    return row.created_at, row.ticket_id


def page_after(
    rows: list[TicketRow], cursor: str | None, limit: int
) -> tuple[list[TicketRow], str | None]:
    """Return a stable page ordered by timestamp and ticket ID."""
    if limit < 1:
        raise ValueError("limit must be positive")

    ordered = sorted(rows, key=_row_key)
    if cursor is None:
        remaining = ordered
    else:
        created_at, ticket_id = cursor.split("|", 1)
        cursor_key = (created_at, ticket_id)
        remaining = [row for row in ordered if _row_key(row) > cursor_key]

    page = remaining[:limit]
    if len(remaining) <= limit or not page:
        return page, None
    last = page[-1]
    return page, f"{last.created_at}|{last.ticket_id}"
