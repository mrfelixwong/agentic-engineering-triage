# Effort Quality Lab: Final Results

## Result

The lab passed its preregistered quality gate. Max effort averaged **96.3/100**, versus **61.3/100** for low: a **+35.0 point** gain. Max beat low in **10/10** matched repetitions. All 40 submissions were valid and all 40 Claude CLI sessions completed.

| Effort | Mean quality | Regressions blocked | Valid | Mean time | Mean cost |
|---|---:|---:|---:|---:|---:|
| low | 61.3/100 | 4.9/8 | 10/10 | 55.5s | $0.258 |
| medium | 68.8/100 | 5.5/8 | 10/10 | 81.8s | $0.355 |
| high | 68.8/100 | 5.5/8 | 10/10 | 129.7s | $0.507 |
| max | 96.3/100 | 7.7/8 | 10/10 | 461.7s | $1.643 |

Actual total model cost: **$27.62**.

## Student impact

Low usually found the obvious cache and pagination gaps. Max was much more likely to test two hard, high-impact behaviors:

- rollout assignment stays stable after a service restart;
- old provider labels still send tickets to the right support queue.

Those are not writing-style improvements. They are additional production failures the submitted tests would stop.

## Per-risk results

| Mutant | Low | Medium | High | Max | Customer or operator impact |
|---|---:|---:|---:|---:|---|
| ROLLOUT-RESTART | 1/10 | 5/10 | 3/10 | 9/10 | customers can move in or out of a rollout after a service restart |
| ROLLOUT-KEY | 8/10 | 10/10 | 10/10 | 10/10 | two independent rollouts can assign every customer to the same bucket |
| CACHE-TENANT | 10/10 | 10/10 | 10/10 | 10/10 | one tenant can receive another tenant's routing decision |
| CACHE-INVALIDATE | 10/10 | 10/10 | 10/10 | 10/10 | invalidating one tenant's ticket removes cached routing for every tenant |
| PAGE-TIE | 10/10 | 10/10 | 10/10 | 10/10 | tickets sharing a timestamp can be skipped between pages |
| PAGE-BOUNDARY | 10/10 | 10/10 | 10/10 | 10/10 | the last ticket on one page can appear again on the next page |
| PROVIDER-ALIAS | 0/10 | 0/10 | 1/10 | 9/10 | legacy payment labels send billing customers to the general queue |
| PROVIDER-FORMAT | 0/10 | 0/10 | 1/10 | 9/10 | uppercase or space-padded provider labels route to the wrong queue |

## Routing rule

Use the lowest effort that meets your measured quality bar. In this lab, medium and high had the same mean quality, so high was not worth its extra time and cost. Max was worth considering for high-consequence release-safety test design. Effort is not a guarantee; keep deterministic checks.

## Evidence boundary

The task, prompt, fixture, model, tools, grader, and run conditions were frozen before the final. Only effort changed. The exact rates apply to this controlled task and should be re-measured when the task or model changes.

Full actual Claude outputs, actual grader records, all 40 run rows, candidate selection evidence, and method details are in [RESULTS.html](RESULTS.html). Machine-readable evidence is in [mutation-final-runs-2026-08-07.json](captures/mutation-final-runs-2026-08-07.json).
