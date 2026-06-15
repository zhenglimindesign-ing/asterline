# Asterline — Taxonomy & Work Pack Schema (v1)
# Status: (proposed) on all values; [PENDING-EVIDENCE] per §8b of project-context.md
# These are first-draft values derived from the golden set labeling process.
# Treat as [FLUID] until eval results exist.

---

## Part 1: Taxonomy — Axis Definitions & Enumerations

### Axis 1: Intent
*Per-item. Answers: "should this become an action?"*
*5 values — locked in §2 pipeline skeleton*

| Value | Definition |
|---|---|
| `actionable_bug` | Describes a product behavior that doesn't match expectations; specific enough to become an engineering or operations task |
| `feature_request` | Asks for a capability or option that doesn't currently exist |
| `complaint` | Expresses dissatisfaction but isn't a direct bug report or specific feature request (often process/communication/policy-related) |
| `praise` | Positive feedback requiring no action |
| `noise` | Unrelated to the product, or lacks sufficient information to act on |

### Axis 2: Dimension
*Per-item. Answers: "who owns this?"*
*7 values — [FLUID]; derived from golden set labeling*

| Value | Definition |
|---|---|
| `Engineering` | A defect or limitation in the product's underlying functionality (code-level issue) |
| `UX` | The feature works as intended, but the interaction, presentation, or usability is poor |
| `Compliance` | Relates to how KYC/KYB/AML or account-verification policies are enforced |
| `Support Process` | An issue with support response time, workflow, or communication wording — the product feature itself may be functioning correctly |
| `Product/Roadmap` | A request for a capability that doesn't exist and would require new development |
| `Finance & Reporting` | Relates to reconciliation, report exports, fee or FX visibility |
| `Other/Uncategorized` | Doesn't fit any of the above — frequency of this label is a signal for future iteration |

### Axis 3a: Impact
*Per-item. Sub-axis of "severity". Answers: "how much damage does this cause?"*

| Value | Definition |
|---|---|
| `High` | Directly causes financial delay or loss, business process disruption, or affects multiple users / recurs |
| `Medium` | Creates significant extra work or friction but has a workaround; doesn't block the core flow |
| `Low` | Minor inconvenience; doesn't prevent completing the core task |
| `N/A` | Not applicable (praise / noise) |

### Axis 3b: Urgency
*Per-item. Sub-axis of "severity". Answers: "how soon must this be addressed?"*

| Value | Definition |
|---|---|
| `High` | Immediate time pressure exists (e.g. upcoming payment deadline, locked account), OR a stated policy commitment may have been breached and requires prompt verification |
| `Medium` | Should be addressed but no immediate time pressure |
| `Low` | Can be handled within regular iteration cadence |
| `N/A` | Not applicable (praise / noise) |

### Axis 4: Signal-strength
*Cluster-level (not per-item). Answers: "how much is this cluster worth acting on?"*
*Computed after clustering; reflects evidence count × diversity × severity distribution*

| Value | Definition |
|---|---|
| `High` | ≥2 items from different accounts, OR a single item with Impact=High |
| `Medium` | Multiple items from the same account, OR a single item with Impact=Medium |
| `Low` | A single isolated item with Impact=Low |

---

## Part 2: Work Pack Schema (v1)

### Field definitions

```json
{
  "cluster_id": "string — unique identifier for this cluster (e.g. CLU-005)",

  "cluster_members": ["array of feedback_ids that form this cluster (e.g. ['FB-01', 'FB-22'])"],

  "title": "string — concise label for the cluster's core problem; not vague ('customer complaint') and not verbatim raw_text",

  "signal_strength": "enum: High | Medium | Low",

  "intent_type": "enum: actionable_bug | feature_request | complaint | praise | noise",

  "problem_brief": "string — 2-4 sentences describing the issue with absolute UTC+0 timestamps; no relative time references",

  "key_quotes": [
    "array of ≤2 verbatim substrings from source raw_text — no paraphrasing; only the most signal-rich quotes"
  ],

  "source_refs": [
    "array of context document clause IDs (e.g. 'SP-3', 'KI-1'); [] if no matching clause exists"
  ],

  "confidence": "enum: High | Medium | Low — pipeline's classification confidence for this work pack",

  "tasks": [
    {
      "task": "string — specific, actionable description",
      "assignee_team": "string — required (e.g. 'Support Operations', 'Engineering', 'Product')",
      "priority": "enum: High | Medium | Low — required",
      "deadline": "ISO 8601 UTC string | null — populate only when explicit time pressure exists",
      "acceptance_criteria": "string — specific and verifiable; not generic ('issue resolved')"
    }
  ],

  "reply_draft": "string | null — draft customer-facing reply following TG-1 through TG-6; null when intent=noise",

  "review_flags": [
    {
      "flag": "enum: needs_human_review",
      "reason": "string — why human review is required",
      "blocks": "string — what this flag gates before it can proceed (e.g. 'reply_draft')"
    }
  ],

  "quality_flags": [
    {
      "flag": "enum: low_confidence | policy_conflict | ambiguous_timestamp | fabricated_quote | fabricated_source_ref | overpromise | tone_violation | vague_criteria | misleading_title | missing_human_review | unclear_execution_order | invalid_cluster_reference",
      "reason": "string — specific explanation"
    }
  ]
}
```

### Field rules summary

| Field | Required? | Notes |
|---|---|---|
| cluster_id | Yes | Unique per work pack |
| cluster_members | Yes | Must reference valid feedback_ids from input dataset |
| title | Yes | |
| signal_strength | Yes | Cluster-level; computed after clustering |
| intent_type | Yes | |
| problem_brief | Yes | All time references must be absolute UTC+0 |
| key_quotes | Yes | Array; [] if nothing worth quoting; max 2 items |
| source_refs | Yes | Array; [] if no context doc clause matches |
| confidence | Yes | |
| tasks | Yes | Array; [] when intent=noise or praise |
| reply_draft | Yes | null when intent=noise; string otherwise |
| review_flags | Yes | Array; [] if no review needed |
| quality_flags | Yes | Array; [] if no quality issues detected |

### Removed fields (vs. original §3 spec)
- `qa_cases[]` — removed entirely. QA test cases are written by engineers after task pickup, not at triage stage. Work packs are triage artifacts.

### Execution order when review_flags is non-empty
- `tasks[]` may proceed immediately (parallel to human review)
- `reply_draft` is blocked until the `needs_human_review` flag is cleared by a human reviewer
- The `blocks` field in each review_flag specifies exactly what is gated

---

## Part 3: Null / empty value conventions

| Situation | Use | Rationale |
|---|---|---|
| Array field with no current values | `[]` | Type consistency; safe to iterate |
| Optional non-array field not applicable | `null` | Explicit "not applicable"; distinct from "not yet filled" |
| Any field | Never `"N/A"` string | Mixes string into typed fields; runtime checks can't match reliably |
