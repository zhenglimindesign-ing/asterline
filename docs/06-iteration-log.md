# Asterline — Iteration Log
# Records design decisions, discovered gaps, and adjustments made during Workstream B
# (context doc authoring → synthetic feedback → golden set → taxonomy → rubric)
#
# Format: Date | What changed | Before | After | Why
# Audience: (1) Limin, as case study §3 source material; (2) case study readers
# Note: These entries cover eval DESIGN iteration (taxonomy / schema / data decisions).
#       Pipeline OUTPUT iteration (prompt changes, eval score deltas) will be logged
#       separately during the Claude Code phase and will populate case study §4.

---

Date: 2026-06-15
Chat: Vela Pay - 2
What changed: Cross-review corrections (5 fixes) before GitHub upload
Files modified: 03-golden-set-labeled.md, 04-taxonomy-and-schema.md, 05-rubric-v1.md, project-context.md

Details:
- 03: Added note clarifying 'intent' column = 'intent_type' in schema
- 04: Added `dimension` field to work pack schema (was missing, blocked Decision #13 filter)
- 04: Added known gap note — per-item impact/urgency not exposed in work pack output
- 05: Fixed R-02 fail action (removed incorrectly applied vague_criteria flag)
- 05: Added R-19 (low confidence → human review) and R-20 (reply vs policy contradiction)
- project-context.md: Patched §3 field list and §8 rubric status

Why: Pre-upload cross-review in Vela Pay - 2 found internal inconsistencies between
golden set labels, schema field definitions, and rubric items.

---

| Date | What changed | Before | After | Why |
|---|---|---|---|---|
| 2026-06-14 | Synthetic feedback schema upgraded from text-only to structured | 25 items had raw_text only; no metadata | Added: feedback_id, timestamp (UTC+0), channel, contact_email (optional), account_id (optional), raw_text | Text-only feedback couldn't support traceability (no source_refs back to specific items), couldn't test PII redaction pipeline step, and didn't reflect realistic data structure |
| 2026-06-14 | PII placement decision | PII was going to be stored in a separate submitter_email column only | PII (email, phone, account numbers) embedded in raw_text where realistic; separate contact_email column also added as metadata | §2 pipeline redaction step runs on raw_text — a separate column would never be scanned, making the redaction demo a no-op. Contact_email column is metadata only (not redacted, not exposed in output) |
| 2026-06-14 | PII redaction known limitation documented | Not yet acknowledged | Regex redaction reliably catches structured PII (email, phone, account numbers); human names are NOT caught because names have no regex pattern | This is an honest boundary of the v1 §11 [LOCK] decision (regex only). Leaving names in raw_text intentionally so the demo shows the real limitation. v2 path: NER. This will appear in case study §6 (Known Limitations) |
| 2026-06-14 | Ingest validation / discard logic scoped out of v1 | Not discussed | Documented as a known gap: v1 has no field validation or discard logic at ingest | FB-20 (missing timestamp) added as a deliberate edge case to observe pipeline behavior when required fields are absent. The observed behavior (whatever it is) becomes an iteration data point |
| 2026-06-14 | Severity axis split into Impact + Urgency | Single severity field | Two sub-fields: impact (damage level) and urgency (time pressure) | FB-23 has Low impact (small dollar amount) but High urgency (SP-8 policy commitment may be breached — needs immediate verification). A single severity score cannot represent both simultaneously. Splitting allows accurate labeling without forced trade-offs |
| 2026-06-14 | Dimension taxonomy expanded from 5 to 7 values | Engineering / Compliance / Support Process / Product-Roadmap / Finance & Reporting | Added: UX (feature works but experience is poor), Other/Uncategorized (catch-all; frequency is a signal) | Original 5 values couldn't categorize experience/presentation issues distinct from Engineering bugs. Other/Uncategorized added as a safety net — any label that falls here consistently signals a gap in the taxonomy |
| 2026-06-14 | Dataset restructured: novel issues replace over-mapped feedback | ~25/25 items (100%) mapped to known context doc clauses (SP-x / KI-x / RM-x) | 8/25 (32%) map to known clauses; 17/25 (68%) are novel issues with source_refs=[] | Original dataset was generated after the context docs, so all feedback was written to "fit" known clauses — unrealistic. Real feedback is mostly unknown issues. 60% novel in golden set (12/20) tests the RAG degradation path: what does pipeline do when no context clause matches? |
| 2026-06-14 | qa_cases[] field removed from §3 work pack schema | qa_cases[] present; scoped to Engineering bugs only | Field removed entirely | Work packs are triage artifacts. QA test cases are written by engineers after they receive a task — generating them at triage stage is premature and outside the tool's scope. Removed to simplify schema and avoid generating content that won't be used |
| 2026-06-14 | tasks[] field schema expanded | tasks[]: task + acceptance_criteria only | Added: assignee_team (required), priority (required, enum), deadline (optional, ISO 8601 UTC) | Missing ownership and priority made work packs insufficient for real ticket routing. Without assignee_team, a work pack can't be handed off. Without priority, triage value is lost |
| 2026-06-14 | review_flags[] split into review_flags[] + quality_flags[] | Single array mixing process flags, data quality flags, and confidence flags | review_flags[]: process flags only (needs_human_review + blocks field); quality_flags[]: data quality + pipeline confidence flags | Mixed flag types served different consumers. Process flags go to human reviewer for action. Quality flags go to runtime checker / eval scorer. Merging them made automated matching unreliable and made the output harder to parse |
| 2026-06-14 | cluster_id and cluster_members[] added to §3 schema | No field linking a work pack back to its source feedback items | cluster_id (string) + cluster_members[] (array of feedback_ids) | §0 requires traceability as a core visible capability. source_refs[] only traces to context document clauses — not to the raw feedback items that constitute the cluster. Without cluster_members[], it's impossible to verify "which customer said this" from a work pack |
| 2026-06-14 | confidence field added to §3 schema | No field recording pipeline classification confidence | confidence (enum: High / Medium / Low) at work pack level | §4 HITL lists low-confidence clusters as a review trigger. Without a stored confidence value, this trigger had no data to evaluate — the rule existed but couldn't be enforced |
| 2026-06-14 | RAG degradation behavior defined | No stated behavior when source_refs=[] | When source_refs=[], reply_draft must acknowledge the gap plainly — must NOT fabricate policy clauses or invent SP-x references | Confirmed via FB-03 worked example. Implements §6 principle: "degrades gracefully without context." Now encoded as rubric item R-12 |
| 2026-06-14 | noise intent handling defined for work pack output | No defined pipeline behavior for intent=noise | noise → minimal work pack: title + problem_brief only; reply_draft=null; tasks=[]; key_quotes=[] | "No generation" loses the audit trail — a noise item that disappears from the system can't be verified as triaged. Minimal work pack preserves traceability while generating no wasted content. Encoded as rubric items R-13, R-14, R-15 |
| 2026-06-14 | Null/empty value conventions unified | [] and null used inconsistently; "N/A" used as a string in some label drafts | [] for empty arrays; null for optional non-array fields that don't apply; "N/A" string never used | Runtime checks require consistent types. Mixing string "N/A" into array or enum fields makes automated matching fail silently |

---

## Open questions (not yet resolved — will surface during Claude Code eval phase)

| # | Question | Context |
|---|---|---|
| OQ-1 | Should signal-strength scoring be allowed to reference external context docs (e.g. KI-1 says "recurring"), or only in-dataset evidence? | CLU-001 has 1 member in dataset but is labeled High because KI-1 documents recurrence externally |
| OQ-2 | Should FB-06 (name mismatch) and FB-22 (2FA SMS) cluster together (both Engineering, ACC-1042) or split? | Pipeline will produce a result; the result is the answer |
| OQ-3 | Should impact and urgency have a combined "Critical" shorthand for High+High cases? | FB-05 and FB-16 are both High+High; rubric currently treats them identically but they may warrant different handling |
| OQ-4 | Praise items labeled with a dimension (e.g. FB-19: praise + Compliance) — does dimension have meaning for non-actionable intents? | Affects whether rubric should require dimension for praise/noise or allow null |
