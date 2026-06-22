# Asterline — Case Study
# Status: Sections 1–6 complete through Stage 7 (human eval, generate-v9).
# Section 7 (Appendix) pending — needs deploy links.
# Language: English

---

## 1. Problem & Context

Product teams drown in feedback. Support tickets, app reviews, NPS responses, and sales call notes arrive in different formats, at different times, and with wildly different levels of specificity. The signal is there — but extracting it, grouping it, and turning it into something an engineer or PM can actually act on takes time that small teams rarely have.

Asterline is a feedback intelligence tool that turns raw, unstructured user feedback into traceable, ready-to-work product packs. A work pack is a structured artifact containing a problem summary, key evidence quotes (with links back to source items), a suggested task with acceptance criteria and assignee team, a draft customer reply, and flags for human review where the stakes are high enough to warrant it.

The tool is designed for small product teams and indie builders — anyone who regularly digests user feedback and needs to move from signal to action without a dedicated ops function to support them.

**Why this project matters for AI PM / TPM roles.** Building a feedback tool is not the point. The point is demonstrating three specific capabilities that are central to AI product work:

1. **Eval design** — defining what "good" looks like before generating at scale, using a golden set, a taxonomy, and a rubric with both automated and human-judgment components.
2. **Iteration** — running the pipeline, measuring against the rubric, finding where it fails, changing something, and measuring again. The before/after record is the evidence.
3. **Traceability** — every work pack output can be traced back to specific raw feedback items and, where applicable, specific policy or product clauses. Nothing is generated without a source.

The demo uses a synthetic product (Vela Pay, a B2B stablecoin payments platform) with authored context documents, synthetic feedback, and a hand-labeled golden set. All data is synthetic; the eval process is real.

---

## 2. Approach

### 2.1 Pipeline

The core pipeline runs in sequence:

```
ingest
  → PII redaction            (regex; runs before any quote extraction)
  → intent classification    (actionable_bug / feature_request / complaint / praise / noise)
  → dimension + severity tagging  (dimension: 7 values; severity: impact × urgency)
  → clustering               (group items describing the same underlying issue)
  → signal-strength scoring  (per cluster: how much evidence, how diverse, how severe)
  → work pack generation     (one work pack per cluster)
  → runtime checks           (automated subset of rubric runs on every output)
  → export                   (Markdown for humans + JSON in Jira/Linear-shaped format)
```

Intent and dimension are orthogonal axes: intent answers "should this become an action?"; dimension answers "who owns it?" This separation allows the same complaint about a delayed payout (intent: complaint) to be routed to Support Process, Finance & Reporting, or Engineering depending on its nature.

### 2.2 Key design decisions

**RAG without a vector database (v1).** The four Vela Pay context documents (product one-pager, support policy, tone guideline, known issues / roadmap) are stuffed directly into the generation prompt rather than indexed. Each generated reply cites a specific clause ID (e.g. SP-3, KI-1) when one applies. The upgrade trigger is documented: if context docs grow beyond ~4 documents or ~8,000 tokens, vector retrieval becomes necessary. For v1 demo purposes, direct stuffing is sufficient and avoids infrastructure complexity.

**Regex PII redaction (v1 known limitation).** Structured PII — email addresses, phone numbers, transaction reference numbers — is caught by regex and replaced before any text is extracted for quotes or reply drafts. Human names and company names are not reliably caught by regex and are not redacted in v1. This is an honest scope boundary, not an oversight: the demo data is synthetic, and the limitation is documented as a v2 candidate (introducing NER-based redaction).

**Human-in-the-loop at two positions, blocking at one.** Three HITL touchpoints exist: (1) after clustering, before generation — users can edit, merge, or split clusters (advisory, non-blocking); (2) before export — items flagged `needs_human_review` require human confirmation before the reply draft is released (blocking, but only for flagged items); (3) after generation — users can edit the work pack before export (advisory). Blocking review is reserved for the highest-cost scenarios: money-touching or timing-sensitive replies, and low-confidence clusters.

**Severity as two axes (impact × urgency).** A single severity score cannot distinguish between a high-impact event with no time pressure (a known bug affecting reconciliation) and a low-impact event with immediate urgency (a potential policy breach on a small transaction). Splitting severity into impact and urgency allows the pipeline to correctly label both without forcing a comparison between incommensurable cases.

### 2.3 Demo setup

The demo uses Vela Pay, a synthetic B2B stablecoin payments platform, as its product context. Four context documents were authored to support RAG citation:

- **Product one-pager**: features, pricing, out-of-scope items
- **Support policy (SP-1 through SP-10)**: refund rules, dispute SLAs, KYC/KYB thresholds, account recovery
- **Tone & voice guideline (TG-1 through TG-6)**: communication principles with positive/negative examples
- **Known issues & roadmap (KI-1 through KI-4, RM-1 through RM-4)**: documented bugs and planned features

25 synthetic feedback items were authored across five channels (support tickets, email, app reviews, feature request forms, survey responses), with realistic metadata (timestamp UTC+0, contact email, account ID) and embedded PII in raw_text where channel-appropriate. The dataset is intentionally skewed toward novel issues (68%) with a minority matching known context doc clauses (32%), reflecting realistic feedback distribution.

---

## 3. Eval Design

### 3.1 Taxonomy

The taxonomy has four axes. All values are [FLUID] (derived from golden set labeling; expected to evolve through eval iteration).

**Intent** (5 values, pipeline-locked): `actionable_bug`, `feature_request`, `complaint`, `praise`, `noise`

**Dimension** (7 values): `Engineering`, `UX`, `Compliance`, `Support Process`, `Product/Roadmap`, `Finance & Reporting`, `Other/Uncategorized`

**Severity** (two sub-axes, per item):
- Impact: `High`, `Medium`, `Low`, `N/A`
- Urgency: `High`, `Medium`, `Low`, `N/A`

**Signal-strength** (3 values, cluster-level): `High`, `Medium`, `Low`

The split of severity into impact × urgency was a mid-process discovery: a single severity score could not correctly handle FB-23 (Low impact, small dollar amount — but High urgency, because a stated policy commitment on FX spread appeared to have been breached). This kind of discovery — where a labeling problem reveals a taxonomy gap — is typical of why the golden set is built before mass generation rather than after.

### 3.2 Golden Set

20 items selected from the 25-item synthetic dataset. Excluded: 2 items with high thematic overlap with retained items, 2 praise items that added no new dimension coverage, 1 item too vague to label reliably.

**Composition:**
- 40% (8/20) have source_refs pointing to known context doc clauses — tests RAG citation behavior
- 60% (12/20) are novel issues with source_refs=[] — tests RAG degradation (what the pipeline does when no clause matches)
- 3 items with Impact=High + Urgency=High — tests HITL trigger conditions
- 2 praise items, 1 noise item — tests non-actionable intent handling
- 1 item with a missing timestamp (FB-20) — tests ingest validation edge case

### 3.3 Rubric

20 rubric items derived inductively from three worked examples (FB-05: Critical actionable bug with source refs and HITL trigger; FB-03: feature request with no source match; FB-20: noise), with two added during generation-stage iteration (R-19, R-20). Each item specifies the field checked, the yes/no check, the evaluation mode, and the failure action.

**14 automated items (runtime checks):** timestamp format (R-01), quote count (R-02), quote verbatim fidelity (R-03), task field completeness (R-04), review_flags blocks field (R-06), banned filler phrases (R-08), money/timing first sentence (R-09), noise: null reply (R-13), noise: empty tasks (R-14), noise: empty quotes (R-15), cluster_members validity (R-16), confidence field (R-17), source_ref validity (R-19), clause IDs in reply_draft (R-PA).

**7 human-judgment items (offline eval):** acceptance criteria specificity (R-05), human review trigger (R-07), no blame-shifting (R-10), no overpromising (R-11), no fabricated source references (R-12), title accuracy (R-18), reply vs policy contradiction (R-20).

Hard-fail items (block export): R-04, R-13, R-14, R-15, R-17. All others add quality flags but allow export with review.

---

## 4. Iteration Log

Full entry-by-entry log: `docs/06-iteration-log.md`. Four examples below, chosen to show different kinds of iteration — a clean prompt fix, a failed attempt that was reverted, a corrected design assumption, and an eval-design gap that required new data rather than a new prompt.

### 4.1 Classification: noise misclassification (v0 → v1)

**Before:** FB-20 ("does this support apple pay? just curious, not urgent") was classified as `feature_request`. Golden label: `noise`. The v0 prompt's noise definition didn't cover general yes/no product-capability questions with no stated use case.

**What changed:** Added an explicit clause to the `noise` definition: "a general yes/no inquiry about a product capability... with no stated use case or context." Prompt only — no taxonomy or pipeline change.

**After:** FB-20 correctly classified as `noise`. Side effect: dimension accuracy also improved (+10%) because several other intent corrections cascaded into correct dimension labels.

### 4.2 Classification: a fix that made things worse, and was reverted (v2 → v3 attempt)

**Before:** impact accuracy was 70% after v2. Three feature-request items (FB-03, FB-07, FB-13) were under-scored as `Low` when golden set said `Medium`.

**What changed:** Replaced the impact-calibration rule with a 3-tier decision tree (blocked=High / friction-at-scale=Medium / minor=Low).

**After:** impact accuracy dropped to 60% (−10%) and overall accuracy dropped to 50% (−5%). The "friction at scale" tier was too broad — it pulled correctly-labeled `Low` items up to `Medium`, including two that had been correct in v2. **Reverted.** Replaced instead with few-shot examples illustrating the Low/Medium boundary, which raised impact to 75% without the regression. The failed attempt's eval output was kept (`docs/eval-results-v3-reverted.json`) rather than deleted, specifically so this example could be written up.

### 4.3 Clustering: a design assumption that didn't survive scrutiny (cluster-v1/v2 → v3)

**Before:** the clustering prompt told the model that praise and noise items "almost always form singleton clusters," reasoning that two items praising the exact same thing is statistically unlikely in a small sample. Result: zero merges occurred anywhere in the dataset, including two praise items (FB-19, FB-25) that both specifically praised fast KYB/onboarding.

**What changed:** the underlying reasoning was challenged directly — clustering's purpose for praise/noise isn't "deduplicate specific complaints," it's "reduce reading volume," because these intent types generate no differentiated tasks. The rule was rewritten: actionable types (bug/feature/complaint) keep a strict same-problem standard; praise and noise bulk-merge into one cluster each, regardless of topic, because there is no cost to a coarse merge when nothing downstream depends on topic precision.

**After:** all praise items merged into one cluster, all noise items merged into one cluster, while the adversarial test case (CLU-006-022 — two different Engineering bugs from the same account) still correctly split. The original assumption wasn't a coding bug; it answered the wrong question.

### 4.4 Eval design itself had a gap: the dataset couldn't test merging

**Before:** clustering had been validated only on its ability to avoid false merges (CLU-006-022). Nothing in the 25-item dataset was an unambiguous "these should merge" case — every multi-member hypothesis was a should-this-split test. Removing the praise/noise special case (4.3) produced zero new merges, which was ambiguous evidence: either the rule fix had no other effect, or the merging mechanism itself was structurally biased toward singletons.

**What changed:** built an isolated smoke test (`pipeline/smoke_test_cluster.py`) with 4 hand-built items never added to any committed dataset — confirmed the mechanism could merge genuine duplicates in isolation. Then added two real positive-control pairs to the dataset itself: FB-26/FB-27 (a third and second report of FB-01's known batch-upload issue, deliberately worded without reusing FB-01's phrasing) and FB-28/FB-29 (a feature-request duplicate, different scenario type). This was a data change, not a prompt change — the gap was in what the eval could test, not in pipeline behavior.

**After:** FB-01 + FB-26 + FB-27 merged into one cluster on the real 29-item pipeline run (not just the isolated test), with `signal_strength` correctly computed as `High` via the "≥2 items, different accounts" path — the first time that code path fired on real data rather than a hand-built test. FB-28/FB-29 merged correctly as a second, independent scenario.

---

## 5. Results

### 5.1 Classification (Layer 1) — scored against the 20-item golden set

| Metric | v0 | v1 | v2 | v3 (reverted) | v4 (final) |
|---|---|---|---|---|---|
| intent_type | 85% | 90% | 90% | 90% | 90% |
| dimension | 80% | 90% | 95% | 90% | 90% |
| impact | 65% | 70% | 70% | 60% | 75% |
| urgency | 60% | 70% | 85% | 85% | 85% |
| overall (all 4 correct) | 40% | 45% | 55% | 50% | 65% |

v3 is included specifically because it failed — overall accuracy dropped relative to v2, and the attempt was reverted. Full reasoning in 4.2 above and `docs/06-iteration-log.md`.

**Remaining ceiling (not pursued further — see data/03-golden-set-labeled.md note #5):**
- FB-01: an architectural limit, not a prompt limit — the fact that the issue has a workaround lives in a context document (KI-1), invisible to a classification stage with no RAG access.
- FB-10, FB-23: boundary-ambiguity items, inherent to the data, not a missing rule.

### 5.2 Clustering (Stage 5) — compared against a golden-set hypothesis, not scored as accuracy

Clustering has no equivalent "ground truth accuracy" metric — the golden set's cluster groupings are hypotheses to be confirmed or revised by pipeline behavior, not fixed labels (see `data/03-golden-set-labeled.md` header). Validation instead targeted specific checkpoints:

| Checkpoint | Purpose | Result |
|---|---|---|
| CLU-006-022 (FB-06, FB-22) | Avoid a false merge: same account, same dimension, different problems | PASS — split correctly |
| Smoke test (4 isolated items) | Confirm the mechanism can merge at all | PASS — merged a genuine duplicate, kept controls separate |
| FB-01 + FB-26 + FB-27 (real data) | Confirm true-merge on real pipeline output, not just an isolated test | PASS — merged; signal_strength=High via the cross-account path |
| FB-28 + FB-29 (real data, second scenario) | Confirm merge capability generalizes beyond one bug type | PASS — merged; signal_strength=High |
| Praise/noise bulk-merge (FB-17/18/19/25, FB-20/21) | Confirm the corrected intent_type-based merge threshold (4.3) | PASS — both groups merged into single clusters |

Full comparison table (all 29 items vs. golden-set hypothesis): `docs/12-cluster-eval.md`.

### 5.3 Work-pack generation (Stage 6) — 22 clusters, RAG-grounded

All 22 clusters produced a work pack. 0 hard_fail items. Prompt iterated from generate-v1 through generate-v9 across three sessions.

**Auto-check coverage.** 14 of the 20 rubric items run programmatically on every output inside generate.py — timestamp format (R-01), quote count (R-02), verbatim fidelity (R-03), task completeness (R-04), review_flag blocks field (R-06), banned phrases (R-08), money/timing first-sentence (R-09), cluster_members validity (R-16), confidence field (R-17), noise enforcement (R-13/14/15), source_ref validity (R-19), internal clause IDs in reply_draft (R-PA). The remaining 6 items require human judgment (R-05, R-07, R-10, R-11, R-12, R-18, R-20) and are scored offline during Stage 7.

**The deterministic/model split.** The generation prompt asks the model for: title, problem_brief, key_quotes, source_refs, tasks[], reply_draft, review_flags. It does not ask the model for: cluster_id, cluster_members, signal_strength, intent_type, dimension, confidence — all computed deterministically in Python from the clustering and classification outputs. This keeps the model focused on synthesis and grounding, not bookkeeping.

**Stage 6 iteration summary (generate-v1 through generate-v9):**

| Version | Change | Reason |
|---|---|---|
| v1 | Initial build | Baseline |
| v2 | Multi-member review_flag reasoning | Flag reasons were generic ("verify records") not specific (named the actual risk per account) |
| v3 | Dynamic clause ID regex | `\*\*(ID)\.\*\*` missed TG/RM format; TG-2 was flagged as fabricated despite being a real clause |
| v4 | Whitespace normalization in verbatim check | 16/22 clusters had false-positive fabricated_quote flags because markdown line-wraps didn't match model's space-joined output |
| v5 | 10 prompt rules from human eval Round 1 | Systemic: R-11 overpromise, fabricated ticket numbers, single-feedback-to-roadmap tasks, no complaint empathy, praise over-attribution, language detection, KYB security (SP-11 added to context docs) |
| v6 | Reply opening/closing frameworks, task architecture, priority/deadline rules, source_refs TG-x ban, quality_flag remediation field | Systemic: complaint empathy pattern incomplete, Engineering receiving direct implementation tasks, deadline=None on High priority, ambiguous_timestamp false positives from model over-generating its own quality_flags |
| v7 | Auto-check verbatim normalization (quote style + case + punctuation), model quality_flags ownership clarified, conciseness guidance | 3 fabricated_quote false positives from punctuation/capitalization differences; 28 quality_flags in v6 (most were model-generated noise); outputs verbose |
| v8 | Three systemic patterns from human eval Round 3: P-A (clause IDs appearing in reply_draft), P-B (invalid assignee_team values), P-C (inverted apology logic); auto-check R-09 scope narrowed to payment clauses only | P-A: internal identifiers leaked to customer-facing text; P-B: model invented Compliance/Finance as assignee teams not in schema; P-C: model apologized for customer-caused situations (lost 2FA device) while not apologizing for system failures — opening matrix tightened to distinguish Vela Pay failures from customer-initiated situations |
| v9 | Four issues from post-v8 self-audit: V9-1 (feature_request single-task rule), V9-2 (no team prefix in task text), V9-3 (duplicate quality_flags section merged), V9-4 (opening matrix tightened for customer-caused situations to exclude carrier/external failures) | V9-1: feature_request was still splitting into Document + Evaluate tasks; V9-2: task text started with "Engineering: …" duplicating the assignee_team field; V9-3: prompt had two `## quality_flags` headers confusing model; V9-4: P-C fix in v8 incorrectly applied "no apology" to carrier/SMS failures — narrowed to customer-controlled actions (lost device, wrong details) only |

**Four auto-check bugs found and fixed during generation-stage iteration:**

Bug 1 (v1→v4): Verbatim check false positives from whitespace. All markdown source text has mid-sentence line wraps. The model quotes text with spaces. A genuinely verbatim quote like "payments had gone out" failed the check because the source had "payments had\ngone out". 16 of 22 clusters falsely flagged. Fix: normalize `\s+` to single space before comparison.

Bug 2 (v2→v3): Clause ID regex missed two prefix types. The context doc uses two bold formats: SP/KI use `**SP-1.** desc` (bold closes after period); TG/RM use `**TG-2. Full title.**` (bold spans the whole title). Original regex `\*\*(ID)\.\*\*` only matched the first format. Fix: change to `\*\*(ID)\.` (no closing `**` required). All 24 clause IDs now parsed.

Bug 3 (v6→v7): Verbatim check still too strict after Bug 1 fix. Three new false positives: model converted `"repeat monthly"` (double-quotes in source) to `'repeat monthly'` (single-quotes in JSON string) to avoid nesting conflicts; model capitalized first letter of mid-sentence excerpts used as standalone quotes. Neither is fabrication — content is identical. Fix: _normalize_for_verbatim() now also normalizes quote style, strips trailing punctuation, and lowercases the first character.

Bug 4 (pre-v8, discovered during human eval Round 3): R-09 tone_violation check was scoped to all SP-x clauses including SP-10 (account recovery) and SP-11 (KYB). This caused false-positive tone_violation flags on clusters where a customer lost their 2FA device (SP-10) — "money or timing" first-sentence requirement does not apply to account recovery situations. Fix: narrowed PAYMENT_SP_REFS to {SP-1 through SP-9} only; SP-10/SP-11 excluded.

**Stage 7 human eval results (generate-v5 through v9):** 12 clusters sampled across 4 rounds. No blocking issues in the final (v9) output. Final flag counts: quality_flags 7 (ambiguous_timestamp: 5, tone_violation: 1, non_english_feedback: 1), review_flags 15, fabricated_quote 0, internal_ref_in_reply 0.

---

## 6. Known Limitations & Next Steps

**PII redaction scope.** v1 regex redaction reliably catches structured PII (email, phone, transaction IDs). Human names and company names are not covered — no regex pattern reliably matches arbitrary names. v2 path: introduce NER-based entity recognition for name/org redaction.

**No ingest validation.** v1 has no field validation or discard logic at the ingest step. FB-20 (missing timestamp) was included deliberately to observe pipeline behavior. v2 should add explicit validation with defined behavior for missing required fields (reject with error vs. flag and proceed).

**Context document scale.** RAG is implemented as direct prompt stuffing (4 documents, ~4,000 tokens). This works for demo purposes but doesn't scale. Upgrade trigger: >4 context documents or >8,000 tokens of context → switch to vector retrieval with citation.

**Clustering scale.** Single-call clustering (all items reasoned about in one model call, no embeddings/blocking step) is validated only up to 29 items. A guard rail (`MAX_SINGLE_CALL_ITEMS=50`) fails loudly rather than silently degrading past that. Upgrade trigger, not yet exercised: a 100+ item stress test showing under 90% recall on known duplicate pairs. Deliberately not built now — would require a stress-test dataset that doesn't exist yet, and would reopen the no-vector-DB v1 lock if built with embeddings. Full reasoning in `docs/11-cluster-spec.md`.

**Signal-strength's original ambiguity is resolved for the one case that raised it, not in general.** CLU-001 (FB-01) originally justified High signal-strength using KI-1's documented recurrence rather than in-dataset item count — an open question about whether external context-doc evidence should count. Resolved in practice by adding real duplicate items (FB-26/FB-27) rather than by deciding the general question; the general question remains open for any future single-member cluster with only external evidence.

**No live integrations (v1).** Export is Markdown + JSON with Jira/Linear-shaped fields. No live API push to any issue tracker. v2 path: optional webhook or direct integration, with user-provided credentials.

**Overall v2 direction.** The five limitations above share a common pattern: each was deliberately held at the simplest viable implementation in v1 to keep scope bounded and the eval signal clean. None of them is architecturally expensive to address — NER for PII, schema validation at ingest, vector retrieval for context scaling, embedding-based clustering for scale, and a webhook layer for integrations are all well-understood. The decision in each case was about what to build *now* vs. what to validate first. That tradeoff is documented in the upgrade triggers above and in `docs/11-cluster-spec.md` — so the path to v2 is explicit, not aspirational.

---

## 7. Appendix

- GitHub repository: [github.com/zhenglimindesign-ing/asterline](https://github.com/zhenglimindesign-ing/asterline)
- Live demo: [asterline.liminzheng.com](https://asterline.liminzheng.com)
- Golden set: [`data/03-golden-set-labeled.md`](https://github.com/zhenglimindesign-ing/asterline/blob/main/data/03-golden-set-labeled.md)
- Rubric v1: [`eval/05-rubric-v1.md`](https://github.com/zhenglimindesign-ing/asterline/blob/main/eval/05-rubric-v1.md)
- Full iteration log: [`docs/06-iteration-log.md`](https://github.com/zhenglimindesign-ing/asterline/blob/main/docs/06-iteration-log.md)
