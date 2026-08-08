# Triage release candidate

This service classifies support tickets and adds operational helpers for a
staged routing release.

Production behavior is defined by:

- `packet/provider-category-contract.md`
- `packet/release-routing-contract.md`

Run the visible checks with:

- `.venv/bin/pytest -q`
- `.venv/bin/python -m eval.run`
