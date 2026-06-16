# CLAUDE.md — Asterline

## What is Asterline

Asterline is a feedback-to-work-pack pipeline that converts raw user feedback into traceable, ready-to-work work packs. It is a job-search portfolio project demonstrating eval design, iteration, and traceability for AI PM / Technical PM roles.

---

## Repo file inventory & intended folder structure

```
asterline/
  CLAUDE.md                        ← this file
  README.md                        ← project overview (do not edit structure)
  project-context.md               ← single source of truth; stays in root
  .gitignore                       ← .env is listed; never commit secrets

  data/
    01-vela-pay-context-docs.md    ← RAG context docs (product, policy, tone, known issues)
    02-synthetic-feedback-25.md    ← pipeline input: 29 synthetic feedback items (25 original + 4 clustering positive-controls added 2026-06-16)
    03-golden-set-labeled.md       ← ground truth for offline eval

  eval/
    04-taxonomy-and-schema.md      ← taxonomy axis definitions + work pack JSON schema
    05-rubric-v1.md                ← 18-item eval rubric (12 Auto, 6 Human)

  docs/
    06-iteration-log.md            ← prompt iteration log with before/after scores
    07-case-study-draft.md         ← English case study narrative

  pipeline/                        ← pipeline source code (to be built)
    .gitkeep
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
| Pipeline input | `data/02-synthetic-feedback-25.md` |
| Ground truth (golden set) | `data/03-golden-set-labeled.md` |
| Rubric | `eval/05-rubric-v1.md` |

**Offline eval process:**
1. Run the pipeline against `data/02-synthetic-feedback-25.md`.
2. Score pipeline output against `data/03-golden-set-labeled.md` using `eval/05-rubric-v1.md`.
3. Auto checks (R-01–R-04, R-06, R-08–R-09, R-13–R-17) run programmatically on every output.
4. Human checks (R-05, R-07, R-10–R-12, R-18) are scored offline by a human reviewer.
5. Record scores and failure notes in `docs/06-iteration-log.md`.

RAG context for the Vela Pay demo arm: stuff all four documents from `data/01-vela-pay-context-docs.md` into the prompt. Cite source clause IDs (SP-x, TG-x, KI-x, RM-x) in `source_refs[]`.

---

## Security rules

- **Never commit API keys or secrets** to this repo.
- Store all secrets in `.env` (already listed in `.gitignore`).
- The demo uses synthetic data only — no real company, product, or person represented.

---

## Language rule

All code comments, docstrings, and file content must be written in **English**.

---

## Known gaps (`[PENDING-EVIDENCE]` items from `project-context.md §8`)

- **Taxonomy values, severity thresholds, signal scale, review triggers, rubric items** — all `[PENDING-EVIDENCE]`; values in `eval/04-taxonomy-and-schema.md` are first-draft and `[FLUID]` until eval results exist.
- **Query-time dimension filter** — `(proposed)`; confirm during build.
- **Signal-strength scoring** — whether scoring may reference external context doc evidence (e.g. KI-x noting recurrence) in addition to in-dataset item count — `[PENDING-EVIDENCE]`.
- **Dimension labels for praise/noise** — whether dimension should be required, optional, or excluded for non-actionable intent types — `[PENDING-EVIDENCE]`.
- **Impact × Urgency "Critical" shorthand** — whether High+High cases warrant a combined label — `[PENDING-EVIDENCE]`.
- **Productization / monetization** — `[DEFERRED]` until eval results exist.
