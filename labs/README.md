# Live Labs: Teaching Points 1-4

All four labs run locally in this repository. They share one deliberately broken
starting state, so reset to `origin/main` before each lab.

## One-time setup

```sh
./setup.sh
.venv/bin/pytest -q
.venv/bin/python -m eval.run
```

The starting state is intentionally red:

```text
pytest: 2 failed, 7 passed
eval:   7/10 correct = 0.70, FAIL
```

The two failing test cases and three missed eval cases all come from one seeded
billing-routing defect. Do not fix it before the lab that asks you to.

Save your notes in `packet/`. Those files are ignored by Git and survive the
reset used between labs.

## Reset between labs

```sh
git checkout -- .
git clean -fd -e packet
```

Do not use `git clean -fdx`; it deletes ignored packet files.

## Lab 1: Recover a bad run

**You learn:** stop building on a bad attempt. Restore it, find the real cause,
and retry one changed instruction.

```sh
git checkout -B p1-recovery origin/main
cp labs/templates/recovery.md packet/recovery.md
git apply labs/p1-bad-attempt.patch
git diff
.venv/bin/pytest -q
.venv/bin/python -m eval.run
```

The patch looks reasonable, but it fixes 0 of 5 observed billing cases. Both
checks remain red. Record what happened, then restore the bad attempt:

```sh
git checkout -- app/triage/classify.py
```

Send Claude:

```text
The billing tests still fail. Diagnose the routing bug in app/triage/classify.py.
Do not patch only one example. Fix the general billing behavior.
Run .venv/bin/pytest -q and .venv/bin/python -m eval.run.
Return the diff and both command outputs.
Plan first.
```

The correct result is `9 passed` and `10/10 correct = 1.00, PASS`, with no test
changes. If the same wrong approach happens twice, stop instead of repeating the
same prompt.

## Lab 2: Control the context

**You learn:** separate information Claude can search from information nobody has
given it. A stronger model may find an omitted repository file. It cannot know an
external production value that is absent from every source it can access.

```sh
git checkout -B p2-context origin/main
cp labs/templates/context-comparison.md packet/context-comparison.md
mkdir -p .claude
printf '%s\n' '{ "autoMemoryEnabled": false }' > .claude/settings.local.json
rg -n "owner_queue|q_[A-Za-z0-9]+" app tests eval
claude --permission-mode default
```

The `rg` command should print no matches. That is the control: no runtime source
or test contains the field or a queue-like value. The instructor's exact value is
also absent from Git history and is not repeated in the answer key.

Ask Claude to search the whole repository, but do not supply the missing value:

```text
Add an optional owner_queue field to Classification. For bug tickets, return the exact production queue ID; for other categories, return null. Keep category behavior unchanged. Add API test test_owner_queue_is_bug_only with one bug and one non-bug. Search the whole repository first. If the exact ID is unavailable, ask one question and stop. Do not invent it.
```

The expected result is one specific question asking for the authoritative
production queue ID. Claude should make no edit. Verify that stop condition:

```sh
git diff --exit-code
```

No output and exit code 0 means the working tree is unchanged. If Claude invents
an ID or edits code, reject the run as unsupported.

Wait for the instructor's Customer Operations decision card. Paste that sentence
into the same Claude session, then let Claude implement. The card supplies both
the named authority and the exact value; neither is stored in this repository.

Verify the implementation:

```sh
.venv/bin/pytest -q tests/test_api.py::test_owner_queue_is_bug_only
git diff --check
git diff -- app/models.py app/triage/classify.py tests/test_api.py
```

The focused test must exit 0. In the diff, the bug response and its test must use
the exact value from the card; every other category must use `null`.

Now save the repeatable rule, not this one task's production value:

```sh
printf '%s\n' \
  '## External contracts' \
  'Never infer a queue, customer, or schema ID from its name. If the repo has no authoritative value, stop and ask before editing.' \
  > CLAUDE.md
```

For a large side read, ask a subagent to return only the decision facts:

```text
Use a subagent to inspect the pytest output and return only: failing test names, suspected feature area, and next check to run. Do not paste the whole test output into the main session.
```

Inspect the external tool surface with `claude mcp list`. Record one provider this
local lab does not need; an empty list is fine.

### Optional efficiency comparison

File names are still useful when you already know the code path. They save search;
they are not the source of truth. In a fresh session, ask this question once bare
and once with the three files named, recording search actions and whether the
answer stayed the same:

```text
What category does POST /classify return for a ticket with subject "Refund please" and body "I was charged twice for my subscription this month"? Answer with the single category name.
```

For the second run, add: `Read app/triage/classify.py, app/llm/client.py, and
app/models.py.` Both answers may be correct. The useful comparison is how much
search happened while correctness stayed the same. Record all evidence in
`packet/context-comparison.md`.

### Optional effort and model-routing review

The file-list comparison above measures context efficiency. It does not tell
students whether additional reasoning effort improves work quality enough to
repay its time and cost. Use `labs/effort-review/README.md` to measure that
tradeoff with executable evidence.

Students strengthen release-safety tests for one correct, frozen change. A
separate mutation grader tries eight plausible broken implementations. The
score is the number of production regressions the submitted tests would stop.
In 40 captured runs, low blocked 4.9 of 8 on average and max blocked 7.7 of 8;
max took 8.3 times as long. This teaches effort routing without treating a
longer answer as higher quality.

## Lab 3: Turn a vague request into a real specification

**You learn:** every missing decision becomes Claude's decision. A complete spec
keeps the student in control and reduces surprise changes.

```sh
git checkout -B p3-spec origin/main
cp labs/templates/spec.md packet/spec.md
claude --permission-mode default
```

First send the vague request, then stop before code:

```text
Add a confidence score from 0 to 1. Plan first.
```

Mark every value, file, test, and non-goal that Claude had to invent. Then send:

```text
GOAL
Classification returns a confidence value that tells the caller whether the category came from a matched rule or from the fallback.

CONTEXT
Read app/models.py, app/triage/classify.py, and tests/test_classify.py.

ACCEPTANCE
A keyword-rule match scores 0.9.
The general fallback scores 0.3.
The value is never outside 0.0-1.0.
One test covers a keyword match.
One test covers the fallback.

CONSTRAINTS / NON-GOALS
Only edit the files named above.
Do not change eval/.
Do not fix the billing bug.

VERIFICATION
Run .venv/bin/pytest -q and paste the output.

PLAN FIRST
Show the plan and files before editing.
```

Cut any plan step that touches another file, fixes billing, changes eval, adds an
extra feature, or weakens a test. After approving the smaller plan, verify:

```sh
.venv/bin/pytest -q
.venv/bin/python -m eval.run
```

The new confidence tests should pass. The protected billing failures should
remain, so the expected totals are `2 failed, 9 passed` and eval `0.70, FAIL`.
That red result is expected because billing is explicitly outside this lab.

## Lab 4: Move checks from memory into Git

**You learn:** the repository can reject known-bad work without waiting for the
student to remember and run every check.

First prove Git accepts the red state when no gate exists:

```sh
git checkout -B p4-no-gate origin/main
git config --unset core.hooksPath 2>/dev/null || true
.venv/bin/pytest -q -k billing
git commit --allow-empty -m "Accept red state without gate"
git log -1 --format='%h %s'
```

Now try the same red state with the repository gate:

```sh
git checkout -B p4-gate origin/main
git config core.hooksPath scripts
git commit --allow-empty -m "Attempt red state with gate"
git log -1 --format='%h %s'
```

The hook should run pytest and refuse the commit. `git log -1` should still show
the `origin/main` commit.

Send Claude:

```text
The billing tests fail. Find the routing bug in app/triage/classify.py.
The fix should change billing behavior, not tests.
Return the diff, pytest output, and eval output.
Plan first.
```

Check the protected tests and commit through the same gate:

```sh
git diff -- tests/
git add app/triage/classify.py
git commit -m "Route billing tickets to billing"
```

The test diff should be empty. The gate should run two checks, report `9 passed`
and eval `1.00, PASS`, then allow the commit. Save both the refused and accepted
outputs in `packet/evidence.md`.

## Why solutions are not on main

`main` keeps the seeded billing defect and does not include the confidence
feature. Those changes are the work students produce in Labs 3 and 4. Merging
the solutions would remove the before state and break the labs.
