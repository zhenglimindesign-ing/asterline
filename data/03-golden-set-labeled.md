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
| CLU-001 | FB-01 | High | KI-1 is a documented recurring issue; single cluster member but external evidence of recurrence |
| CLU-005 | FB-05 | High | Single item; High impact justifies High signal-strength |
| CLU-006-022 | FB-06, FB-22 | High | Two items; different issues (name mismatch vs 2FA) but both Engineering, same account (ACC-1042) — may split into two clusters after pipeline run |
| CLU-007 | FB-07 | Medium | Single item, Medium impact |
| CLU-008 | FB-08 | Medium | Single item, Medium impact |
| CLU-012-015 | FB-12, FB-15 | Medium | Two items; same account (ACC-7102); different sub-issues |
| CLU-014 | FB-14 | High | Single item; High impact (payouts on hold) |
| CLU-016 | FB-16 | High | Single item; High impact + High urgency |
| All others | FB-02,03,09,10,13,17,19,20,23,24 | See individual labels | No clustering evident; single-member clusters |

---

## Known labeling uncertainties (for rubric calibration)

1. **FB-23 impact vs urgency tension**: Impact=Low (small dollar amount) but Urgency=High (SP-8 policy commitment may have been breached). This pair tests whether the pipeline correctly distinguishes these two axes.

2. **FB-19 dimension**: Labeled Compliance because the praised element (KYB speed) is a compliance touchpoint. Praise items with dimension labels may need a separate handling path — flag for rubric discussion.

3. **CLU-006-022 cluster boundary**: FB-06 (name mismatch) and FB-22 (2FA SMS failure) are both Engineering from ACC-1042, but are distinct issues. Pipeline clustering behavior here is a test case — expected to split them.

4. **CLU-001 signal-strength**: Signal-strength=High justified by KI-1 context (documented recurring issue), not by in-dataset count (only 1 member). This creates an open design question: should signal-strength scoring be allowed to reference external context docs, or only in-dataset evidence?
