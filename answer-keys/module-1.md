# Answer Key - Module 1 (Context Engineering)

Ground truth for the context lab. **Spoilers.** Try the before/after comparison
before reading this file.

## The seeded problem

The repository has no top-level `CLAUDE.md`. A new session must discover the
important files and check commands again. The exercise is to save the small set
of facts that every classifier task needs.

## The useful file

````markdown
# Triage

Core routing lives in app/triage/classify.py.
Model-call behavior lives in app/llm/client.py.
Shared response types live in app/models.py.
Run both checks on classifier changes:
.venv/bin/pytest -q
.venv/bin/python -m eval.run
The eval is the gate, not pytest alone.
````

This is enough because it answers five questions before a search:

1. Which file controls routing?
2. Which file controls model-call behavior?
3. Which file defines the shared response shape?
4. What command runs the tests?
5. What command runs the eval gate?

In the captured comparison, the before response named 0 of these 5 facts
exactly. The after response named all 5. The benefit is not that `CLAUDE.md` is
longer; the next session starts at the real files and checks.

## The important limit

Naming files helps only when the list is complete. In the course benchmark, a
complete three-file list stayed correct while using less context than bare
search. A plausible but incomplete two-file list was wrong in all 6 primary
Sonnet runs.

Use this rule:

- Know the whole code path: name the files.
- Unsure about the path: let Claude search.

## Why the file is not on main

Writing `CLAUDE.md` is the exercise. Shipping the answer at the repository root
would remove the cold-start before state. Keep your completed file in your lab
branch or packet.
