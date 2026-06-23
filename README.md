# Asterline

**Live demo:** [asterline.liminzheng.com](https://asterline.liminzheng.com) · **Case study:** [`CASE-STUDY.md`](CASE-STUDY.md)

Turns raw, unstructured feedback into traceable work packs — one per underlying issue, each backed by the quotes that surfaced it, the tasks it implies, and a drafted reply that waits on a human before it goes anywhere.

Built for whoever ends up with the feedback inbox. No assumed role, no assumed team size.

---

## Pipeline

| Stage | Executor | Prompt | What happens |
|---|---|---|---|
| 1. Ingest | Python | — | `"Tried to upload our payroll CSV..."` → structured dict with feedback_id, channel, account, raw_text |
| 2. PII redaction | Python | — | `user@company.com` → `[REDACTED]` · emails, phones, account IDs stripped before any model sees the text |
| 3. Intent classification | Haiku | [`classify.txt`](pipeline/prompts/classify.txt) | → `intent: actionable_bug` · one of five types: actionable bug, feature request, complaint, praise, noise |
| 4. Dimension + severity | ↑ same call | — | → `dimension: Engineering, impact: High, urgency: High` · co-determined with intent for label consistency |
| 5. Clustering | Haiku | [`cluster.txt`](pipeline/prompts/cluster.txt) | FB-01 + FB-26 + FB-27 → CLU-001 · groups items describing the same underlying issue |
| 6. Signal-strength | Python | — | 3 members × 3 accounts × High severity → `signal: High` · deterministic formula, not a model opinion |
| 7. Work-pack generation | Sonnet + Python | [`generate.txt`](pipeline/prompts/generate.txt) | CLU-001 → title, problem brief, key quotes, tasks, reply draft, review flags · Sonnet generates; Python overwrites deterministic fields and runs 14 auto-checks |
| 8. Export | Python | — | → Markdown for humans + JSON shaped for Jira or Linear |

**Model selection.** Haiku for classification/clustering (short output, speed matters). Sonnet for generation (Haiku was tested and failed on constraint density across 14 rubric rules). Opus not needed — Sonnet meets the rubric at acceptable quality.

**Nothing sends itself.** Tasks are recommendations, not filed tickets. Any reply touching money, timing, or policy is blocked by a review flag until a human verifies it.

Full design decisions, model/deterministic split rationale, and iteration history in the [case study](CASE-STUDY.md).

---

## Live pipeline

The pipeline runs live at [asterline.liminzheng.com](https://asterline.liminzheng.com):

- **Paste feedback** or **upload CSV** — full 8-stage pipeline in real time (up to 3 items per run, 5 runs/day)
- **CFPB complaints** — 150 real consumer financial complaints from the CFPB public database, sampled and run live
- **Vela Pay demo** — 22 work packs from the offline pipeline (generate-v9) with full context docs, cached for speed

---

## Build results

| Stage | Versions | Result |
|---|---|---|
| Classification | 5 prompt versions (1 reverted) | intent 90% · dimension 90% · impact 75% · urgency 85% · overall 65% |
| Clustering | 3 prompt versions | 22 clusters; no false merges; true-merge validated on real data |
| Generation | 9 prompt versions, 4 human-eval rounds | 22/22 work packs; 0 fabricated quotes; 7 quality flags |

Evaluated against a 20-item hand-labeled golden set and a 20-rule rubric (14 automated, 7 human-judgment). Every version scored against the same standard — including the one that regressed, was reverted, and kept in the log.

---

## Repo structure

```
CASE-STUDY.md    full technical narrative — start here for depth
data/            synthetic feedback, context docs, golden set
eval/            taxonomy, schema, rubric
pipeline/        classification, PII redaction, clustering, generation, prompts
docs/            iteration log (raw data), cluster spec, eval result snapshots
web/             deployed product site (Vercel)
api/             live pipeline endpoint (Vercel Python serverless function)
```

## Running locally

```bash
cp .env.example .env   # fill in ANTHROPIC_API_KEY
pip install -r requirements.txt
python pipeline/eval.py            # classification accuracy vs. golden set
python pipeline/classify_all.py    # classify all 29 items
python pipeline/cluster.py         # cluster + signal_strength + comparison report
python pipeline/generate.py        # work-pack generation (Sonnet, RAG-grounded)
```

For contributor / Claude Code instructions, see [`CLAUDE.md`](CLAUDE.md).
