from app.triage.operations import RoutingCache, TicketRow, page_after, rollout_bucket


def test_rollout_bucket_is_repeatable_and_in_range() -> None:
    first = rollout_bucket("customer-17", "priority-routing-v1")
    assert first == rollout_bucket("customer-17", "priority-routing-v1")
    assert 0 <= first < 100


def test_routing_cache_round_trip() -> None:
    cache = RoutingCache()
    cache.put("tenant-a", "T-1", "billing")
    assert cache.get("tenant-a", "T-1") == "billing"


def test_first_page_is_ordered() -> None:
    rows = [
        TicketRow("T-2", "2026-08-07T10:02:00Z"),
        TicketRow("T-1", "2026-08-07T10:01:00Z"),
    ]
    page, cursor = page_after(rows, None, 1)
    assert [row.ticket_id for row in page] == ["T-1"]
    assert cursor == "2026-08-07T10:01:00Z|T-1"
