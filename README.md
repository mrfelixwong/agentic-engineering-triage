# Triage

A small support-ticket assistant: an LLM reads an incoming ticket and assigns
one category (`billing`, `bug`, `account`, `feature_request`, `general`). This
is the **Practice Repo** for the *Agentic Engineering* curriculum — a real,
runnable app seeded with deliberate imperfections, each tied to a module's
exercise and a ground-truth answer key.

It serves several curriculum modules at once — different aspects of one realistic,
imperfect codebase: there is **no `CLAUDE.md`** to navigate by (Module 1), a seeded
classification bug to catch (Module 3), and more to come. Each module's lab targets
one; do the module you're on, on a fresh clone.

> Runs **offline by default** — a deterministic stub classifier means tests and
> the eval need no API key and no network. Set `TRIAGE_USE_LLM=1` (with
> `ANTHROPIC_API_KEY`) to route through Claude (`claude-opus-4-8`) instead.

## Layout

```text
triage/
  app/
    main.py            # FastAPI entrypoint (GET /health, POST /classify)
    models.py          # pydantic models: Ticket, Classification, Category
    llm/
      client.py        # provider wrapper: real Claude call + offline stub
      prompts.py       # prompt templates
    triage/
      classify.py      # core: classify a ticket (+ the routing seam)
  tests/               # pytest, offline (one test is RED by design)
  eval/
    cases.jsonl        # held-out eval set
    run.py             # python -m eval.run — scores + baseline gate
  answer-keys/
    module-0.md        # ground truth: the agent loop (spoilers)
    module-1.md        # ground truth: the CLAUDE.md you write (spoilers)
    module-3.md        # ground truth: the verification bug (spoilers)
  .claude/skills/      # coached lessons (lesson-1, lesson-3-1)
  scripts/pre-commit   # the verification gate
  pyproject.toml
  # note: no CLAUDE.md at the root — writing it is the Module 1 exercise
```

## Setup and run

```bash
python3 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/pip install -e '.[dev]'        # pytest + FastAPI TestClient

# tests — one is RED on purpose (the seeded bug); the rest are green
.venv/bin/pytest -q

# eval — exits non-zero while the bug is present (0.70 < 0.80 baseline)
.venv/bin/python -m eval.run

# serve the API (optional; needs uvicorn)
.venv/bin/pip install uvicorn
.venv/bin/uvicorn app.main:app --reload
curl -s localhost:8000/classify -H 'content-type: application/json' \
  -d '{"id":"T-1","subject":"Refund","body":"I was charged twice"}'
```

## The exercises

This one repo carries several modules' labs. Each is independent and best done on a
fresh clone.

**Module 0 — watch the loop.** Give the agent a small task (e.g. add a docstring to
`classify_ticket`) and narrate its perceive → plan → act → observe loop; name the
first failure mode you see. Ground truth: `answer-keys/module-0.md`.

**Module 1 — context.** There's no `CLAUDE.md`. Give the agent a cold task and watch
it flail, then write a `CLAUDE.md` and watch the flailing shrink. Coached:
`.claude/skills/lesson-1-cold-navigation/`. Ground truth: `answer-keys/module-1.md`.

**Module 3 — verification.**

1. Run `pytest`. One test fails: `test_billing_ticket_is_labeled_billing`. That
   failure is the lab — it encodes the behavior you need to make true.
2. Have the agent investigate and fix the root cause, then loop until the test
   is green and `python -m eval.run` exits 0.
3. Install the gate so the fix can't regress:
   `ln -sf ../../scripts/pre-commit .git/hooks/pre-commit`.

Want it coached? In Claude Code, run the lesson skill in
`.claude/skills/lesson-3-1-verification/`. The ground-truth answer is in
`answer-keys/module-3.md` (don't peek until you've tried it).

## Use a real model

```bash
export ANTHROPIC_API_KEY=sk-...
export TRIAGE_USE_LLM=1
.venv/bin/pip install -e '.[llm]'        # installs the anthropic SDK
.venv/bin/python -m eval.run
```

The classifier degrades back to the offline stub if the SDK or the network is
unavailable, so nothing hard-fails without a key.
