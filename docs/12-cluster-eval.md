# Stage 5 — Cluster Evaluation Report

Run: cluster-v3 | Model: claude-haiku-4-5-20251001 | Generated: 2026-06-16T12:53:56.109421+00:00

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
| FB-17 | singleton-FB-17 | CLU-017 | merged-when-hypothesis-split |
| FB-18 | (excluded from golden set) | CLU-017 | not in golden set |
| FB-19 | singleton-FB-19 | CLU-017 | merged-when-hypothesis-split |
| FB-20 | singleton-FB-20 | CLU-018 | merged-when-hypothesis-split |
| FB-21 | (excluded from golden set) | CLU-018 | not in golden set |
| FB-22 | CLU-006-022 | CLU-019 | split-when-hypothesis-merged |
| FB-23 | singleton-FB-23 | CLU-020 | exact match |
| FB-24 | singleton-FB-24 | CLU-021 | exact match |
| FB-25 | (excluded from golden set) | CLU-017 | not in golden set |
| FB-26 | CLU-001 | CLU-001 | exact match |
| FB-27 | CLU-001 | CLU-001 | exact match |
| FB-28 | CLU-028-029 | CLU-022 | exact match |
| FB-29 | CLU-028-029 | CLU-022 | exact match |

## Category counts

| Category | Count |
|---|---|
| exact match | 17 |
| not in golden set | 5 |
| split-when-hypothesis-merged | 4 |
| merged-when-hypothesis-split | 3 |

## Key checkpoint: CLU-006-022 (FB-06, FB-22)

FB-06 actual cluster: CLU-006  |  FB-22 actual cluster: CLU-019

**Result: SPLIT, as expected.** The clustering correctly distinguished the name-mismatch issue (FB-06) from the 2FA issue (FB-22) despite both being Engineering items from the same account.

## Positive-merge checkpoint: FB-01/FB-26/FB-27 and FB-28/FB-29

The original 25-item dataset had no unambiguous "should merge" case — every multi-member hypothesis tested whether clustering correctly avoided a false merge, never whether it could perform a true one. FB-26 to FB-29 were added specifically to close this gap (see data/03-golden-set-labeled.md, "Clustering positive-control items").

**Result: PASS on both scenarios.**
- FB-01 + FB-26 + FB-27 (three different accounts, same KI-1 batch-upload root cause, deliberately worded without reusing each other's phrasing) merged correctly into one cluster. `signal_strength` computed to `High` via the "≥2 items, different accounts" path — the first time this path has fired on real pipeline output rather than the isolated smoke test.
- FB-28 + FB-29 (two different accounts, same RM-1 multi-entity feature request, different wording) merged correctly into one cluster, also `signal_strength=High` via the same path.

Combined with the earlier isolated smoke test (pipeline/smoke_test_cluster.py), this closes the asymmetry flagged earlier in this stage: the mechanism is now validated on both failure directions — avoiding false merges (CLU-006-022) and performing true merges (this checkpoint) — on the real pipeline output, not just a hand-built isolated test.

## Note on "merged-when-hypothesis-split" (FB-17, FB-19, FB-20)

These three are NOT a regression. The golden set hypothesis predates the intent_type-based merge threshold decided in this chat (docs/11-cluster-spec.md, "Merge threshold varies by intent_type"): praise items (FB-17, FB-18, FB-19, FB-25) now merge into one cluster (CLU-017) and noise items (FB-20, FB-21) merge into one cluster (CLU-018), regardless of specific topic, because these intent_types carry no differentiated action and the goal is reading-volume reduction, not topic precision. The golden hypothesis table was written before this rule existed and still reflects the old singleton-per-praise assumption — it has not been updated to match, since it documents what was decided at the time, not a moving target.

FB-12/FB-15 (split-when-hypothesis-merged) and FB-02/FB-11 (excluded items, never merged) are unchanged from the prior run — both remain correctly split under the strict bug/feature/complaint standard.