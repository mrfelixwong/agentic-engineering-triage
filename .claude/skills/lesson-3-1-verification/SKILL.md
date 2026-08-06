---
name: lesson-3-1-verification
description: Coached verification lab on Triage - prove red code can enter without a gate, install the gate, watch it refuse the same red state, fix the behavior, and watch the same gate accept green work.
user_invocable: true
---

# Verification Lab - Coached

Guide the student through one step at a time. The student works in a separate
terminal and reports the evidence back here. Coach; do not edit the code for
them.

## Rules

- Ask the student to paste actual command output at each checkpoint.
- Do not accept "tests passed" without the pytest and eval lines.
- Do not let the student weaken, skip, or delete a test.
- Lead with a question. Give one hint at a time only when the student is stuck.
- Stop after the closing question.

## Setup

Have the student open a second terminal at the repository root and run:

```sh
./setup.sh
git fetch origin
```

Wait for the student to say the setup finished.

## Part 1 - Prove Git accepts red work without a gate

Tell the student to run:

```sh
git checkout -B p4-no-gate origin/main
git config --unset core.hooksPath 2>/dev/null || true
.venv/bin/pytest -q -k billing
git commit --allow-empty -m "Accept red state without gate"
git log -1 --format='%h %s'
```

Ask: "The billing check was red. Did Git still create a commit? What proves
that?"

Checkpoint:

- pytest shows the billing failure;
- `git commit` exits successfully;
- `git log -1` shows the new empty commit.

Explain only after the student answers: Git accepted known-bad work because no
automatic check ran.

## Part 2 - Make the repository refuse the same red state

Tell the student to reset to the same starting code, install the shipped hook,
and retry:

```sh
git checkout -B p4-gate origin/main
git config core.hooksPath scripts
git commit --allow-empty -m "Attempt red state with gate"
git log -1 --format='%h %s'
```

Ask: "What ran automatically? Did the commit enter history?"

Checkpoint:

- the output starts with `[gate] running tests...`;
- the hook exits on the billing failures;
- no new commit appears in `git log -1`.

The student should be able to say: "The check moved from my memory into the
commit path."

## Part 3 - Fix behavior without changing the check

Give the student this prompt for the working Claude session:

```text
The billing tests fail. Find the routing bug in app/triage/classify.py.
The fix should change billing behavior, not tests.
Return the diff, pytest output, and eval output.
Plan first.
```

Before accepting the result, have the student run:

```sh
git diff -- tests/
.venv/bin/pytest -q
.venv/bin/python -m eval.run
```

Checkpoint:

- the test diff is empty;
- pytest reports `9 passed`;
- eval reports `10/10 correct = 1.00` and `PASS`.

If pytest is green but eval is red, ask what that says about whether the whole
category was fixed. If tests changed, stop and make the student explain why the
change strengthens rather than weakens the check.

## Part 4 - Let the same gate accept verified work

Tell the student to commit only the behavior fix:

```sh
git add app/triage/classify.py
git commit -m "Route billing tickets to billing"
```

Checkpoint:

- the hook runs pytest and eval automatically;
- both pass;
- `[gate] ok` appears;
- Git prints a new commit hash.

Ask the student to save the refused and accepted outputs in
`packet/evidence.md`.

## Close

Ask: "What changed for you after the gate was installed?"

The useful answer is: the student no longer has to remember both commands before
every commit. The repository blocks known-bad work and still allows verified
work. In the observed lab, bad commits went from 1 without the gate to 0 with
it, while automatic checks went from 0 to 2.

Point the student to `answer-keys/module-3.md` only after they complete the lab.
Then stop.
