---
name: lesson-1-cold-navigation
description: Coached context lab on Triage - distinguish searchable repository evidence from an unavailable external value, save the durable no-inference rule, summarize a large side read, and inspect the connected tool surface.
user_invocable: true
---

# Context Lab - Coached

Guide the student through one comparison at a time. The student runs a separate
Claude Code session in the repository. Coach; do not perform the work for them.

## Rules

- Never reveal or store the instructor's production queue ID before Claude asks.
- Record what Claude actually searched, asked, edited, and verified.
- Treat any invented queue ID or pre-question edit as a failed run.
- Keep the optional file-name comparison separate; it measures efficiency only.
- Give one hint at a time only when the student is stuck.

## Setup

Have the student run:

```sh
git checkout -B p2-context origin/main
cp labs/templates/context-comparison.md packet/context-comparison.md
mkdir -p .claude
printf '%s\n' '{ "autoMemoryEnabled": false }' > .claude/settings.local.json
rg -n "owner_queue|q_[A-Za-z0-9]+" app tests eval
claude --permission-mode default
```

Confirm there is no root `CLAUDE.md` and the search prints no matches.

## Part 1 - Let Claude search, then reach the boundary

Give the working session this exact prompt:

```text
Add an optional owner_queue field to Classification. For bug tickets, return the exact production queue ID; for other categories, return null. Keep category behavior unchanged. Add API test test_owner_queue_is_bug_only with one bug and one non-bug. Search the whole repository first. If the exact ID is unavailable, ask one question and stop. Do not invent it.
```

Checkpoint: Claude asks for the authoritative production queue ID. Have the
student run `git diff --exit-code`; it must exit 0 with no output. If Claude
invented a value or edited code, ask the student why that evidence is unsafe.

## Part 2 - Supply the named authority

Wait for Claude's question. Then show the instructor's Customer Operations card
and have the student paste its sentence into the same session. Do not dictate the
value before the question.

Checkpoint: Claude uses the exact supplied value in code and in the focused test.

## Part 3 - Verify the contract

Have the student run:

```sh
.venv/bin/pytest -q tests/test_api.py::test_owner_queue_is_bug_only
git diff --check
git diff -- app/models.py app/triage/classify.py tests/test_api.py
```

Checkpoint: the focused test exits 0, the exact owner value appears in code and
test, and every other category uses `null`.

## Part 4 - Save the repeatable rule

Have the student create:

```markdown
## External contracts
Never infer a queue, customer, or schema ID from its name. If the repo has no authoritative value, stop and ask before editing.
```

Checkpoint: the file keeps the durable rule, not the one task's queue ID. Explain
that this is context, not enforcement; the test and review remain necessary.

## Part 5 - Keep a large side read out of the main conversation

Give the working session:

```text
Use a subagent to inspect the pytest output and return only: failing test names, suspected feature area, and next check to run. Do not paste the whole test output into the main session.
```

Checkpoint: the summary keeps the failing test names, suspected feature area,
and next check. A shorter answer is not a success if one of those is missing.

## Part 6 - Inspect the tool surface

Have the student run `claude mcp list` and record which external servers are
available. Ask which ones this classification task actually needs.

## Close

Ask: "When should you name files, let Claude search, or ask an owner?"

The useful answer is: name known paths to save search; let Claude discover
unknown but searchable paths; ask for an unavailable fact before editing. Point
to `answer-keys/module-1.md` after the student completes the lab, then stop.
