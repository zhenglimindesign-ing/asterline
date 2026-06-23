# Asterline

**Live demo:** [asterline.liminzheng.com](https://asterline.liminzheng.com) · **Case study:** [`CASE-STUDY.md`](CASE-STUDY.md)

An 8-stage pipeline that turns raw user feedback into traceable, ready-to-work product packs. Each work pack includes a problem summary, source-linked quotes, suggested tasks, a drafted customer reply, and flags for human review where the stakes require it.

Built as a portfolio project for AI PM / Technical PM roles. The product itself is not the point — the point is demonstrating **eval design**, **iteration discipline**, and **traceability** in an AI pipeline. The [case study](CASE-STUDY.md) covers the full technical narrative: pipeline architecture, design decisions, evaluation methodology, iteration history (including a reverted attempt), and results.

---

## Pipeline

```
Raw feedback → PII redaction → Classification → Clustering → Signal-strength → Generation → Runtime checks → Export
     Python        Python        Haiku (LLM)     Haiku (LLM)     Python        Sonnet (LLM)     Python        Python
```

3 prompts, 17+ prompt versions, 3 models (Haiku for classification/clustering, Sonnet for generation). Full architecture table with model selection rationale in the [case study §2.1](CASE-STUDY.md#21-pipeline).

---

## Live pipeline

The pipeline runs live at [asterline.liminzheng.com](https://asterline.liminzheng.com):

- **Paste feedback** or **upload CSV** — full 8-stage pipeline in real time (up to 3 items per run, 5 runs/day)
- **CFPB complaints** — 150 real consumer financial complaints, sampled and run live
- **Vela Pay demo** — 22 pre-generated work packs from the offline pipeline (generate-v9)

---

## Build results

| Stage | Versions | Result |
|---|---|---|
| Classification | 5 prompt versions (1 reverted) | intent 90% · dimension 90% · impact 75% · urgency 85% · overall 65% |
| Clustering | 3 prompt versions | 22 clusters; no false merges; true-merge validated on real data |
| Generation | 9 prompt versions, 4 human-eval rounds | 22/22 work packs; 0 fabricated quotes; 7 quality flags |

---

## Repo structure

```
CASE-STUDY.md    full technical narrative — start here
data/            synthetic feedback, context docs, golden set
eval/            taxonomy, schema, 20-rule rubric
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
