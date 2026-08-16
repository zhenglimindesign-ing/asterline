# Asterline — Eval Rubric (v1)
# 21 items: 20 derived from 3 worked examples (FB-05, FB-03, FB-20), plus R-21 added during generation-stage iteration
# Each item: field checked / check (yes/no) / mode / fail action
#
# Mode:
#   Auto = programmatic runtime check (all 14 run on evaluated Vela output;
#          the public API runs the context-independent subset until uploaded
#          context documents have a defined clause schema)
#   Human = offline eval only (requires human judgment; not automated in v1)
#
# Auto items (14): R-01, R-02, R-03, R-04, R-06, R-08, R-09, R-13, R-14, R-15, R-16, R-17, R-19, R-21
# Human items (7): R-05, R-07, R-10, R-11, R-12, R-18, R-20
#
# Fail actions:
#   hard_fail = work pack flagged as incomplete; blocked from export until resolved
#   quality_flag = quality_flags[] entry added with the named flag value
#   auto_fix = automated correction applied + quality_flag added

---

## R-01 — Absolute timestamps
- **Field(s)**: problem_brief, key_quotes[], reply_draft
- **Check**: All time references are absolute UTC+0 timestamps — no relative expressions ("6 days ago", "yesterday", "last week", "recently")
- **Mode**: Auto (regex: detect relative time expressions)
- **Fail action**: quality_flag: ambiguous_timestamp

## R-02 — Quote count limit
- **Field(s)**: key_quotes[]
- **Check**: Array length ≤ 2
- **Mode**: Auto (array length check)
- **Fail action**: auto_fix (truncate to 2 most recent)

## R-03 — Quote verbatim fidelity
- **Field(s)**: key_quotes[]
- **Check**: Each quote is a verbatim substring of its source feedback's raw_text — no paraphrasing, no summarizing
- **Mode**: Auto (string containment check against source raw_text)
- **Fail action**: quality_flag: fabricated_quote

## R-04 — Task field completeness
- **Field(s)**: tasks[]
- **Check**: Each task object contains assignee_team (non-null), priority (valid enum), and acceptance_criteria (non-empty string)
- **Mode**: Auto (field presence + type check)
- **Fail action**: hard_fail

## R-05 — Acceptance criteria specificity
- **Field(s)**: tasks[].acceptance_criteria
- **Check**: Criteria is specific and verifiable — not generic ("issue resolved", "problem fixed", "customer informed")
- **Mode**: Human
- **Fail action**: quality_flag: vague_criteria

## R-06 — review_flags blocks field
- **Field(s)**: review_flags[]
- **Check**: When needs_human_review flag is present, the blocks field is populated and contains a valid field name
- **Mode**: Auto (field presence check)
- **Fail action**: quality_flag: unclear_execution_order

## R-07 — Human review trigger
- **Field(s)**: review_flags[]
- **Check**: When reply_draft addresses money amounts, payment timing, or a potential policy breach (any SP-x clause), needs_human_review flag is present
- **Mode**: Human
- **Fail action**: quality_flag: missing_human_review

## R-08 — No banned filler phrases (TG-1)
- **Field(s)**: reply_draft
- **Check**: reply_draft contains none of the following: "sorry for the inconvenience", "sorry for any inconvenience", "thank you for your patience", "as quickly as possible", "we apologize for", "we're sorry to hear"
- **Mode**: Auto (banned phrase list match, case-insensitive)
- **Fail action**: quality_flag: tone_violation

## R-09 — Money/timing first (TG-5)
- **Field(s)**: reply_draft
- **Check**: When intent = actionable_bug or complaint AND source_refs includes an SP-x clause, the first sentence of reply_draft directly references the transaction, amount, or timing issue (contains a transaction ref, amount, or date)
- **Mode**: Auto (first-sentence scan for transaction/amount/date tokens)
- **Fail action**: quality_flag: tone_violation

## R-10 — No blame-shifting (TG-3)
- **Field(s)**: reply_draft
- **Check**: reply_draft contains no language that implies the user made a mistake (e.g. "you entered", "you provided incorrect", "due to your error")
- **Mode**: Human
- **Fail action**: quality_flag: tone_violation

## R-11 — No overpromising (TG-6)
- **Field(s)**: reply_draft
- **Check**: reply_draft only commits to outcomes within Vela Pay's direct control — no promises about partner bank timelines, external processor behavior, or outcomes explicitly marked as uncontrollable in SP-3
- **Mode**: Human
- **Fail action**: quality_flag: overpromise

## R-12 — No fabricated source references
- **Field(s)**: reply_draft, source_refs[]
- **Check**: When source_refs = [], reply_draft contains no references to specific policy clauses, SP-x numbers, or stated company commitments — it must acknowledge the gap plainly rather than inventing a policy
- **Mode**: Human
- **Fail action**: quality_flag: fabricated_source_ref
- **Implementation note**: a narrower Auto sub-check runs on the evaluated Vela path — if source_refs[] is non-empty, each cited clause ID is verified against the context doc and flagged `fabricated_source_ref` if not found. This automates the "does the ID exist" case only; full R-12 compliance (does the *content* match the clause) still requires human judgment. Arbitrary live uploads defer this check until a context schema exists. See `docs/13-workpack-spec.md`.

## R-13 — Noise: reply_draft must be null
- **Field(s)**: intent_type, reply_draft
- **Check**: When intent_type = noise, reply_draft = null
- **Mode**: Auto
- **Fail action**: hard_fail

## R-14 — Noise: tasks must be empty
- **Field(s)**: intent_type, tasks[]
- **Check**: When intent_type = noise, tasks = []
- **Mode**: Auto
- **Fail action**: hard_fail

## R-15 — Noise: key_quotes must be empty
- **Field(s)**: intent_type, key_quotes[]
- **Check**: When intent_type = noise, key_quotes = []
- **Mode**: Auto
- **Fail action**: hard_fail

## R-16 — cluster_members validity
- **Field(s)**: cluster_members[]
- **Check**: Every feedback_id in cluster_members[] exists in the input dataset
- **Mode**: Auto (reference check against input)
- **Fail action**: quality_flag: invalid_cluster_reference

## R-17 — confidence field populated
- **Field(s)**: confidence
- **Check**: confidence field contains a valid enum value (High | Medium | Low)
- **Mode**: Auto
- **Fail action**: hard_fail (required field)

## R-18 — Title accuracy
- **Field(s)**: title
- **Check**: Title accurately reflects the cluster's core problem — not vague ("customer complaint", "user issue") and not a verbatim raw_text sentence
- **Mode**: Human
- **Fail action**: quality_flag: misleading_title

## R-19 — Low confidence must trigger human review
- **Field(s)**: `confidence`, `review_flags[]`
- **Check**: When `confidence = Low`, `review_flags[]` must contain a `needs_human_review` entry
- **Mode**: Auto
- **Fail action**: `quality_flag: low_confidence`

## R-20 — Reply draft must not contradict cited policy clauses
- **Field(s)**: `reply_draft`, `source_refs[]`
- **Check**: When `source_refs` is non-empty, `reply_draft` must not make commitments
  that contradict the cited SP-x clause (e.g., promising a specific settlement date
  when the relevant SP clause states partner bank timelines are outside Vela Pay's control)
- **Mode**: Human
- **Fail action**: `quality_flag: policy_conflict`

## R-21 — No internal clause IDs in reply_draft
- **Field(s)**: `reply_draft`
- **Check**: reply_draft contains no raw clause ID references (e.g. "(SP-4)") — internal identifiers must be expressed in plain language for customer-facing text
- **Mode**: Auto (regex: detect clause ID patterns)
- **Fail action**: `quality_flag: internal_ref_in_reply`
- Added during generation-stage iteration (informally referred to as R-PA before being given a formal number); see `pipeline/runtime_checks.py`.

---

## Rubric summary by mode

| Mode | Items | Notes |
|---|---|---|
| Auto (runtime) | R-01, R-02, R-03, R-04, R-06, R-08, R-09, R-13, R-14, R-15, R-16, R-17, R-19, R-21 | All 14 run on evaluated Vela output; live arbitrary-context runs defer R-09/R-21 until a context schema exists |
| Human (offline) | R-05, R-07, R-10, R-11, R-12, R-18, R-20 | These 7 require human judgment; scored during offline eval against golden set |

## Rubric summary by fail severity

| Severity | Items | Effect |
|---|---|---|
| hard_fail | R-04, R-13, R-14, R-15, R-17 | Work pack blocked from export; must be resolved |
| quality_flag only | All others, incl. R-19, R-20, R-21 | Work pack exported with flag; reviewer decides next action |
