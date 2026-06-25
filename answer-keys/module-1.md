# Answer Key — Module 1 (Context Engineering)

Ground truth for the context slice. **Spoilers.** Don't read this until you've
tried writing a `CLAUDE.md` yourself — it shows the finished file.

## The seeded imperfection

The repo ships with **no top-level `CLAUDE.md`** and a layout you have to learn
cold. A fresh agent grep-scans the tree and opens the wrong files before it finds
`app/triage/classify.py` and `app/llm/prompts.py`. The exercise is to write the
instruction file that removes that flailing.

## What "Good" looks like

A real map plus the commands to run — enough that a newcomer agent can navigate
and verify a build:

````markdown
# CLAUDE.md — Triage

A support-ticket assistant: classify a ticket, retrieve similar past tickets,
draft a reply.

## Layout
- `app/main.py` — FastAPI entrypoint
- `app/triage/classify.py` — core classification
- `app/llm/` — provider wrapper (`client.py`) and prompts (`prompts.py`)
- `eval/` — offline eval set + runner

## Run / test
- Test: `pytest`
- Eval: `python -m eval.run`
````

## What "Great" looks like

Navigational (where to look, not a description of the tree), the tribal knowledge
the code can't show, and a way for the agent to check its own work. This is the
file the repo is meant to have:

````markdown
# CLAUDE.md — Triage

Read this first. It's the map of the repo, so you don't have to grep the tree to
orient yourself.

## What this is

**Triage** is a small support-ticket assistant: an LLM reads an incoming ticket
and assigns one category (`billing` / `bug` / `account` / `feature_request` /
`general`). It's the Practice Repo for the *Agentic Engineering* curriculum.

## Runs offline by default

The classifier ships with a deterministic offline stub (keyword rules in
`app/llm/client.py`). Tests and the eval run with no API key and no network. Set
`TRIAGE_USE_LLM=1` (with `ANTHROPIC_API_KEY`) to route through Claude.

## Where things live (start here)

- Change classification logic → `app/triage/classify.py` (the routing seam lives
  here — read it carefully).
- Change wording the model sees → `app/llm/prompts.py` (NOT inline in classify).
- Change models/providers → `app/llm/client.py` only.
- Tests → `tests/`; the eval → `eval/run.py` (`python -m eval.run`).

## Non-obvious rules (the landmines)

- The LLM layer returns a **bare category string**; mapping to the `Category`
  enum happens in `classify.py`, not in the provider wrapper.
- Default model is `claude-opus-4-8` with adaptive thinking — don't pin an older
  model or set `budget_tokens`.
- Adding a category is a three-step change: the `Category` enum (`models.py`),
  the prompt's category guide (`prompts.py`), and any routing in `_ALIASES`
  (`classify.py`).

## Verify your work

`pytest` must pass; the eval (`python -m eval.run`) must hold its `0.80` baseline.
````

## Why it's Great (not just long)

- **Navigational** — "where things live" names the file to open per task, so the
  agent stops grepping.
- **Tribal knowledge** — the bare-string rule, the default-model rule, and the
  three-step "add a category" are landmines the code doesn't announce.
- **Self-verification** — it ends by telling the agent how to check its own work.

You did it right if, in a fresh session with your file in place, the agent opens
`app/triage/classify.py` (or `app/llm/prompts.py` for a prompt change) without you
naming the path, and respects at least one rule you wrote.
