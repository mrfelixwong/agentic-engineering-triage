# Effort-Lab Candidate Selection

The selection rule was fixed before the new pilot: quality must come from
executable behavior, max must average at least 15 points above low, and the
valid-run rate must not get worse.

| Candidate | Primary quality measure | Evidence | Decision |
|---|---|---|---|
| Repair one seeded billing bug | Correct implementation and green eval | Existing effort-routing capture: every tested effort repaired the same root cause | Rejected: one fix gave no quality headroom |
| Review safe and unsafe billing changes | Correct `MERGE` or `REJECT` decisions | 24 controlled runs: low and max both scored 6/6 | Rejected: binary decision saturated |
| Strengthen release-safety tests | Percentage of deterministic production mutants killed | Pilot: low 62.5, max 100. Final: 40 frozen runs | Selected: max averaged 96.25 versus low 61.25 |

The third candidate did not assume max would win. It advanced only after the
recorded pilot cleared the threshold above. The frozen final then required max
to beat low by at least 20 points and in at least 7 of 10 matched repetitions.
It passed by 35 points and 10 of 10 matched repetitions. All 40 submissions
were valid. Official effort guidance describes effort as a
capability-versus-token tradeoff, and ICLR 2025 research finds that
test-time-compute gains depend strongly on task difficulty.

See `RESULTS.html` for the full comparison, actual Claude outputs, grader
results, timings, and costs.

Sources:

- https://platform.claude.com/docs/en/build-with-claude/effort
- https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- https://proceedings.iclr.cc/paper_files/paper/2025/hash/1b623663fd9b874366f3ce019fdfdd44-Abstract-Conference.html
