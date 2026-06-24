# Asterline — Case Study

**Live demo:** [asterline.liminzheng.com](https://asterline.liminzheng.com) · **Source:** [github.com/zhenglimindesign-ing/asterline](https://github.com/zhenglimindesign-ing/asterline)

> **What:** An 8-stage pipeline that turns raw user feedback into traceable work packs — each backed by source quotes, grounded in policy documents, and flagged for human review where stakes are high. Deployed live at [asterline.liminzheng.com](https://asterline.liminzheng.com).
>
> **How I know it works:** Classification accuracy improved from 40% to 65% across 5 prompt versions (one reverted), scored against a 20-item hand-labeled golden set (ground truth used to measure pipeline accuracy). Generation: 22/22 clusters produced work packs, 0 fabricated quotes, 9 prompt versions across 4 rounds of human eval. Both stages evaluated against a 20-rule rubric — 14 checks run automatically on every output, 7 scored by human judgment.
>
> **What I owned:** Pipeline architecture, prompt design and iteration (17+ versions), evaluation system, output schema, and all product decisions. Claude Code (AI coding tool) wrote the Python and frontend; I directed what to build, how to evaluate it, and when to revert.

---

## 1. Problem & Context

Product teams drown in feedback. Support tickets, app reviews, NPS responses, and sales call notes arrive in different formats, at different times, and with wildly different levels of specificity. The signal is there — but extracting it, grouping it, and turning it into something an engineer or PM can actually act on takes time that small teams rarely have.

Asterline is a feedback intelligence tool that turns raw, unstructured user feedback into traceable, ready-to-work work packs. A work pack is a structured artifact containing a problem summary, key evidence quotes (with links back to source items), a suggested task with acceptance criteria and assignee team, a draft customer reply, and flags for human review where the stakes are high enough to warrant it. One of 22 work packs, abbreviated:

> **Batch CSV upload silently fails with no error message above 500-row limit**
>
> Signal: High · Intent: actionable_bug · Source: 3 feedback items (FB-01, FB-26, FB-27), 3 accounts
>
> **Problem:** Three customers attempted batch payout uploads of 620, 540, and 700 rows respectively and received no error message or confirmation — the upload simply hung indefinitely, forcing each to manually split their files and resubmit.
>
> **Key quotes:** *"no error, no confirmation, page just sat there for 10+ minutes"* · *"We had no way of knowing whether the payments had gone out."*
>
> **Tasks:** (1) Engineering: investigate the silent failure, confirm the row threshold, document root cause. (2) Product: review root-cause summary, authorize fix scope. (3) Engineering: implement validation with clear error message.
>
> **Reply draft:** *We're sorry your batch upload hung with no error message — that's not acceptable behavior, and we understand it cost your team real time to diagnose and work around…*
>
> **Review flag:** This reply templates across three customers — before sending, verify per account whether any oversized uploads resulted in partial or duplicate payment execution.

All 22 work packs are in [`pipeline/output/workpacks-v1.md`](pipeline/output/workpacks-v1.md).

Built for whoever ends up with the feedback inbox — no assumed role, no assumed team size. The demo uses a synthetic product (Vela Pay, a B2B stablecoin payments platform) with authored context documents, synthetic feedback, and a hand-labeled golden set. All data is synthetic; the eval process is real.

**Why this case study exists.** Building a feedback tool is not the point. The point is demonstrating three capabilities central to AI product work:

1. **Eval-first** — defining what "good" looks like before generating at scale, using a golden set, a taxonomy, and a rubric with both automated and human-judgment components.
2. **Traceable output** — every work pack output can be traced back to specific raw feedback items and, where applicable, specific policy clauses. Nothing is generated without a source.
3. **Human-gated** — the pipeline proposes; a human disposes. Any reply touching money, timing, or policy is blocked until a person verifies it. Tasks are recommendations, not filed tickets.

---

## 2. Approach

### 2.1 Pipeline

Built with Python and Anthropic's Claude API (models: Haiku and Sonnet), deployed on Vercel. Stages are split between Python and LLM based on what each task requires. LLM handles language understanding: classifying intent, judging cross-item similarity, generating structured prose. Python handles everything rule-based: PII stripping, signal-strength formulas, verbatim quote verification.

| Stage | Executor | Prompt | Why this executor |
|---|---|---|---|
| 1. Ingest | Python (`data_loader.py` offline; API request body live) | — | Pure I/O: parse Markdown, CSV, or JSON into structured dicts |
| 2. PII redaction | Python (`pii.py`) | — | Regex matching; must run before any text reaches a model |
| 3. Intent classification | Haiku · per item | [`pipeline/prompts/classify.txt`](pipeline/prompts/classify.txt) | Requires semantic understanding: is this a bug, a feature request, or just noise? |
| 4. Dimension + severity | ↑ same prompt, same call | — | Co-determined with intent for consistency — splitting would risk contradictory labels |
| 5. Clustering | Haiku · all items at once | [`pipeline/prompts/cluster.txt`](pipeline/prompts/cluster.txt) | Cross-item similarity judgment requires reasoning across all items at once |
| 6. Signal-strength | Python (deterministic formula) | — | Member count × account diversity × severity — a defined formula, not a judgment call |
| 7. Work-pack generation | Sonnet · per cluster + Python | [`pipeline/prompts/generate.txt`](pipeline/prompts/generate.txt) | Sonnet generates structured output (title, brief, quotes, tasks, reply draft); Python overwrites deterministic fields and runs 14 auto-checks |
| 8. Export | Python | — | Format Markdown + JSON with Jira/Linear-shaped fields |

**Model selection.**  
Classification and clustering use Haiku, a fast and cost-efficient model — short-output tasks where speed and cost matter more than prose quality.  
Generation uses Sonnet, a more capable model — Haiku was tested early on generation and failed on constraint density (14 auto-checked rubric rules). Opus was not needed; Sonnet meets the rubric at acceptable quality for a 22-cluster dataset.

**Deterministic/model split.**  
The generation prompt asks the model for: title, problem_brief, key_quotes, source_refs, tasks[], reply_draft, review_flags.  
Python computes everything else: cluster_id, cluster_members, signal_strength, intent_type, dimension, confidence. This keeps model output auditable and deterministic logic testable without an API call.

Intent and dimension are orthogonal axes: intent answers "should this become an action?"; dimension answers "who owns it?" This separation allows the same complaint about a delayed payout (intent: complaint) to be routed to Support Process, Finance & Reporting, or Engineering depending on its nature.

### 2.2 Key design decisions

**RAG without a vector database (v1).** The four Vela Pay context documents (product one-pager, support policy, tone guideline, known issues / roadmap) are stuffed directly into the generation prompt rather than indexed. Each generated reply cites a specific clause ID (e.g. SP-3, KI-1) when one applies. The upgrade trigger is documented: if context docs grow beyond ~4 documents or ~8,000 tokens, vector retrieval becomes necessary. For v1 demo purposes, direct stuffing is sufficient and avoids infrastructure complexity.

**Regex PII redaction (v1 known limitation).** Structured PII — email addresses, phone numbers, transaction reference numbers — is caught by regex and replaced before any text is extracted for quotes or reply drafts. Human names and company names are not reliably caught by regex and are not redacted in v1. This is an honest scope boundary, not an oversight: the demo data is synthetic, and the limitation is documented as a v2 candidate (introducing NER-based redaction).

**Human-in-the-loop at three positions, blocking at one.** Three HITL touchpoints exist: (1) after clustering, before generation — users can edit, merge, or split clusters (advisory, non-blocking); (2) before export — items flagged `needs_human_review` require human confirmation before the reply draft is released (blocking, but only for flagged items); (3) after generation — users can edit the work pack before export (advisory). Blocking review is reserved for the highest-cost scenarios: money-touching or timing-sensitive replies, and low-confidence clusters.

**Severity as two axes (impact × urgency).** A single severity score cannot distinguish between a high-impact event with no time pressure (a known bug affecting reconciliation) and a low-impact event with immediate urgency (a potential policy breach on a small transaction). Splitting severity into impact and urgency allows the pipeline to correctly label both without forcing a comparison between incommensurable cases.

### 2.3 Built-in dataset (Vela Pay)

The demo uses Vela Pay, a synthetic B2B stablecoin payments platform, as its product context. Four context documents were authored to support RAG citation:

- **Product one-pager**: features, pricing, out-of-scope items
- **Support policy (SP-1 through SP-10)**: refund rules, dispute SLAs, KYC/KYB thresholds, account recovery
- **Tone & voice guideline (TG-1 through TG-6)**: communication principles with positive/negative examples
- **Known issues & roadmap (KI-1 through KI-4, RM-1 through RM-4)**: documented bugs and planned features

25 synthetic feedback items were authored across five channels (support tickets, email, app reviews, feature request forms, survey responses), with realistic metadata (timestamp UTC+0, contact email, account ID) and embedded PII in raw_text where channel-appropriate. The dataset is intentionally skewed toward novel issues (68%) with a minority matching known context doc clauses (32%), reflecting realistic feedback distribution.

---

## 3. Eval Design

### 3.1 Taxonomy

The taxonomy has four axes. Values were derived from golden set labeling and may evolve as the dataset grows.

**Intent** (5 values): `actionable_bug`, `feature_request`, `complaint`, `praise`, `noise`

**Dimension** (7 values): `Engineering`, `UX`, `Compliance`, `Support Process`, `Product/Roadmap`, `Finance & Reporting`, `Other/Uncategorized`

**Severity** (two sub-axes, per item):
- Impact: `High`, `Medium`, `Low`, `N/A`
- Urgency: `High`, `Medium`, `Low`, `N/A`

**Signal-strength** (3 values, cluster-level): `High`, `Medium`, `Low`

The split of severity into impact × urgency was a mid-process discovery: a single severity score could not correctly handle a complaint about an FX spread discrepancy (Low impact, small dollar amount — but High urgency, because a stated policy commitment appeared to have been breached). This kind of discovery — where a labeling problem reveals a taxonomy gap — is typical of why the golden set is built before mass generation rather than after.

### 3.2 Golden Set

A golden set is a hand-labeled subset of the data used as ground truth — the pipeline's output is scored against these labels to measure accuracy.

20 items selected from the 25-item synthetic dataset. Excluded: 2 items with high thematic overlap with retained items, 2 praise items that added no new dimension coverage, 1 item too vague to label reliably.

**Composition:**
- 40% (8/20) have source_refs pointing to known context doc clauses — tests RAG citation behavior
- 60% (12/20) are novel issues with source_refs=[] — tests RAG degradation (what the pipeline does when no clause matches)
- 3 items with Impact=High + Urgency=High — tests HITL trigger conditions
- 2 praise items, 1 noise item — tests non-actionable intent handling
- 1 item with a missing timestamp — tests ingest validation edge case

### 3.3 Rubric

20 rubric items derived inductively from three worked examples, with two added during generation-stage iteration (R-19, R-20). One additional auto-check (R-PA: clause IDs in reply_draft) was added during generation iteration, bringing the runtime total to 14 automated checks. Each item specifies the field checked, the yes/no check, the evaluation mode, and the failure action. Full rubric: [`eval/05-rubric-v1.md`](eval/05-rubric-v1.md).

**14 automated items (runtime checks):** timestamp format, quote count, quote verbatim fidelity, task field completeness, review_flags blocks field, banned filler phrases, money/timing first sentence, noise: null reply, noise: empty tasks, noise: empty quotes, cluster_members validity, confidence field, source_ref validity, clause IDs in reply_draft.

**7 human-judgment items (offline eval):** acceptance criteria specificity, human review trigger, no blame-shifting, no overpromising, no fabricated source references, title accuracy, reply vs policy contradiction.

Five items are hard-fail (block export): task field completeness, the three noise-enforcement checks (null reply, empty tasks, empty quotes), and confidence field populated. All others add quality flags but allow export with review.

---

## 4. Key Iterations

Full entry-by-entry log with every prompt version and score delta: [`docs/06-iteration-log.md`](docs/06-iteration-log.md). Five examples below, chosen to show different kinds of iteration — a clean prompt fix, a failed attempt that was reverted, a corrected design assumption, an eval-design gap that required new data, and a human-eval-driven batch fix across the generation prompt.

### 4.1 Classification: noise misclassification (v0 → v1)

**Before:** A casual product inquiry ("does this support apple pay? just curious, not urgent") was classified as `feature_request`. Golden label: `noise`. The v0 prompt's noise definition didn't cover general yes/no product-capability questions with no stated use case.

**What changed:** Added an explicit clause to the `noise` definition: "a general yes/no inquiry about a product capability... with no stated use case or context." Prompt only — no taxonomy or pipeline change.

**After:** Correctly classified as `noise`. Side effect: dimension accuracy also improved (+10%) because several other intent corrections cascaded into correct dimension labels.

### 4.2 Classification: a fix that made things worse, and was reverted (v2 → v3 attempt)

**Before:** impact accuracy was 70% after v2. Three feature-request items were under-scored as `Low` when golden set said `Medium`.

**What changed:** Replaced the impact-calibration rule with a 3-tier decision tree (blocked=High / friction-at-scale=Medium / minor=Low).

**After:** impact accuracy dropped to 60% (−10%) and overall accuracy dropped to 50% (−5%). The "friction at scale" tier was too broad — it pulled correctly-labeled `Low` items up to `Medium`, including two that had been correct in v2. **Reverted.** Replaced instead with few-shot examples illustrating the Low/Medium boundary, which raised impact to 75% without the regression. The failed attempt's eval output was kept ([`docs/eval-results-v3-reverted.json`](docs/eval-results-v3-reverted.json)) rather than deleted, specifically so this example could be written up.

### 4.3 Clustering: a design assumption that didn't survive scrutiny (cluster-v1/v2 → v3)

**Before:** the clustering prompt told the model that praise and noise items "almost always form singleton clusters," reasoning that two items praising the exact same thing is statistically unlikely in a small sample. Result: zero merges occurred anywhere in the dataset, including two praise items that both specifically praised fast KYB/onboarding.

**What changed:** the underlying reasoning was challenged directly — clustering's purpose for praise/noise isn't "deduplicate specific complaints," it's "reduce reading volume," because these intent types generate no differentiated tasks. The rule was rewritten: actionable types (bug/feature/complaint) keep a strict same-problem standard; praise and noise bulk-merge into one cluster each, regardless of topic, because there is no cost to a coarse merge when nothing downstream depends on topic precision.

**After:** all praise items merged into one cluster, all noise items merged into one cluster, while the adversarial test case (two different Engineering bugs from the same account) still correctly split. The original assumption wasn't a coding bug; it answered the wrong question.

### 4.4 Eval design itself had a gap: the dataset couldn't test merging

**Before:** clustering had been validated only on its ability to avoid false merges. Nothing in the 25-item dataset was an unambiguous "these should merge" case — every multi-member hypothesis was a should-this-split test. Removing the praise/noise special case (4.3) produced zero new merges, which was ambiguous evidence: either the rule fix had no other effect, or the merging mechanism itself was structurally biased toward singletons.

**What changed:** built an isolated smoke test with 4 hand-built items — confirmed the mechanism could merge genuine duplicates in isolation. Then added two real positive-control pairs to the dataset itself: a third and second report of the batch-upload issue (deliberately worded differently from the original) and a feature-request duplicate from a different scenario type. This was a data change, not a prompt change — the gap was in what the eval could test, not in pipeline behavior.

**After:** the three batch-upload items merged into one cluster on the real 29-item pipeline run, with `signal_strength` correctly computed as `High` via the "≥2 items, different accounts" path — the first time that code path fired on real data rather than a hand-built test. The feature-request pair merged correctly as a second, independent scenario.

### 4.5 Generation: human eval surfaced 10 systemic prompt issues in one round (v4 → v5)

**Before:** generate-v4 passed all automated checks. Human eval of 8 clusters revealed 10 systemic patterns invisible to code: the model overpromised individual follow-up for feature requests ("we'll contact you when this ships"), opened complaint replies with policy citations instead of empathy, fabricated internal ticket numbers in tasks, and created implementation-level tasks from single feedback items.

**What changed:** All 10 patterns addressed in one prompt version. Examples: complaint replies now require an empathy-first opening before any policy reference. Feature-request replies direct to a changelog, not personal contact. Tasks from single feedback items are scoped to "evaluate/investigate," never "implement." A new context document clause (SP-11: KYB via secure portal only) was added when eval revealed the model was directing sensitive documents to email.

**After:** Spot-checks on the same 8 clusters showed all 10 patterns resolved. But this round also surfaced the first of four auto-check code bugs (verbatim quote matching too strict) — the bug was invisible during automated testing because the check itself was wrong, not the model's output.

---

## 5. Results

### 5.1 Classification — scored against the 20-item golden set

| Metric | v0 | v1 | v2 | v3 (reverted) | v4 (final) |
|---|---|---|---|---|---|
| intent_type | 85% | 90% | 90% | 90% | 90% |
| dimension | 80% | 90% | 95% | 90% | 90% |
| impact | 65% | 70% | 70% | 60% | 75% |
| urgency | 60% | 70% | 85% | 85% | 85% |
| overall (all 4 correct) | 40% | 45% | 55% | 50% | 65% |

v3 is included specifically because it failed — overall accuracy dropped relative to v2, and the attempt was reverted. Full reasoning in 4.2 above and [`docs/06-iteration-log.md`](docs/06-iteration-log.md).

**Remaining ceiling (not pursued further):**
- One item hits an architectural limit — the fact that the issue has a workaround lives in a context document (KI-1), invisible to a classification stage with no RAG access.
- Two items are boundary-ambiguity cases, inherent to the data, not a missing rule.

### 5.2 Clustering — compared against a golden-set hypothesis, not scored as accuracy

Clustering has no equivalent "ground truth accuracy" metric — the golden set's cluster groupings are hypotheses to be confirmed or revised by pipeline behavior, not fixed labels. Validation instead targeted specific checkpoints:

| Checkpoint | Purpose | Result |
|---|---|---|
| Same account, different bugs | Avoid a false merge: same account, same dimension, different problems | PASS — split correctly |
| Smoke test (4 isolated items) | Confirm the mechanism can merge at all | PASS — merged a genuine duplicate, kept controls separate |
| Three batch-upload reports (real data) | Confirm true-merge on real pipeline output, not just an isolated test | PASS — merged; signal_strength=High via the cross-account path |
| Feature-request duplicate (real data) | Confirm merge capability generalizes beyond one bug type | PASS — merged; signal_strength=High |
| Praise/noise bulk-merge | Confirm the corrected intent_type-based merge threshold (4.3) | PASS — both groups merged into single clusters |

Full comparison table (all 29 items vs. golden-set hypothesis): [`docs/12-cluster-eval.md`](docs/12-cluster-eval.md).

### 5.3 Work-pack generation — 22 clusters, 9 prompt versions

All 22 clusters produced a work pack. 0 hard_fail items. Prompt iterated from generate-v1 through generate-v9 across three sessions, validated by four rounds of human eval (12 clusters sampled).

**Auto-check coverage.** 14 rubric items run programmatically on every output inside generate.py. The remaining 7 items require human judgment and are scored offline.

**The deterministic/model split.**  
The generation prompt asks the model for: title, problem_brief, key_quotes, source_refs, tasks[], reply_draft, review_flags.  
Python computes everything else: cluster_id, cluster_members, signal_strength, intent_type, dimension, confidence. This keeps the model focused on synthesis and grounding, not bookkeeping.

**Generation iteration summary (v1 through v9):**

| Version | What changed | Why |
|---|---|---|
| v1 | Initial build | Baseline |
| v2 | Review flag reasons made specific to each account | Generic reasons ("verify records") didn't name the actual risk for multi-member clusters |
| v3 | Clause ID parsing fixed | Auto-check regex missed TG/RM format — real clauses (TG-2) were flagged as fabricated |
| v4 | Verbatim quote check fixed | 16/22 clusters had false-positive fabricated_quote flags from markdown line-wrap vs space mismatch |
| v5 | 10 prompt rules from human eval Round 1 | Systemic issues: overpromising follow-up, fabricated ticket numbers, implementation tasks from single feedback, no complaint empathy, praise over-attribution, KYB security gap |
| v6 | Reply opening/closing frameworks, task architecture, priority/deadline rules | Complaint empathy incomplete, Engineering receiving direct implementation tasks, High priority with no deadline, model over-generating its own quality_flags |
| v7 | Verbatim normalization (quote style + case), model quality_flag ownership, conciseness | 3 false-positive fabricated_quote flags from punctuation differences; 28 quality_flags in v6 (mostly model-generated noise); verbose outputs |
| v8 | Three patterns from human eval Round 3 | Internal clause IDs leaked to reply_draft; model invented assignee_team values; apology logic inverted (apologized for customer-caused situations, not system failures) |
| v9 | Single-task rule for feature requests, team-name dedup, prompt section merge, apology scope narrowed | Self-audit found 4 remaining issues after v8 |

**Four auto-check bugs found and fixed during this stage:**

Bug 1 (v1→v4): Verbatim check false positives from whitespace. Markdown source has mid-sentence line wraps; the model quotes with spaces. 16 of 22 clusters falsely flagged. Fix: normalize `\s+` to single space before comparison.

Bug 2 (v2→v3): Clause ID regex missed two prefix types. Two markdown formats in context docs; original regex only matched one. Fix: relaxed the regex pattern. All 24 clause IDs now parsed.

Bug 3 (v6→v7): Verbatim check still too strict. Model converted double-quotes to single-quotes and capitalized excerpt starts — neither is fabrication. Fix: normalize quote style, trailing punctuation, and case.

Bug 4 (pre-v8): Tone check fired for non-payment clauses. "Money/timing first sentence" requirement was applied to account recovery (SP-10) and KYB (SP-11) situations where it doesn't apply. Fix: narrowed to payment clauses (SP-1 through SP-9) only.

**Final output (generate-v9):** quality_flags 7 (ambiguous_timestamp: 5, tone_violation: 1, non_english_feedback: 1), review_flags 15, fabricated_quote 0, internal_ref_in_reply 0. No blocking issues.

---

## 5.4 Live pipeline and public dataset

After the offline eval was complete, the pipeline was deployed as a live product:

- **Vercel Python serverless function** (`api/pipeline.py`) runs the full 8-stage pipeline on user-submitted input in real time — paste text or upload CSV, get real work packs back, not pre-computed results.
- **CFPB public dataset** — 150 real consumer financial complaints from the Consumer Financial Protection Bureau. Each run samples 1 complaint and runs it through the live pipeline with no product context. This tests RAG degradation on real-world data: the pipeline classifies and generates a work pack, but `source_refs` are empty because no context documents are loaded.
- **Rate limits** — up to 3 items per run (randomly sampled if more are submitted), 5 runs per day. These limits reflect the demo-stage cost constraint, not a technical limitation.

The live pipeline uses the same prompts and models as the offline pipeline (Haiku for classification and clustering, Sonnet for generation). The only difference is that ingest parses JSON from the API request body instead of reading a Markdown file from disk.

---

## 5.5 What I built vs. what AI tools did

**What I owned:**

- **Pipeline architecture** — the 8-stage sequence, the deterministic/model split, which stages use which model and why
- **Prompt design and iteration** — 5 classification versions, 3 clustering versions, 9 generation versions, each driven by eval failures I identified and documented
- **Evaluation system** — golden set curation, rubric design (20 rules, inductively derived), scoring methodology, the decision to revert v3 rather than push forward
- **Output schema** — work-pack field definitions, quality_flags taxonomy, review_flags trigger conditions, the split of severity into impact × urgency
- **Product decisions** — what to automate vs. require human review, what limitations to accept in v1, what upgrade triggers to document for v2

**What Claude Code wrote:**

- **Python pipeline** — classify.py, cluster.py, generate.py, eval.py, pii.py, data_loader.py
- **Frontend** — product site, interactive demo, pipeline animation
- **Live API** — Vercel serverless function (api/pipeline.py)
- **Documentation** — CLAUDE.md, iteration log entries, cluster spec

The prompts went through 17+ versions total. Each change traces to a specific eval failure documented in the [iteration log](docs/06-iteration-log.md).

---

## 6. Known Limitations & Next Steps

**PII redaction scope.** v1 regex redaction reliably catches structured PII (email, phone, transaction IDs). Human names and company names are not covered — no regex pattern reliably matches arbitrary names. v2 path: introduce NER-based entity recognition for name/org redaction.

**No ingest validation.** v1 has no field validation or discard logic at the ingest step. One item with a missing timestamp was included deliberately to observe pipeline behavior. v2 should add explicit validation with defined behavior for missing required fields (reject with error vs. flag and proceed).

**Context document scale.** RAG is implemented as direct prompt stuffing (4 documents, ~4,000 tokens). This works for demo purposes but doesn't scale. Upgrade trigger: >4 context documents or >8,000 tokens of context → switch to vector retrieval with citation.

**Clustering scale.** Single-call clustering (all items reasoned about in one model call, no embeddings) is validated only up to 29 items. A guard rail (`MAX_SINGLE_CALL_ITEMS=50`) fails loudly rather than silently degrading past that. Upgrade trigger: a 100+ item stress test showing under 90% recall on known duplicate pairs. Not built now because the stress-test dataset doesn't exist yet and vector embeddings would add infrastructure complexity not justified at this scale. Full reasoning in [`docs/11-cluster-spec.md`](docs/11-cluster-spec.md).

**Signal-strength edge case.** Whether a single-member cluster can count external evidence (e.g. a known-issues document saying "this is recurring") toward High signal-strength was resolved in practice by adding real duplicate items to the dataset, not by deciding the general principle. The general question remains open for future single-member clusters with only external evidence.

**No live integrations (v1).** Export is Markdown + JSON with Jira/Linear-shaped fields. No live API push to any issue tracker. v2 path: optional webhook or direct integration, with user-provided credentials.

**Overall v2 direction.** The five limitations above share a common pattern: each was deliberately held at the simplest viable implementation in v1 to keep scope bounded and the eval signal clean. None is architecturally expensive to address. The decision in each case was about what to build *now* vs. what to validate first — and the upgrade triggers above make the path to v2 explicit, not aspirational.

---

## 7. Appendix

- **Live demo:** [asterline.liminzheng.com](https://asterline.liminzheng.com) — try the pipeline with your own feedback, browse 22 pre-generated Vela Pay work packs, or run real CFPB complaints
- **GitHub repository:** [github.com/zhenglimindesign-ing/asterline](https://github.com/zhenglimindesign-ing/asterline)
- **Prompts:** [`classify.txt`](pipeline/prompts/classify.txt) · [`cluster.txt`](pipeline/prompts/cluster.txt) · [`generate.txt`](pipeline/prompts/generate.txt)
- **Golden set:** [`data/03-golden-set-labeled.md`](data/03-golden-set-labeled.md)
- **Rubric:** [`eval/05-rubric-v1.md`](eval/05-rubric-v1.md)
- **Full iteration log:** [`docs/06-iteration-log.md`](docs/06-iteration-log.md)
