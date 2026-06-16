# Vela Pay — Golden Set (v1)
# 20 labeled feedback items selected from the 25-item synthetic dataset
# Labels: intent / dimension / impact / urgency / source_refs
#
# Excluded from golden set (5 items):
#   FB-04 — overlaps with FB-22 (login/access theme); FB-22 is more specific
#   FB-11 — overlaps with FB-02 (amount/currency display); FB-02 is more specific
#   FB-18 — praise, overlaps with FB-17 and FB-19
#   FB-21 — too vague to label reliably (noise but no actionable signal)
#   FB-25 — praise, overlaps with FB-19
#
# Composition: 8/20 (40%) have source_refs; 12/20 (60%) are novel issues
# This ratio is intentional: tests both RAG citation AND context-absent degradation

---

## Taxonomy reference (v1)

### Intent (5 values — locked in §2)
- actionable_bug: Product behavior doesn't match expectations; specific enough to become a task
- feature_request: Asks for a capability that doesn't currently exist
- complaint: Expresses dissatisfaction; not a direct bug or feature request
- praise: Positive feedback requiring no action
- noise: Unrelated to product, or insufficient information to act on
Note: The column header in this document uses 'intent' for brevity.
The corresponding field name in the work pack schema (04-taxonomy-and-schema.md) is 'intent_type'.

### Dimension (7 values)
- Engineering: Code-level defect or limitation in product functionality
- UX: Feature works but interaction/presentation/usability is poor
- Compliance: KYC/KYB/AML enforcement and account verification
- Support Process: Response time, workflow, or communication wording issues
- Product/Roadmap: Request for a capability requiring new development
- Finance & Reporting: Reconciliation, exports, fee/FX visibility
- Other/Uncategorized: Doesn't fit above categories

### Impact (4 values — severity sub-axis, per-item)
- High: Directly causes financial delay/loss, business process disruption, or affects multiple users / recurs
- Medium: Significant friction but has workaround; doesn't block core flow
- Low: Minor inconvenience; doesn't prevent core task
- N/A: Not applicable (praise / noise)

### Urgency (4 values — severity sub-axis, per-item)
- High: Immediate time pressure, or a stated policy commitment may have been breached
- Medium: Should be addressed, but no immediate time pressure
- Low: Can be handled in regular iteration cadence
- N/A: Not applicable (praise / noise)

### Signal-strength (3 values — cluster-level, not per-item)
- High: ≥2 items from different accounts, OR single item with High impact
- Medium: Multiple items from same account, OR single item with Medium impact
- Low: Single isolated item with Low impact

---

## Labeled items

| ID | intent | dimension | impact | urgency | source_refs |
|---|---|---|---|---|---|
| FB-01 | actionable_bug | Engineering | Medium | Medium | KI-1 |
| FB-02 | actionable_bug | Finance & Reporting | Medium | Medium | — |
| FB-03 | feature_request | Product/Roadmap | Medium | Low | — |
| FB-05 | actionable_bug | Finance & Reporting | High | High | KI-4, SP-3 |
| FB-06 | actionable_bug | Engineering | High | High | — |
| FB-07 | feature_request | Product/Roadmap | Medium | Low | RM-2 |
| FB-08 | feature_request | Product/Roadmap | Medium | Low | RM-3 |
| FB-09 | feature_request | Finance & Reporting | Low | Low | — |
| FB-10 | complaint | Support Process | Low | Low | — |
| FB-12 | actionable_bug | Support Process | Medium | High | SP-4 |
| FB-13 | feature_request | Finance & Reporting | Medium | Low | — |
| FB-14 | complaint | Compliance | High | High | SP-6 |
| FB-15 | complaint | Support Process | Medium | Medium | — |
| FB-16 | actionable_bug | Support Process | High | High | SP-10 |
| FB-17 | praise | UX | N/A | N/A | — |
| FB-19 | praise | Compliance | N/A | N/A | — |
| FB-20 | noise | Other/Uncategorized | N/A | N/A | — |
| FB-22 | actionable_bug | Engineering | High | High | — |
| FB-23 | actionable_bug | Finance & Reporting | Low | High | SP-8 |
| FB-24 | feature_request | UX | Low | Low | — |

---

## Cluster groupings (v1 hypothesis — to be confirmed by pipeline)

| Cluster ID | Members | Signal-strength | Notes |
|---|---|---|---|
| CLU-001 | FB-01, FB-26, FB-27 | High | KI-1 batch-upload failure reported by three different accounts in different wording — see "Clustering positive-control items" below. Updated 2026-06-16; was a single-member hypothesis (FB-01 only) before FB-26/FB-27 were added |
| CLU-005 | FB-05 | High | Single item; High impact justifies High signal-strength |
| CLU-006-022 | FB-06, FB-22 | High | Two items; different issues (name mismatch vs 2FA) but both Engineering, same account (ACC-1042) — may split into two clusters after pipeline run |
| CLU-007 | FB-07 | Medium | Single item, Medium impact |
| CLU-008 | FB-08 | Medium | Single item, Medium impact |
| CLU-012-015 | FB-12, FB-15 | Medium | Two items; different accounts (FB-12: ACC-7102, FB-15: ACC-8847); same dimension (Support Process); different sub-issues |
| CLU-014 | FB-14 | High | Single item; High impact (payouts on hold) |
| CLU-016 | FB-16 | High | Single item; High impact + High urgency |
| CLU-028-029 | FB-28, FB-29 | High | RM-1 multi-entity feature request from two different accounts in different wording — see "Clustering positive-control items" below |
| All others | FB-02,03,09,10,13,17,19,20,23,24 | See individual labels | No clustering evident; single-member clusters |

### Clustering positive-control items (FB-26 to FB-29, added 2026-06-16)

Not part of the formal 20-item golden set above (no intent/dimension/impact/urgency labels assigned) — these four items exist solely to validate clustering's positive-merge capability, which the original 25-item set never tested (every multi-member hypothesis above is a "should this split" test, not a "should this merge" test). See docs/11-cluster-spec.md and docs/06-iteration-log.md (2026-06-16 entries) for the full reasoning, including the prior smoke test that validated the merge mechanism in isolation before these were added to the real dataset.

- FB-26, FB-27: cross-account duplicates of FB-01's KI-1 batch-upload issue, deliberately worded without reusing FB-01's phrasing, to test semantic (not lexical) duplicate detection.
- FB-28, FB-29: cross-account duplicates of an RM-1 multi-entity feature request, worded differently — second scenario type (feature_request, not actionable_bug).

---

## Known labeling uncertainties (for rubric calibration)

1. **FB-23 impact vs urgency tension**: Impact=Low (small dollar amount) but Urgency=High (SP-8 policy commitment may have been breached). This pair tests whether the pipeline correctly distinguishes these two axes.

2. **FB-19 dimension**: Labeled Compliance because the praised element (KYB speed) is a compliance touchpoint. Praise items with dimension labels may need a separate handling path — flag for rubric discussion.

3. **CLU-006-022 cluster boundary**: FB-06 (name mismatch) and FB-22 (2FA SMS failure) are both Engineering from ACC-1042, but are distinct issues. Pipeline clustering behavior here is a test case — expected to split them.

4. **CLU-001 signal-strength** *(superseded 2026-06-16)*: Originally signal-strength=High was justified by KI-1 context (documented recurring issue), not by in-dataset count (only 1 member: FB-01). This raised an open design question — should signal-strength reference external context docs, or only in-dataset evidence? Moot for this specific cluster now that FB-26/FB-27 were added as genuine cross-account duplicates of FB-01 (see "Clustering positive-control items" below) — CLU-001 now reaches High via the in-dataset "≥2 items, different accounts" path, no external-evidence reasoning required. The general design question remains open in principle for any future single-member cluster with documented external recurrence, but is no longer live for CLU-001.

5. **Classification-stage ceiling (confirmed after 4 prompt iterations, v0->v4)**: Three items remain unresolved at the classification stage, for two distinct reasons.

   Architectural (information not visible at this stage):
   - FB-01: pipeline predicts impact=High/urgency=High; golden set is Medium/Medium. The "has workaround" fact lives in KI-1 (a context doc), not in raw_text. Classification (Layer 1) has no RAG access. This is NOT expected to resolve via further prompt tuning — it is architectural. Work pack generation (Layer 2, with RAG) will surface this context in content, but will not retroactively change the Layer 1 classification label.

   Boundary ambiguity (inherent to the item, not a missing rule):
   - FB-10: pipeline predicts impact=Medium; golden set is Low (language mismatch in support reply — minor, not blocking).
   - FB-23: dimension is unstable across prompt versions, alternating between Finance & Reporting and Engineering (FX spread discrepancy touches both domains). Impact/urgency tension for this item is already documented in note #1 above.

   Decision: stop prompt iteration on these three items. Final classification-stage scores: intent 90% / dimension 90% / impact 75% / urgency 85% / overall 65%.

6. **FB-02/FB-11 — related theme, deliberately not merged**: Both are dashboard amount/currency display issues (FB-02: undisclosed FX spread in payout total; FB-11: card transaction currency mislabeled). A genuine gray area — defensible either way. Decided NOT to merge: they require different fixes (a disclosure feature vs. a display bug), and the project's clustering rule is "would the same fix resolve both," not "do these share a surface theme." Recorded as a judgment call, not a pipeline error — if a future iteration merges them, that is not automatically a regression to fix.
