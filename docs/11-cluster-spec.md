# Stage 5 — Clustering Spec (draft for review)

## Approach

**Single LLM call, global clustering** — not pairwise comparison, not embeddings/vector similarity.

Why:
- Project decision (project-context.md §1, Decision #10) rules out a vector DB in v1. The same "keep it explainable, no opaque similarity scores" principle applies here.
- Pairwise comparison (25 items = 300 pairs) is expensive and error-prone — early pairing mistakes cascade into later ones.
- A single call that sees all 25 items at once can reason about the whole picture and produce one coherent set of groupings with stated reasoning per cluster — this keeps the output auditable, consistent with the project's traceability goal (§0).

The model receives, for each item: `feedback_id`, `intent_type`, `dimension`, `account_id`, and the (PII-redacted) `raw_text`. It returns cluster assignments plus a one-line reason per cluster.

## Clustering rule (what counts as "same cluster")

**Primary signal: items describe the same underlying problem or request.**

Explicitly NOT sufficient on their own:
- Same `account_id` — two items from the same account can be two unrelated problems (this is exactly what CLU-006-022 tests: FB-06 "name mismatch" and FB-22 "2FA SMS failure" are both Engineering, same account, but different problems — they must NOT be merged).
- Same `dimension` — two items can share a dimension and still be unrelated (e.g. two different Engineering bugs).

A cluster is justified when items would be resolved by the *same fix* or answered by the *same reply* — i.e. an engineer or support agent reading both would say "this is one ticket, not two."

### Merge threshold varies by intent_type (revised after review, 2026-06-16)

The cost of a wrong merge differs by intent_type, so the merge standard differs too:

- **actionable_bug, feature_request, complaint** — these become differentiated tasks and replies. A wrong merge misroutes work or conflates unrelated fixes. Apply the "same underlying problem" rule strictly.
- **praise, noise** — these generate no tasks (`tasks=[]`) and carry no differentiated urgency. There is nothing to misroute, so there is no cost to merging on intent_type alone rather than topic. All `praise` items merge into one cluster; all `noise` items merge into one cluster. The goal for these two types is reducing reading volume, not topic precision.

Earlier draft of this spec said praise/noise "almost always form singletons" — that was wrong. The original reasoning (low probability of two items praising the exact same thing) answered the wrong question. The actual question is "what does clustering cost/buy for this intent_type," and for praise/noise the answer is: bulk merging loses nothing (no action depends on topic granularity) and gains reading-volume reduction, which is the stated purpose of clustering for these types.

Every item must end up in exactly one cluster, including singletons — no item is dropped.

## Known data inconsistency (fixed)

The golden set's cluster hypothesis table described CLU-012-015 (FB-12, FB-15) as "same account (ACC-7102)". Source data shows FB-12 is `ACC-7102 (Fieldwork Agency)` and FB-15 is `ACC-8847 (Little Bay Goods)` — different accounts. The shared signal is actually `dimension=Support Process`, not account. Corrected in `data/03-golden-set-labeled.md` (2026-06-16) — this was a documentation error, not a scoring label, so fixing it carries no risk to existing eval results.

## Signal-strength computation (deterministic, not LLM)

Computed in Python after clustering, per `eval/04-taxonomy-and-schema.md` Axis 4:
- `High`: ≥2 items from different accounts, OR a single item with `impact=High`
- `Medium`: multiple items from the same account, OR a single item with `impact=Medium`
- `Low`: a single isolated item with `impact=Low`

This is a fixed rule over cluster membership + account_ids + impact values from the classification output — no model call needed, fully auditable.

## Output schema

```json
{
  "clusters": [
    {
      "cluster_id": "CLU-001",
      "cluster_members": ["FB-01"],
      "reason": "single item, no other feedback describes batch upload failure",
      "signal_strength": "High"
    }
  ]
}
```

## Scale limit and upgrade trigger

The single-call approach has only been exercised at 25-29 items. It has not been validated at the scale the product's input design implies (project-context.md §1 Decision #5: paste / CSV upload / built-in data pack — a real CSV upload could be hundreds of rows).

A controlled smoke test (pipeline/smoke_test_cluster.py, 4 hand-built items, isolated from the real dataset) confirmed the mechanism CAN merge genuine cross-account duplicates and correctly avoids false merges. This rules out a structural defect in the judgment logic itself. What remains untested is whether that same judgment quality holds when many items are reasoned about in one call — the likely failure mode is degraded recall (missing true duplicates among many candidates), not a hard context-window limit (Haiku's context window comfortably fits hundreds of short feedback items; the risk is attention/reasoning quality over many simultaneous comparisons, which is an empirical question, not a token-counting one).

**Decision: do not build a two-stage architecture (candidate blocking + judgment) now.** Reasons:
- Cannot be validated without a large stress-test dataset that does not yet exist — building it now would trade one unverified assumption (single-call doesn't scale) for another (the blocking step works), without closing the loop.
- A blocking step based on embeddings/vector similarity would reopen project-context.md §1 Decision #10 (`[LOCK]`: no vector DB in v1) — out of scope for this stage without explicit reconsideration of that lock.
- The current architecture is already cleanly decomposed (PII redaction, classification, the judgment prompt, the deterministic signal_strength rule are all independent modules). Adding a candidate-generation step later is additive — insert one new function before the existing judgment call — not a rewrite. Deferring does not create meaningful technical debt.

**Guard rail implemented instead** (`pipeline/cluster.py`, `MAX_SINGLE_CALL_ITEMS = 50`): if input exceeds this threshold, the pipeline raises `ClusteringScaleError` rather than silently producing degraded results. The threshold is a conservative placeholder, not calibrated.

**Upgrade trigger** (mirrors the pattern already used in project-context.md §1 Decision #10 and the §6 stress-test arm): build and run a synthetic stress test with 100+ items containing a known number of true-positive duplicate pairs. If single-call clustering recovers fewer than 90% of those known pairs, build the two-stage architecture. Do not raise `MAX_SINGLE_CALL_ITEMS` without running this test first.

## Test checkpoints (compare against golden set hypothesis after running)

- CLU-006-022 (FB-06, FB-22): expected to SPLIT into two singleton clusters.
- CLU-012-015 (FB-12, FB-15): hypothesis says merge; account mismatch noted above — watch whether the model merges on dimension grounds anyway.
- All other multi-member hypotheses (CLU-005, CLU-007, CLU-008, CLU-014, CLU-016) are single-member per golden set — should remain singleton.
