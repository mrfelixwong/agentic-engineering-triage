# packet/ — where your change package accumulates

You are going to be asked, at the end of the course, to hand someone a package
they could act on without asking you a single question. This folder is where the
pieces land as you make them.

Every exercise that produces something durable ends by saving it here. Do that
even when it feels like busywork — the pieces are cheap to save in the moment and
expensive to reconstruct at the end, because most of them come from a terminal
session you will have closed.

## What goes here

| File | Which exercise makes it | What it holds |
|---|---|---|
| `spec.md` | 3 | The spec you wrote: goal, context, acceptance, constraints, verification |
| `diff.patch` | 4 | The change itself — `git diff` of the billing fix |
| `evidence.md` | 4 | The gate refusing on red, then admitting on green. Paste both, verbatim |
| `review.md` | 5 | What you found when you read the diff that bought a green test, and what you decided |
| `scope.md` | 5 | What your checks proved, and what they did **not** cover |
| `guardrail.md` | 6 | The rule you made unignorable, and the proof it refused |
| `residue.md` | 7 | The line you left for the next session (also lives in `CLAUDE.md`) |
| `record.md` | 8 | Task record and the economics verdict, with real numbers |
| `shape.md` | 9 | Inline, subagent, or parallel — the call you made and why |

Those nine are what the closing table asks for, and every one of them has an
exercise that tells you to write it.

One more belongs in a finished package and no exercise produces it yet:
`transfer.md`, the task in your own codebase you would try this loop on next.
Write it anyway. It is the piece that decides whether any of this survives
contact with your actual job.

## Keep it untracked

These are your working notes, not repo content, so they are gitignored. Only this
README is tracked, which is why the folder exists in a fresh clone.

Two things follow, and it is worth knowing which is which:

- `git clean -fd` **does not** touch them. It leaves ignored files alone. So the
  course resets were already safe once this folder became ignored.
- `git clean -fdx` **would** delete them. The `-x` is what reaches ignored files,
  and it is a flag people reach for when a tree feels dirty.

The resets in the course are written `git clean -fd -e packet` so they stay
correct either way. If you invent your own reset, do the same:

```bash
git clean -fd -e packet
```

## The one rule

Paste real output. A packet that says "tests passed" is worth nothing; a packet
with the actual pytest lines in it is evidence. The difference between those two
is the whole course.
