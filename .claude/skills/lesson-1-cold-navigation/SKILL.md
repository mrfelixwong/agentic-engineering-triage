---
name: lesson-1-cold-navigation
description: Coached context lab on Triage - compare bare search with a complete file list, add durable CLAUDE.md context, summarize a large side read, and inspect the connected tool surface.
user_invocable: true
---

# Context Lab - Coached

Guide the student through one comparison at a time. The student runs a separate
Claude Code session in the repository. Coach; do not perform the work for them.

## Rules

- Keep the question identical between the before and after runs.
- Require `/clear` before the after run.
- Record what Claude actually searched or read, not what the student expected.
- Do not claim a smaller context is better unless the answer is still correct.
- Give one hint at a time only when the student is stuck.

## Setup

Have the student run:

```sh
git checkout -B p2-context origin/main
cp labs/templates/context-comparison.md packet/context-comparison.md
mkdir -p .claude
printf '%s\n' '{ "autoMemoryEnabled": false }' > .claude/settings.local.json
claude --permission-mode default
```

Confirm there is no root `CLAUDE.md` before continuing.

## Part 1 - Let Claude search

Give the working session this exact prompt:

```text
What category does POST /classify return for a ticket with subject "Refund please" and body "I was charged twice for my subscription this month"? Answer with the single category name.
```

Ask the student to record the answer and every file or search step they saw.

Checkpoint: the answer is based on repository inspection, not general customer
support knowledge.

## Part 2 - Name the complete code path

Have the student type `/clear`, then send:

```text
What category does POST /classify return for a ticket with subject "Refund please" and body "I was charged twice for my subscription this month"? Answer with the single category name. Read app/triage/classify.py, app/llm/client.py, and app/models.py.
```

Ask: "What changed in the search path? Did correctness stay the same?"

Checkpoint: the student can explain that the file list helps only because it
contains the complete path that controls the answer. A plausible incomplete list
can point Claude at the wrong explanation.

## Part 3 - Save facts every session needs

Have the student create:

```markdown
# Triage

Core routing lives in app/triage/classify.py.
Model-call behavior lives in app/llm/client.py.
Shared response types live in app/models.py.
Run both checks on classifier changes:
.venv/bin/pytest -q
.venv/bin/python -m eval.run
The eval is the gate, not pytest alone.
```

Start a fresh Claude session and ask:

```text
Before reading files, tell me which files probably decide classification behavior and which commands verify it.
```

Checkpoint: Claude names all 3 exact files and both exact commands before a
repository search. Ask the student why this helps: the next session starts in
the right place instead of rediscovering the same five facts.

## Part 4 - Keep a large side read out of the main conversation

Give the working session:

```text
Use a subagent to inspect the pytest output and return only: failing test names, suspected feature area, and next check to run. Do not paste the whole test output into the main session.
```

Checkpoint: the summary keeps all 3 decision facts. A shorter answer is not a
success if one of those facts is missing.

## Part 5 - Inspect the tool surface

Have the student run `claude mcp list` and record which external servers are
available. Ask which ones this classification task actually needs.

## Close

Ask: "When should you name files, and when should you let Claude search?"

The useful answer is: name files when you know the whole code path; otherwise
let Claude search. Point to `answer-keys/module-1.md` after the student completes
their own comparison, then stop.
