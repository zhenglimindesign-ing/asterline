# Asterline

**Live demo:** [asterline.liminzheng.com](https://asterline.liminzheng.com) · **Case study:** [`CASE-STUDY.md`](CASE-STUDY.md)

Turns raw user feedback into traceable, ready-to-work product packs.

Asterline is an open-source feedback-to-work-pack pipeline built as a portfolio project for AI PM / Technical PM roles. The product itself (a feedback triage tool) is not the point — the point is demonstrating eval design, iteration discipline, and traceability in an AI pipeline. The case study covers the full reasoning; this README covers the technical facts.

---

## Pipeline architecture

| Stage | Executor | Prompt | Why this executor |
|---|---|---|---|
| 1. Ingest | Python (`data_loader.py` offline; API request body live) | — | Pure I/O: parse Markdown, CSV, or JSON into structured dicts |
| 2. PII redaction | Python (`pii.py`) | — | Regex matching; must run before any text reaches a model |
| 3. Intent classification | Anthropic Haiku (`classify.txt` v5) | [`pipeline/prompts/classify.txt`](pipeline/prompts/classify.txt) | Requires semantic understanding: is this a bug, a feature request, or just noise? |
| 4. Dimension + severity | ↑ same prompt, same call | — | Co-determined with intent for consistency — splitting would risk contradictory labels |
| 5. Clustering | Anthropic Haiku (`cluster.txt` v3) | [`pipeline/prompts/cluster.txt`](pipeline/prompts/cluster.txt) | Cross-item similarity judgment requires reasoning across all items at once |
| 6. Signal-strength | Python (deterministic formula) | — | Member count × account diversity × severity — a defined formula, not a judgment call |
| 7. Work-pack generation | Anthropic Sonnet (`generate.txt` v9) + Python post-processing | [`pipeline/prompts/generate.txt`](pipeline/prompts/generate.txt) | Sonnet generates structured output (title, brief, quotes, tasks, reply draft); Python overwrites deterministic fields and runs 14 auto-checks |
| 8. Export | Python | — | Format Markdown + JSON with Jira/Linear-shaped fields |

**Model selection.** Classification and clustering use Haiku — short-output tasks where speed and cost matter more than prose quality. Generation uses Sonnet — Haiku was tested early on generation and failed on constraint density (14 auto-checked rubric rules). Opus was not needed; Sonnet meets the rubric at acceptable quality for a 22-cluster dataset.

**Deterministic/model split.** The generation prompt asks the model for: title, problem_brief, key_quotes, source_refs, tasks[], reply_draft, review_flags. Python computes everything else: cluster_id, cluster_members, signal_strength, intent_type, dimension, confidence. This keeps model output auditable and deterministic logic testable without an API call.

---

## Live pipeline

The pipeline runs live at [asterline.liminzheng.com](https://asterline.liminzheng.com) via a Vercel Python serverless function (`api/pipeline.py`). Users can:

- **Paste feedback** or **upload CSV** — runs the full 8-stage pipeline in real time, returns real work packs (up to 3 items per run, 5 runs/day)
- **Run CFPB complaints** — 150 real consumer financial complaints from the CFPB public database, sampled and run live with no product context (tests RAG degradation on real-world data)
- **Browse the Vela Pay demo** — 22 pre-generated work packs from the offline pipeline (generate-v9), cached for speed

---

## Build results

| Stage | Versions iterated | Key result |
|---|---|---|
| Classification | 5 prompt versions (v0–v5, including one revert) | intent 90% · dimension 90% · impact 75% · urgency 85% · overall 65% |
| Clustering | 3 prompt versions | 22 clusters; no false merges; true-merge validated on real data |
| Generation | 9 prompt versions, 4 human-eval rounds, 4 auto-check bugs found | 22/22 work packs; 0 fabricated quotes; 7 quality flags (all legitimate) |

For the full accuracy tables, iteration history, and eval methodology, see the [case study](CASE-STUDY.md).

---

## What the output looks like

Each cluster of related feedback produces a **work pack**:

> **CLU-001 — Batch CSV payout upload silently fails for files exceeding 500 rows**
> Signal: High · Intent: actionable_bug · Source: 3 feedback items, 3 accounts
>
> **Problem:** When a batch payout CSV exceeds 500 rows, the upload hangs indefinitely with no error message — leaving finance teams unable to determine whether payments were dispatched.
>
> **Key quote:** *"no error, no confirmation, page just sat there for 10+ minutes"*
>
> **Tasks:** (1) Engineering: reproduce, identify root cause and scope. (2) Product: authorize fix scope.
>
> **Reply draft:** *We're sorry your batch upload hung without any message — not knowing whether your payments went out is not acceptable…*
>
> **Review flag:** Human must confirm payment status for each affected account before sending.

All 22 work packs: [`pipeline/output/workpacks-v1.md`](pipeline/output/workpacks-v1.md).

---

## Repo structure

```
CASE-STUDY.md    full technical narrative (design decisions, eval, iteration, results)
data/            synthetic feedback, context docs, golden set + cluster hypothesis
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
