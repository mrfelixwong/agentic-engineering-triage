# Answer Key — Module 0 (The Agent Loop)

Ground truth for the loop-watching exercise. This module has no code to fix — you
observe one agent run and learn to name what you see. Use this to check your read.

## A clean loop, one turn

Give the agent a small task (e.g. "add a docstring to `classify_ticket` in
`app/triage/classify.py`"). One full turn looks like:

- **Perceive** — it reads `app/triage/classify.py` (maybe `models.py` too).
- **Plan** — it states what it will change before changing it.
- **Act** — it edits the file (and may run `pytest`).
- **Observe** — it reads the result (the file now has the docstring; tests still
  pass) and that observation feeds the next step.

You read it right if you can point at each of those four steps, in order, at least
once.

## The three failure modes (recognize them by their tell)

- **Lost context** — it forgets a constraint you set or a file it already read.
  *Tell:* it re-asks something already settled, or re-introduces a change it just
  undid.
- **Plausible-but-wrong** — an edit that reads clean and is wrong. *Tell:*
  confident tone, tidy diff, but nothing actually verified the behavior.
- **Thrashing** — it loops without converging. *Tell:* three attempts in and the
  diff is churning, not shrinking.

## What to take away

Each failure mode maps to a later lever, which is why you're learning to name them
now: lost context → Module 1 (context), plausible-but-wrong → Module 3
(verification), thrashing → a sharper spec (Module 2) or a clean reset (Module 1).
