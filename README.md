# Asterline

**Live site:** [asterline.liminzheng.com](https://asterline.liminzheng.com)

Turns raw user feedback into traceable, ready-to-work product packs.

Asterline is an open-source feedback-to-work-pack pipeline. The product itself (a feedback triage tool) is not the point — the point is demonstrating three capabilities central to AI product work:

1. **Eval design** — defining what "good" looks like before generating at scale: a golden set, a taxonomy, and a 20-rule rubric with both automated and human-judgment checks.
2. **Iteration** — running the pipeline, measuring against the rubric, finding where it fails, changing something specific, and measuring again. Failed attempts are kept, not hidden (see [`docs/eval-results-v3-reverted.json`](docs/eval-results-v3-reverted.json)).
3. **Traceability** — every output can be traced back to specific raw feedback items and, where applicable, specific policy clauses. Nothing is generated without a source.

The demo uses a synthetic B2B payments product (Vela Pay) with authored context documents, synthetic feedback, and a hand-labeled golden set. All data is synthetic; the eval process is real.

**Full case study:** [`docs/07-case-study.md`](docs/07-case-study.md)

## What the output looks like

Each cluster of related feedback produces a **work pack** — a triage artifact with a problem summary, key quotes, suggested tasks, a draft customer reply, and flags for human review where the stakes require it. Here is an abbreviated example:

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

All 22 work packs are in [`pipeline/output/workpacks-v1.md`](pipeline/output/workpacks-v1.md).

## Pipeline stages

```
Raw feedback
  → PII redaction
  → Intent classification    (actionable_bug / feature_request / complaint / praise / noise)
  → Dimension + severity tagging
  → Clustering               (group items describing the same underlying issue)
  → Signal-strength scoring  (deterministic — not a model opinion)
  → Work-pack generation     (one per cluster, RAG-grounded against context docs)
  → Runtime checks           (14 rubric items checked programmatically on every output)
  → Export                   (Markdown + JSON with Jira/Linear-shaped fields)
```

## Build results

| Stage | Versions iterated | Result |
|---|---|---|
| 1–4. Classification (intent / dimension / impact / urgency) | 5 prompt versions | intent 90% / dimension 90% / impact 75% / urgency 85% |
| 5. Clustering + signal-strength | 3 prompt versions | 22 clusters; validated no false merges on known-distinct pairs |
| 6. Work-pack generation | 9 prompt versions (generate-v1→v9) | 22/22 clusters; 0 fabricated quotes; human eval complete |

## Repo structure

```
data/      synthetic feedback, context docs, golden set + cluster hypothesis
eval/      taxonomy, schema, rubric
pipeline/  classification, PII redaction, clustering, generation
docs/      iteration log, case study, cluster spec, eval results
web/       deployed product site (static, served via Vercel)
```

For contributor / Claude Code instructions, see [`CLAUDE.md`](CLAUDE.md).

## Running it

```bash
cp .env.example .env   # fill in ANTHROPIC_API_KEY
pip install -r requirements.txt
python pipeline/eval.py            # classification accuracy vs. golden set
python pipeline/classify_all.py    # classify all 29 items
python pipeline/cluster.py         # cluster + signal_strength + comparison report
python pipeline/generate.py        # work-pack generation (Sonnet, RAG-grounded)
```
