# Answer Key - Module 1 (Context Engineering)

Ground truth for the context lab. **Spoilers.** Complete the stop-and-ask run
before reading this file.

## What is deliberately missing

The exact production queue ID on the instructor's Customer Operations card does
not exist anywhere in this repository. That is the lesson control. A file search,
answer key search, stronger model, or longer reasoning run cannot recover a value
that no accessible source contains.

The correct result before the instructor card is:

1. Claude searches the repository.
2. Claude asks one specific question for the authoritative production queue ID.
3. `git diff --exit-code` exits 0 because Claude made no edit.

Any concrete queue ID before the card is unsupported, even if it looks plausible.

## What changes after the card

Use the exact value the instructor provides. The focused test
`tests/test_api.py::test_owner_queue_is_bug_only` must exit 0, and the diff
must show that bug tickets use that exact value while every other category uses
`null`. This answer key intentionally does not repeat the ID, because storing it
here would make the first run a search exercise again.

## The durable context

The line worth keeping is the decision rule:

```markdown
## External contracts
Never infer a queue, customer, or schema ID from its name. If the repo has no authoritative value, stop and ask before editing.
```

`CLAUDE.md` supplies that rule to future sessions. It does not enforce the rule;
the focused test, diff review, and named authority provide the evidence.

## File names still have a smaller use

If you already know the code path, naming it can reduce search time and context.
If you do not know it, let a capable model search and explain what it found. That
comparison measures efficiency only. It does not prove that a person must list
every repository file for Claude to be correct.
