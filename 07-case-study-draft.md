# Asterline — Case Study Draft
# Status: Sections 1–3 and 6 drafted; Sections 4–5 intentionally left blank.
# Sections 4–5 (Iteration Log / Results) require pipeline output data from the
# Claude Code phase — they will be filled after eval execution.
# Language: English (all deliverables per §14)

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

18 rubric items derived inductively from three worked examples (FB-05: Critical actionable bug with source refs and HITL trigger; FB-03: feature request with no source match; FB-20: noise). Each item specifies the field checked, the yes/no check, the evaluation mode, and the failure action.

**12 automated items (runtime checks):** timestamp format (R-01), quote count (R-02), quote verbatim fidelity (R-03), task field completeness (R-04), review_flags blocks field (R-06), banned filler phrases (R-08), money/timing first sentence (R-09), noise: null reply (R-13), noise: empty tasks (R-14), noise: empty quotes (R-15), cluster_members validity (R-16), confidence field (R-17).

**6 human-judgment items (offline eval):** acceptance criteria specificity (R-05), human review trigger (R-07), no blame-shifting (R-10), no overpromising (R-11), no fabricated source references (R-12), title accuracy (R-18).

Hard-fail items (block export): R-04, R-13, R-14, R-15, R-17. All others add quality flags but allow export with review.

---

## 4. Iteration Log *(to be filled during Claude Code eval phase)*

> This section will document 2–4 before/after examples showing how pipeline output quality changed across prompt versions.
> Each entry: what the output looked like before → which rubric item failed → what changed (prompt? taxonomy? pipeline step?) → what the output looks like after.
> Source: eval run logs from Claude Code phase.

---

## 5. Results *(to be filled after eval execution)*

> Eval scores (per rubric item, per golden set item, per prompt version) across iterations.
> Minimum viable evidence: a table showing rubric pass rates across 2–3 prompt versions.

---

## 6. Known Limitations & Next Steps

**PII redaction scope.** v1 regex redaction reliably catches structured PII (email, phone, transaction IDs). Human names and company names are not covered — no regex pattern reliably matches arbitrary names. v2 path: introduce NER-based entity recognition for name/org redaction.

**No ingest validation.** v1 has no field validation or discard logic at the ingest step. FB-20 (missing timestamp) was included deliberately to observe pipeline behavior. v2 should add explicit validation with defined behavior for missing required fields (reject with error vs. flag and proceed).

**Context document scale.** RAG is implemented as direct prompt stuffing (4 documents, ~4,000 tokens). This works for demo purposes but doesn't scale. Upgrade trigger: >4 context documents or >8,000 tokens of context → switch to vector retrieval with citation.

**Signal-strength uses in-dataset evidence only.** For CLU-001 (FB-01, CSV upload failure), signal-strength was labeled High based on the KI-1 known issues entry documenting recurrence — not because multiple feedback items appear in the dataset. This creates a design question: should signal-strength be allowed to reference context doc evidence, or only in-dataset item count? v1 leaves this ambiguous; v2 should define it explicitly.

**No live integrations (v1).** Export is Markdown + JSON with Jira/Linear-shaped fields. No live API push to any issue tracker. v2 path: optional webhook or direct integration, with user-provided credentials.

---

## 7. Appendix *(links to be added at deploy time)*

- GitHub repository: [link]
- Live demo: [link]
- Golden set CSV: [link]
- Rubric v1: [link]
