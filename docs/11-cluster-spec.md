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

`praise` and `noise` items are expected to form singleton clusters in almost all cases — there is rarely a second item describing "the same compliment" or "the same noise." The golden set's hypothesis table confirms this (FB-17, FB-19, FB-20 are all single-member).

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

## Test checkpoints (compare against golden set hypothesis after running)

- CLU-006-022 (FB-06, FB-22): expected to SPLIT into two singleton clusters.
- CLU-012-015 (FB-12, FB-15): hypothesis says merge; account mismatch noted above — watch whether the model merges on dimension grounds anyway.
- All other multi-member hypotheses (CLU-005, CLU-007, CLU-008, CLU-014, CLU-016) are single-member per golden set — should remain singleton.
