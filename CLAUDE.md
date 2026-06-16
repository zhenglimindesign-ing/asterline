# CLAUDE.md — Asterline

## What is Asterline

Asterline is a feedback-to-work-pack pipeline that converts raw user feedback into traceable, ready-to-work work packs. It is a job-search portfolio project demonstrating eval design, iteration, and traceability for AI PM / Technical PM roles.

---

## Repo file inventory & intended folder structure

```
asterline/
  CLAUDE.md                        ← this file
  README.md                        ← project overview — still a placeholder, pending case study completion
  project-context.md               ← single source of truth; stays in root
  .gitignore                       ← .env is listed; never commit secrets
  .env.example                     ← copy to .env, fill in ANTHROPIC_API_KEY
  requirements.txt                 ← anthropic, python-dotenv (no version ceiling — known minor risk)

  data/
    01-vela-pay-context-docs.md    ← RAG context docs (product, policy, tone, known issues)
    02-synthetic-feedback-25.md    ← pipeline input: 29 synthetic feedback items (25 original + 4 clustering positive-controls added 2026-06-16)
    03-golden-set-labeled.md       ← ground truth for offline eval + cluster hypothesis + known uncertainties

  eval/
    04-taxonomy-and-schema.md      ← taxonomy axis definitions + work pack JSON schema
    05-rubric-v1.md                ← 20-item eval rubric (13 Auto, 7 Human)

  docs/
    06-iteration-log.md            ← full iteration log: classify v0-v4, cluster v1-v3
    07-case-study-draft.md         ← English case study narrative
    10-next-chat-handover.md       ← rewritten at each stage boundary; currently points to Stage 6
    11-cluster-spec.md             ← clustering design rationale, merge-threshold logic, scale upgrade trigger
    12-cluster-eval.md             ← clustering vs. golden-set-hypothesis comparison report (regenerated each cluster.py run)
    eval-results-v0.json .. v4.json     ← classification stage eval history
    eval-results-v3-reverted.json       ← failed prompt attempt, kept for case study evidence

  pipeline/
    data_loader.py                 ← parses data/02-synthetic-feedback-25.md
    pii.py                         ← regex PII redaction (runs before classification)
    classify.py                    ← per-item classification (intent/dimension/impact/urgency/confidence)
    classify_all.py                ← runs classify.py over all items, not just the golden-20
    cluster.py                     ← Stage 5: clustering + deterministic signal_strength + golden-set comparison report
    smoke_test_cluster.py          ← isolated positive/negative merge test, never touches real data
    eval.py                        ← classification accuracy scoring against the golden-20
    prompts/
      classify.txt                 ← versioned separately from code (classify-v5 currently)
      cluster.txt                  ← versioned separately from code (cluster-v3 currently)
    output/
      classified-25-v4.json        ← latest full classification run (all 29 items)
      clusters-v1.json             ← latest cluster.py output
```

---

## Pipeline stages

Verbatim from `project-context.md §2`:

```
ingest
  → PII redaction            (regex; runs BEFORE quotes are extracted)
  → intent classification    (actionable bug / feature request / complaint / praise / noise)
  → dimension + severity tagging
  → clustering               (group items describing the same issue)
  → signal-strength scoring  (how much this cluster is worth acting on)
  → work-pack generation     (per cluster)
  → runtime checks           (the programmatic subset of the rubric)
  → export                   (Markdown + JSON)
```

`intent` and `dimension` are orthogonal axes: intent answers "should this become an action?", dimension answers "who owns it?".

---

## How to run eval

| Asset | Path |
|---|---|
| Pipeline input | `data/02-synthetic-feedback-25.md` (29 items) |
| Ground truth (golden set) | `data/03-golden-set-labeled.md` |
| Rubric | `eval/05-rubric-v1.md` (20 items) |

**Classification eval** (golden-20 only, scored accuracy):
1. `python pipeline/eval.py` — runs classify.py on the 20 golden-set items, scores against ground truth, writes `docs/eval-results-v{N}.json`.
2. Current scores (classify-v5, frozen — see golden set note #5): intent 90% / dimension 90% / impact 75% / urgency 85% / overall 65%.

**Full classification + clustering** (all 29 items, no scored accuracy — compared against a hypothesis, not strict ground truth):
1. `python pipeline/classify_all.py` — classifies every item, writes `pipeline/output/classified-25-v4.json`.
2. `python pipeline/cluster.py` — clusters all items, computes signal_strength, writes `pipeline/output/clusters-v1.json` and `docs/12-cluster-eval.md` (comparison against the golden set's cluster hypothesis).
3. `cluster.py` raises `ClusteringScaleError` above 50 items — see "Known gaps" below before raising that threshold.

Auto rubric checks (R-01–R-04, R-06, R-08–R-09, R-13–R-17, R-19) run programmatically on every output. Human checks (R-05, R-07, R-10–R-12, R-18, R-20) are scored offline by a human reviewer. Record scores and failure notes in `docs/06-iteration-log.md`.

RAG context for the Vela Pay demo arm: stuff all four documents from `data/01-vela-pay-context-docs.md` into the prompt. Cite source clause IDs (SP-x, TG-x, KI-x, RM-x) in `source_refs[]`. Not yet used — no pipeline stage performs RAG-grounded generation until work-pack generation (Stage 6) is built.

---

## Security rules

- **Never commit API keys or secrets** to this repo.
- Store all secrets in `.env` (already listed in `.gitignore`).
- The demo uses synthetic data only — no real company, product, or person represented.

---

## Language rule

All code comments, docstrings, and file content must be written in **English**.

---

## Known gaps

- **Taxonomy values, severity thresholds, review triggers** — still `[PENDING-EVIDENCE]`; values in `eval/04-taxonomy-and-schema.md` are `[FLUID]`.
- **Query-time dimension filter** — `(proposed)`; not yet built.
- **Signal-strength scoring referencing external context docs** — mostly moot now: the one case that motivated this question (CLU-001) was resolved by adding real in-dataset duplicates (FB-26/FB-27) rather than by deciding the general question. The general question (should a single-member cluster ever cite external doc evidence like KI-x recurrence to justify High) remains open in principle but has no live case forcing a decision — see `data/03-golden-set-labeled.md` note #4.
- **Dimension labels for praise/noise** — still `[PENDING-EVIDENCE]`; unrelated to the Stage 5 merge-threshold decision (that was about whether to merge, not whether dimension is populated).
- **Impact × Urgency "Critical" shorthand** — still `[PENDING-EVIDENCE]`.
- **Clustering scale limit** — single-call clustering (`pipeline/cluster.py`) has only been validated up to 29 items. Hard guard at `MAX_SINGLE_CALL_ITEMS=50`. Upgrade trigger (do not raise the limit without this): a 100+ item synthetic stress test showing <90% recall on known duplicate pairs. Full rationale in `docs/11-cluster-spec.md`. Deliberately not built now — see iteration log 2026-06-16 for the cost/benefit reasoning.
- **README.md** — still a 2-line placeholder. The locked decision (project-context.md §0) requires it to carry the case-study narrative. Deliberately deferred until `docs/07-case-study-draft.md` Sections 4–5 are filled, to avoid writing it twice. Do this immediately after the case study fill, same session if possible — do not let it slip to "later."
- **Productization / monetization** — `[DEFERRED]` until eval results exist (they now do, for classification + clustering; work-pack generation results are still pending).
