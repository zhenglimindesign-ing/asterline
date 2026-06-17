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
      generate.txt                 ← versioned separately from code (generate-v4 currently)
    output/
      classified-25-v4.json        ← latest full classification run (all 29 items)
      clusters-v1.json             ← latest cluster.py output
      workpacks-v1.json            ← Stage 6 output: 22 work packs (machine-readable)
      workpacks-v1.md              ← Stage 6 output: same content, human-readable
      workpack-generation-log.json ← per-cluster generation status log (success/error/timestamp)

  docs/
    13-workpack-spec.md            ← Stage 6 design spec (model choice, deterministic vs model split, idempotent rerun design)
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
4. `python pipeline/generate.py` — generates one work pack per cluster (Sonnet, generate-v4), writes `pipeline/output/workpacks-v1.json`, `workpacks-v1.md`, `workpack-generation-log.json`. Idempotent: rerunning skips clusters whose membership hasn't changed since the last successful run.

Auto rubric checks (R-01–R-04, R-06, R-08–R-09, R-13–R-17, R-19) run programmatically inside generate.py on every output. Human checks (R-05, R-07, R-10–R-12, R-18, R-20) are scored offline by a human reviewer reading `pipeline/output/workpacks-v1.md`. Record scores and failure notes in `docs/06-iteration-log.md`.

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

**This is the single index for every known gap in the project.** Detailed reasoning lives in exactly one other place per gap (linked below) — this table is never the full explanation, and other docs should not duplicate it either. If you find a gap described in two places, that's a bug in this index — fix it here, don't add a third copy.

| Gap | Status | Detail |
|---|---|---|
| Taxonomy values, severity thresholds, review triggers | `[PENDING-EVIDENCE]` | `eval/04-taxonomy-and-schema.md` — values marked `[FLUID]` |
| Query-time dimension filter | `(proposed)`, not built | `project-context.md` §1 Decision #13 |
| Impact × Urgency "Critical" shorthand | `[PENDING-EVIDENCE]` | `project-context.md` §8 |
| Signal-strength referencing external context docs | Mostly moot | `data/03-golden-set-labeled.md` note #4 — the one live case (CLU-001) was resolved by adding real duplicates (FB-26/27), not by deciding the general question |
| Dimension labels for praise/noise | `RESOLVED` 2026-06-16 | `project-context.md` §8 — dimension is now always populated as a distribution array, not a single forced value |
| Clustering scale limit (single-call clustering validated only to 29 items) | Guard rail in place, not solved | `docs/11-cluster-spec.md` "Scale limit and upgrade trigger" — hard limit `MAX_SINGLE_CALL_ITEMS=50` in `pipeline/cluster.py`; upgrade trigger is a 100+ item stress test showing <90% recall on known duplicates |
| R-03 quote-source ambiguity in multi-member clusters | Known limitation, v1 accepted | `docs/13-workpack-spec.md` — `key_quotes[]` has no per-quote attribution to a specific cluster member; verbatim check matches against the union of all members' raw_text instead |
| source_refs validity check coupled to context-doc formatting | Known limitation, low risk | `docs/13-workpack-spec.md` — clause IDs are parsed at runtime from `data/01-vela-pay-context-docs.md`'s heading format, not hardcoded, but the parser still assumes that exact formatting convention |
| PII redaction doesn't catch names | `[LOCK]`'d v1 limitation, not a bug | `data/02-synthetic-feedback-25.md` header — regex can't reliably match arbitrary names; v2 path is NER |
| generate.py idempotent rerun doesn't detect prompt-version changes | Known limitation, manual workaround exists | `pipeline/generate.py` — the skip check only compares `cluster_members`, not `prompt_version`. A prompt-only change (no cluster membership change) is silently skipped on rerun. Workaround used 2026-06-16: manually remove the affected cluster_id from `workpacks-v1.json` before rerunning. Not fixed because it's a rare case (prompt changes happen less often than reruns) and the workaround is simple — revisit if this becomes frequent. |
| No ingest field validation | v1 limitation, deliberate | `docs/07-case-study-draft.md` §6 — FB-20's missing timestamp is a deliberate test of this gap, not an oversight |
| requirements.txt has no version ceiling | Latent risk, not urgent | no dedicated doc — a future breaking change in the `anthropic` SDK could break a fresh clone; not stage-specific |
| No single orchestration script (classify → cluster → generate run manually in sequence) | Minor convenience gap, growing with each stage | no dedicated doc — worth revisiting once Stage 6 adds a third manual step |
| README.md / case study Stage 6 section | Pending | `docs/07-case-study-draft.md` — needs another pass once Stage 6 (work-pack generation) has output to report |
| Productization / monetization | `[DEFERRED]` | `project-context.md` §8 — eval results now exist for classification + clustering; work-pack generation results are still pending |
