# Stage 5 — Cluster Evaluation Report

Run: cluster-v1 | Model: claude-haiku-4-5-20251001 | Generated: 2026-06-16T07:20:07.793058+00:00

Dev-time validation against the golden set's cluster hypothesis only.
This has no effect on runtime/production pipeline behavior — clustering
remains advisory per project-context.md §4 HITL map. No confidence-scoring
or HITL logic is added as a result of this comparison.

## Comparison table

| feedback_id | golden hypothesis cluster | actual cluster (cluster.py) | category |
|---|---|---|---|
| FB-01 | CLU-001 | CLU-001 | exact match |
| FB-02 | singleton-FB-02 | CLU-002 | exact match |
| FB-03 | singleton-FB-03 | CLU-003 | exact match |
| FB-04 | (excluded from golden set) | CLU-004 | not in golden set |
| FB-05 | CLU-005 | CLU-005 | exact match |
| FB-06 | CLU-006-022 | CLU-006 | split-when-hypothesis-merged |
| FB-07 | CLU-007 | CLU-007 | exact match |
| FB-08 | CLU-008 | CLU-008 | exact match |
| FB-09 | singleton-FB-09 | CLU-009 | exact match |
| FB-10 | singleton-FB-10 | CLU-010 | exact match |
| FB-11 | (excluded from golden set) | CLU-011 | not in golden set |
| FB-12 | CLU-012-015 | CLU-012 | split-when-hypothesis-merged |
| FB-13 | singleton-FB-13 | CLU-013 | exact match |
| FB-14 | CLU-014 | CLU-014 | exact match |
| FB-15 | CLU-012-015 | CLU-015 | split-when-hypothesis-merged |
| FB-16 | CLU-016 | CLU-016 | exact match |
| FB-17 | singleton-FB-17 | CLU-017 | exact match |
| FB-18 | (excluded from golden set) | CLU-018 | not in golden set |
| FB-19 | singleton-FB-19 | CLU-019 | exact match |
| FB-20 | singleton-FB-20 | CLU-020 | exact match |
| FB-21 | (excluded from golden set) | CLU-021 | not in golden set |
| FB-22 | CLU-006-022 | CLU-022 | split-when-hypothesis-merged |
| FB-23 | singleton-FB-23 | CLU-023 | exact match |
| FB-24 | singleton-FB-24 | CLU-024 | exact match |
| FB-25 | (excluded from golden set) | CLU-025 | not in golden set |

## Category counts

| Category | Count |
|---|---|
| exact match | 16 |
| not in golden set | 5 |
| split-when-hypothesis-merged | 4 |

## Key checkpoint: CLU-006-022 (FB-06, FB-22)

FB-06 actual cluster: CLU-006  |  FB-22 actual cluster: CLU-022

**Result: SPLIT, as expected.** The clustering correctly distinguished the name-mismatch issue (FB-06) from the 2FA issue (FB-22) despite both being Engineering items from the same account.

## Observation: all 25 clusters are singletons

The model did not merge any items, including FB-12 + FB-15 (the only other golden-set hypothesis pair besides CLU-006-022). On inspection this split looks correct, not conservative: FB-12 is a card-dispute review delay, FB-15 is a missing onboarding email — genuinely different problems that only share `dimension=Support Process`. The golden set's own note for this pair already says "different sub-issues," so the hypothesis itself was speculative, not confirmed ground truth.

That said, the golden set's exclusion notes (header comments, items not in the labeled table) flag three pairs across the full 25-item set that share a stated theme and were never tested by the model merging or not:

- FB-04 + FB-22 — both about login/2FA friction, though FB-04 is session-timeout-driven re-login and FB-22 is SMS delivery failure (different root cause; correctly kept separate, in retrospect)
- FB-11 + FB-02 — both about dashboard currency/amount display issues (FB-02: undisclosed FX spread in total; FB-11: wrong currency label) — arguably closer to "same underlying display bug" than FB-12/FB-15 were
- FB-19 + FB-25 — both praise mentioning fast KYB/onboarding — closer in theme than most other praise pairs

None of these were merged. Given the prompt explicitly tells the model "praise and noise items almost always form singleton clusters," FB-19/FB-25 may have been primed toward staying separate regardless of content similarity. FB-11/FB-02 is the pair most worth a second look — they may describe the same dashboard display defect from two angles.

This is a precision-over-recall outcome: zero false merges (good — the CLU-006-022 trap was avoided), but possibly under-merging on FB-11/FB-02. Flagging for review rather than treating "0 merges" as automatically correct.