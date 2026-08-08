# Release routing contract

The release adds rollout, cache, and pagination helpers. These requirements are
part of the production contract even when the visible tests do not cover every
case.

## Rollout assignment

- A customer keeps the same bucket across processes, restarts, and machines.
- Buckets are integers from 0 through 99.
- The rollout key is part of assignment, so separate rollouts do not share the
  same customer assignment by accident.

## Routing cache

- Cache entries are isolated by both tenant ID and ticket ID.
- Invalidating one tenant's ticket must not remove another tenant's entry.

## Queue pagination

- Rows are ordered by creation time and then ticket ID.
- Following a cursor must neither repeat nor skip a row.
- Rows with the same creation time must still appear exactly once.

## Provider categories

Provider normalization remains governed by
`packet/provider-category-contract.md`. Release tests should protect legacy
labels and formatting differences that a provider can return.
