# Asterline — Frontend Design Brief
# Audience: designer / frontend Claude building the public-facing site
# Scope: landing page + product overview page
# Last updated: 2026-06-18

---

## What Asterline is

Asterline is a feedback-to-work-pack pipeline. It takes raw, unstructured user feedback (support tickets, NPS comments, app reviews) and converts it into structured, traceable work packs — one per cluster of related feedback — that a product or support team can act on immediately.

**This is a portfolio project, not a SaaS product.** Its purpose is to demonstrate three capabilities for AI PM / TPM roles:
1. **Eval design** — defining what "good" looks like before generating at scale (golden set + rubric)
2. **Iteration** — measuring output quality, finding failures, changing something specific, measuring again
3. **Traceability** — every output cites the specific feedback items and policy clauses it came from

The synthetic product used as demo data is **Vela Pay**, a B2B stablecoin payments platform. All data is synthetic.

---

## The pipeline (8 stages)

```
Raw feedback
  → PII redaction
  → Intent classification  (actionable_bug / feature_request / complaint / praise / noise)
  → Dimension + severity tagging
  → Clustering             (group items describing the same underlying issue)
  → Signal-strength scoring
  → Work pack generation   (one per cluster — the main output)
  → Runtime checks         (automated quality gates)
  → Export                 (Markdown for humans + JSON for Jira/Linear)
```

---

## What a work pack looks like

A work pack is the core output unit. Here is a real example from the pipeline (CLU-001):

---

**CLU-001 — Batch CSV payout upload silently fails for files exceeding 500 rows**

- Intent: actionable_bug | Signal: High | Confidence: High
- Source feedback: 3 items from 3 separate accounts (FB-01, FB-26, FB-27)

**Problem brief:** When a batch payout CSV exceeds 500 rows, the upload hangs indefinitely with no error message and no indication of whether payments were dispatched — leaving finance teams unable to determine payment status. All three affected accounts discovered the limit independently through trial and error.

**Key quotes:**
> "no error, no confirmation, page just sat there for 10+ minutes"
> "We had no way of knowing whether the payments had gone out."

**Source refs:** KI-1 (known issue: 500-row limit undocumented)

**Tasks:**
- [High / Engineering] Reproduce the silent-failure behavior, identify root cause and scope, document whether partial payment dispatch is possible during a hung upload.
- [High / Product] Review Engineering's findings, assess severity, authorize fix scope.

**Reply draft (body only — CRM adds salutation/sign-off):**
> We're sorry your batch upload hung without any message — not knowing whether your payments went out is not acceptable, and we understand the manual workaround cost your team real time.
>
> There is a current row limit of 500 per upload file. Files above that threshold fail silently instead of showing an error, which is a known bug we're actively working to fix. Until the fix is in place, splitting your file into batches of 500 rows or fewer will complete the upload reliably.

**Review flag:** Human must confirm payment status for each affected account before sending.

---

Work packs span 5 intent types:
- **actionable_bug** — system failure requiring Engineering + Product triage
- **feature_request** — capability gap logged for Product roadmap consideration
- **complaint** — process or policy friction requiring an empathetic response
- **praise** — positive signal attributed to specific product areas
- **noise** — out-of-scope or unactionable; no reply drafted

---

## Key design decisions to reflect in UI

**Tasks are recommendations, not auto-assigned tickets.** A human reviewer decides which tasks to create in Jira/Linear. The work pack is a triage artifact.

**Reply drafts are body-only.** No salutation ("Hi [Name]") or sign-off ("Best regards") — the CRM adds those from ticket metadata at send time.

**Two flag types with different meanings:**
- `review_flags` — block the reply draft from being sent until a human verifies something (e.g. money amount, timing commitment, policy implication). High stakes.
- `quality_flags` — surface potential issues in the output for reviewer awareness (e.g. relative time expression detected, non-English feedback). Do not block output; include remediation guidance.

**Signal strength is deterministic** (computed from member count, account diversity, and classified severity) — not a model opinion.

**Source refs are traceable.** Every `SP-x`, `KI-x`, `RM-x` citation links back to a specific clause in the context docs. Nothing is asserted without a source.

---

## Tone and positioning

- **Portfolio, not product** — the site should read as a demonstration of process and craft, not a sales pitch
- **Honest about limitations** — v1 limitations (regex PII, direct RAG, manual orchestration) are documented, not hidden
- **Precision over polish** — the audience is technical (AI PM / TPM hiring managers and peers who will read the case study)
- **Synthetic data, real process** — always clear that Vela Pay data is synthetic; the eval methodology is real

---

## Pages in scope

### Landing page

Goal: Communicate what Asterline does, why it matters as a portfolio project, and give a clear path to the demo / case study.

Suggested structure:
1. **Hero** — one-line product description + one-line portfolio framing ("built to demonstrate eval design, iteration, and traceability for AI PM / TPM roles")
2. **Pipeline overview** — visual or step-by-step of the 8 stages
3. **Output example** — a real work pack (abbreviated) showing what the pipeline produces
4. **Three capabilities** — eval design / iteration / traceability (the "why this matters" section)
5. **CTA** — link to full case study + link to GitHub repo

### Product overview page

Goal: Show how the pipeline works in more depth — inputs, processing stages, and a full example output.

Suggested structure:
1. **Input** — what raw feedback looks like (a support ticket, an NPS comment)
2. **Pipeline stages** — each stage with a one-sentence description of what it does and why
3. **Work pack anatomy** — annotated breakdown of a full work pack (fields, what each means)
4. **Eval methodology** — rubric overview (auto checks vs. human checks), what it means to "pass"
5. **Iteration evidence** — brief before/after: what the pipeline got wrong in v1, what changed

---

## Files for reference

| File | What it contains |
|---|---|
| `pipeline/output/workpacks-v1.md` | All 22 work packs — the actual pipeline output |
| `pipeline/output/workpacks-v1.json` | Same content, machine-readable |
| `data/01-vela-pay-context-docs.md` | The RAG context the model uses (policy, tone, known issues) |
| `docs/07-case-study-draft.md` | Full case study narrative — source of truth for copy |
| `README.md` | Short project overview |

The canonical source for product copy is `docs/07-case-study-draft.md`. For the actual output format, use `pipeline/output/workpacks-v1.md`.

---

## Vocabulary (use consistently)

| Term | Meaning |
|---|---|
| work pack | The structured output artifact for one cluster |
| cluster | A group of feedback items describing the same underlying issue |
| signal strength | How much evidence supports a cluster (High / Medium / Low) — deterministic |
| review flag | Blocks reply from being sent; requires human sign-off |
| quality flag | Surfaces a potential issue; does not block output |
| source ref | A clause ID (SP-x, KI-x, etc.) cited in a work pack |
| intent type | Classification of feedback: actionable_bug, feature_request, complaint, praise, noise |
| dimension | Which team owns the issue: Engineering, Product, Support Operations, etc. |
