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

Date: 2026-06-16
Chat: Vela Pay-2
Run: Stage 5 — added clustering positive-control items (FB-26 to FB-29), validated on real data

Dataset change (additive only, items 01-25 untouched): added FB-26/FB-27 (cross-account duplicates of FB-01's KI-1 batch-upload issue, deliberately worded differently from FB-01 and each other) and FB-28/FB-29 (cross-account duplicates of an RM-1 multi-entity feature request, also differently worded). Not added to the formal 20-item golden labeled set — these exist solely to test clustering's positive-merge capability, which nothing in the original 25 items tested. See data/03-golden-set-labeled.md "Clustering positive-control items" and docs/11-cluster-spec.md for full rationale, including two rounds of self-critique before writing the final wording (fixed a company-name collision with existing accounts, removed verbatim phrase overlap with FB-01 that would have made the test lexical-matching rather than semantic, and corrected the original plan from "an isolated new pair" to "extend FB-01's existing singleton hypothesis into a 3-way merge," since FB-01 documents the same root cause).

Updated data/02-synthetic-feedback-25.md header stats (12/29 now map to known clauses, was 8/25) and CLAUDE.md's file inventory to reflect the new count. Re-ran classify_all.py (all 29 items classified, no errors) and cluster.py (cluster-v3, same prompt as the prior entry — no prompt change needed for this run).

Result: PASS on both scenarios.
- FB-01 + FB-26 + FB-27 merged into one cluster (exact match to the updated 3-way hypothesis). signal_strength=High via the "≥2 items, different accounts" path.
- FB-28 + FB-29 merged into one cluster (exact match to hypothesis). signal_strength=High via the same path.

This is the first time the cross-account merge path and the corresponding signal_strength=High derivation have been validated on real pipeline output (the smoke test validated the mechanism in isolation with hand-built items never added to any dataset; this validates it in the actual 29-item context with all the surrounding noise/distractor items present). Closes the asymmetry identified earlier in this stage: false-merge avoidance (CLU-006-022) and true-merge capability are now both validated on real data, not just one or the other.

Full detail in docs/12-cluster-eval.md ("Positive-merge checkpoint" section).

---

Date: 2026-06-16
Chat: Vela Pay-2
Run: Stage 5 — cluster-v3, intent_type-based merge threshold + scale guard rail

Changes made (after open debate, not unilateral — see chat for full reasoning):
- Merge threshold now varies by intent_type. actionable_bug/feature_request/complaint keep the strict "same underlying problem" standard (validated by CLU-006-022 and the smoke test). praise/noise now bulk-merge into one cluster per intent_type regardless of topic, because these types generate no tasks and carry no differentiated urgency — there is no cost to merging on intent_type alone, and the goal for these types is reading-volume reduction, not topic precision.
- Conceded: the original "praise almost always singleton" rule (cluster-v1/v2) was wrong. It answered "how likely are two praises about the exact same thing" instead of "what does clustering cost/buy for this intent_type." The corrected reasoning is in docs/11-cluster-spec.md.
- Added MAX_SINGLE_CALL_ITEMS=50 guard rail to pipeline/cluster.py — raises ClusteringScaleError above this threshold instead of silently degrading. Documented an explicit, falsifiable upgrade trigger (100+ item stress test, <90% known-duplicate recall) for when to build a two-stage candidate-generation architecture, mirroring the upgrade-trigger pattern already used for the no-vector-DB decision (project-context.md §1 Decision #10). Decided NOT to build that architecture now: it can't be validated without a large stress-test dataset that doesn't exist yet, would reopen a [LOCK] decision if built with embeddings, and the current modular structure (PII/classify/judgment-prompt/signal_strength all independent) makes it an additive change later, not a rewrite — deferring carries low technical debt.

Result (cluster-v3, same 25 items): FB-17/18/19/25 (all praise) merged into one cluster; FB-20/21 (all noise) merged into one cluster. CLU-006-022 still splits correctly. FB-12/15 still splits correctly. FB-02/11 (excluded items) still separate under the strict standard — this was an open debate (both readings defensible) resolved in favor of NOT merging, since they require different fixes (fee disclosure vs. display bug).

---

Date: 2026-06-16
Chat: Vela Pay-2
Run: Stage 5 — eval gap identified and smoke-tested

Gap identified: the 25-item dataset was authored to maximize novel/unique issues (60% novel, per the v0 dataset-restructure entry above), which means it contains zero unambiguous "different accounts, same root problem" pairs. CLU-006-022 and CLU-012-015 only test the FALSE-merge direction (should these split). Nothing in the dataset tests whether clustering can correctly MERGE when it should. Removing the praise-singleton special case (cluster-v2, see below) did not produce any new merges, which by itself is ambiguous: it could mean either (a) the rule was the only problem and removing it has no other effect, or (b) the mechanism is structurally biased toward singletons regardless of rules. Could not distinguish between these from the 25-item run alone.

Action: built pipeline/smoke_test_cluster.py — an isolated test using 4 hand-built items never added to any committed dataset (2 genuine cross-account duplicates describing the same batch-upload failure in different wording, 2 unrelated controls). Uses the same prompt and model as cluster.py.

Result: PASS. The duplicate pair merged correctly; both controls stayed separate. This confirms the clustering mechanism is capable of merging — the all-singleton result on the real 25-item dataset is a data coverage gap, not a mechanism defect.

Decision pending: whether to add 1-2 new feedback items to data/02-synthetic-feedback-25.md that are genuine cross-account duplicates of an existing known issue (e.g. two more reports of KI-1 batch-upload failure), to give the golden set hypothesis table a true positive merge case and let signal_strength=High fire via the "≥2 items, different accounts" path (currently only reachable via "single item, impact=High" in this dataset). This would be additive only — existing items 01-25 would not be modified, so all completed classification-stage eval results remain valid as-is.

---

Date: 2026-06-16
Chat: Vela Pay-2
Run: Stage 5 — clustering (cluster-v1), all 25 items

Approach: single LLM call over all 25 classified items (not pairwise, not embeddings — see docs/11-cluster-spec.md for rationale). signal_strength computed deterministically in Python per Axis 4 (eval/04-taxonomy-and-schema.md), not by the model.

Result: 25 clusters returned, all singletons. Compared against golden set hypothesis (docs/12-cluster-eval.md):
  exact match: 16
  not in golden set (5 items excluded from golden labeling): 5
  split-when-hypothesis-merged: 4 (FB-06/FB-22 and FB-12/FB-15)

Key checkpoint — CLU-006-022 (FB-06 name-mismatch vs FB-22 2FA-SMS, same account, both Engineering): SPLIT, as designed test expected. Confirms the clustering rule (same problem, not same account/dimension) holds on the adversarial case it was built to catch.

Also split: FB-12/FB-15, the golden set's other hypothesized merge. On inspection this looks like a correct split, not a miss — the items are a dispute-review delay and a missing onboarding email, sharing only dimension=Support Process. The golden set's own note already says "different sub-issues," and this hypothesis pairing's stated rationale (same account) was already corrected as a documentation error earlier in this chat (see fix: correct golden set CLU-012-015 account note).

Open question flagged, not yet resolved: zero merges occurred across all 25 items. Three pairs share a stated theme per the golden set's exclusion notes (FB-04/FB-22 login friction, FB-11/FB-02 dashboard currency display, FB-19/FB-25 fast-onboarding praise) but were not tested by a forced merge/split decision — the model never considered merging them, it produced singletons by default. FB-11/FB-02 in particular may describe the same underlying dashboard display defect from two angles and is worth a manual look. Documented in docs/12-cluster-eval.md ("Observation: all 25 clusters are singletons") rather than treated as resolved.

Bug fixed during this run: golden hypothesis table parser mis-split the "All others" row's shorthand member list (e.g. "FB-02,03,09" parsed "03" as its own id instead of "FB-03"), causing 9 items to show as "excluded from golden set" when they were actually golden-set singletons. Fixed in pipeline/cluster.py parse_golden_hypothesis().

Files: pipeline/prompts/cluster.txt, pipeline/cluster.py, pipeline/output/clusters-v1.json, docs/11-cluster-spec.md, docs/12-cluster-eval.md

---

Date: 2026-06-15
Chat: Vela Pay-2
Run: v3 → v4 (classify.txt v4 → v5, accepted)

Changes made:
- Rule 5 restored to v2 wording (reverted from failed v3)
- Rule 6 (new): few-shot impact examples added — webhook/notifications → Medium; dark mode → Low; locked account → High; B2B repeated manual work test for Low/Medium boundary

Score delta vs v2:
  intent_type:  90% → 90%  (—)
  dimension:    95% → 90%  (−5%, FB-23 dimension regression)
  impact:       70% → 75%  (+5%) ✓
  urgency:      85% → 85%  (—)
  overall:      55% → 65%  (+10%) ✓

Items fixed: FB-03, FB-07, FB-13 (all Low→Medium, now correct)
Regressions: FB-23 dimension (Finance & Reporting → Engineering, inherently ambiguous item); FB-15 (1 diff)
Decision: accept v4 as classification stage ceiling. FB-23 dimension is inherently unstable — further prompt tuning risks continued whack-a-mole. FB-01 remains architectural limit (no RAG in Layer 1).

Classification phase final scores:
  intent 90% / dimension 90% / impact 75% / urgency 85% / overall 65%

---

Date: 2026-06-15
Chat: Vela Pay-2
Run: v2 → v3 attempt (classify.txt v3, reverted — never committed)

Change attempted:
- Rule 5 replaced with 3-tier calibration: (a) blocked=High (b) significant friction at scale=Medium (c) minor convenience=Low

Result: NEGATIVE — reverted.
  impact: 70% → 60% (−10%)
  overall: 55% → 50% (−5%)
  FB-03/07/13 not improved; FB-08 and FB-15 regressed.
Root cause: tier (b) "significant extra steps at operational scale" was too broad — pulled correctly-labeled Low items up to Medium.
Decision: revert Rule 5 to v2 wording; try few-shot examples instead.

---

Date: 2026-06-15
Chat: Vela Pay-2
Run: v1 → v2 (classify.txt v2 → v3)

Changes made:
- impact Low: added "feature requests where core payment flow works without the enhancement"
- Rule 4 (new): feature_request urgency defaults to Low unless explicit deadline, business blocker, or compliance obligation stated
- Rule 5 (new): impact calibration question — can user still send, receive, reconcile without this fix?

Score delta:
  intent_type:  90% → 90%  (—)
  dimension:    90% → 95%  (+5%)
  impact:       70% → 70%  (—)
  urgency:      70% → 85%  (+15%)
  overall:      45% → 55%  (+10%)

Items fixed: FB-09 fully resolved (dimension + impact + urgency all correct)
Items unchanged: FB-01 — confirmed architectural limit (KI-1 workaround info not visible at classification stage; no RAG in Layer 1)

---

Date: 2026-06-15
Chat: Vela Pay-2
Run: v0 → v1 (classify.txt v1 → v2)

Changes made:
- noise definition: added "general yes/no inquiry with no stated use case"
- Finance & Reporting: added payment reference/memo fields, transaction labeling
- impact High: clarified "no workaround" qualifier; recurring with workaround = Medium
- Rule 1: added orthogonality example (memo field = feature_request + Finance & Reporting)
- urgency High: clarified "actively blocking this user right now" qualifier

Score delta:
  intent_type:  85% → 90%  (+5%)
  dimension:    80% → 90%  (+10%)
  impact:       65% → 70%  (+5%)
  urgency:      60% → 70%  (+10%)
  overall:      40% → 45%  (+5%)

Items fixed: FB-20 (noise correctly classified), FB-09 dimension resolved
Items not fixed: FB-01 (impact/urgency over-estimated — architectural limit)

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

---

Date: 2026-06-17
Chat: Asterline-CC (Claude Code)
Run: Stage 6 — work-pack generation, generate-v1 through generate-v4

## Stage 6 build and iteration summary

Built pipeline/generate.py (Sonnet, generate-v1) generating one work pack per cluster from clusters-v1.json + classified-25-v4.json. Full spec in docs/13-workpack-spec.md.

### generate-v1 → generate-v2: review_flag reason precision for multi-member clusters

Observation (single work pack spot-check, CLU-001): the model's auto-generated `needs_human_review` reason said "verify against ticket records before sending" — correct in intent, but didn't name the specific risk. CLU-001 merges FB-01/FB-26/FB-27 (three different accounts), so a money-state assertion ("your payments did not go out") may not hold identically for every account.

Change: added explicit prompt guidance — when a cluster has multiple members and the flag reason involves a money/payment-state assertion, name the actual risk (claim generalised across accounts may not hold for every individual member), not a generic "verify ticket records."

Outcome: CLU-001's flag reason now reads: "The reply asserts 'your payments did not go out' as a universal statement... this claim is being generalised across three separate tickets (FB-01, FB-26, FB-27) representing different accounts... each ticket should be verified against transaction records before the reply is sent."

### generate-v2 → generate-v3: R-03 whitespace false positives (code fix, not prompt change)

Discovered via full-output scan of all 22 clusters (not a spot-check): 16/22 clusters had `quality_flag: fabricated_quote`. Investigation found all were false positives from the verbatim-check code.

Root cause: the source markdown file uses mid-sentence line wraps (`\n` within paragraphs). The model correctly reads and quotes the text as a flowing sentence (space-joined), but the containment check compared against the unwrapped source — a genuine verbatim quote spanning a line-break would never match. This was not visible from spot-checking CLU-001 alone (CLU-001's quotes happened to be within a single line).

Change: normalise all whitespace (collapse `\s+` → single space) on both the source raw_text and the candidate quote before comparison.

Outcome: 16/22 false positives cleared. 2 genuine fabricated_quote flags remain (CLU-007, CLU-016 — model paraphrased instead of quoting verbatim). No prompt change needed; the check itself was wrong, not the model.

Also in this pass: implemented R-06 deterministic check (review_flags `blocks` field presence), which had been listed as an Auto check in the rubric but never actually added to the code. No failures detected on this run — the model had been populating the field correctly — but the safety net was missing.

### generate-v3 → generate-v4: clause-ID regex false positives for TG/RM (code fix)

Discovered via full-output scan: CLU-020 had `quality_flag: fabricated_source_ref` for TG-2 and TG-5, both genuine clauses in the context doc.

Root cause: context doc uses two different bold-markdown formats:
- SP/KI: `**SP-1.** Description...` (bold closes after ID + period)
- TG/RM: `**TG-2. Full title.**` (bold spans full title; `**` does not follow the period)

The clause-ID extraction regex required `**` after the period (`\*\*(ID)\.\*\*`), which matched SP/KI but never matched TG/RM. All 10 TG/RM clause IDs were invisible to the validity check, causing any model citation of them to be flagged as fabricated.

Change: dropped the `\*\*` requirement after the period — regex now captures ID before the period only (`\*\*(ID)\.`). Verified all 24 clause IDs (SP-1..10, TG-1..6, KI-1..4, RM-1..4) are now parsed correctly.

Outcome: fabricated_source_ref flags cleared for all valid clause citations. Final quality flag tally: 8 real flags across 5 clusters (ambiguous_timestamp × 3, tone_violation × 3, fabricated_quote × 2).

## Stage 6 final state (generate-v4)

22/22 clusters generated. 0 hard_fail. Auto rubric checks (R-01–R-04, R-06, R-08–R-09, R-13–R-17, R-19) all running. Remaining quality flags are real signals for human review, not code bugs.

Human-mode rubric items (R-05, R-07, R-10, R-11, R-12, R-18, R-20) pending offline eval by Limin — see pipeline/output/workpacks-v1.md.
