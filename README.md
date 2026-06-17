# Asterline

Turns raw user feedback into traceable, ready-to-work product packs.

Asterline is a feedback-to-work-pack pipeline built as a job-search portfolio project for AI Product Manager / Technical Product Manager roles. The product itself (a feedback triage tool) is not the point — the point is demonstrating three capabilities central to AI product work:

1. **Eval design** — defining what "good" looks like before generating at scale: a golden set, a taxonomy, and a 20-item rubric with both automated and human-judgment checks.
2. **Iteration** — running the pipeline, measuring against the rubric, finding where it fails, changing something specific, and measuring again. Failed attempts are kept, not hidden (see `docs/eval-results-v3-reverted.json`).
3. **Traceability** — every output can be traced back to specific raw feedback items and, where applicable, specific policy clauses. Nothing is generated without a source.

The demo uses a synthetic B2B payments product (Vela Pay) with authored context documents, synthetic feedback, and a hand-labeled golden set. All data is synthetic; the eval process is real.

**Full case study:** [`docs/07-case-study-draft.md`](docs/07-case-study-draft.md)

## Current status

| Stage | Status | Result |
|---|---|---|
| 1-4. Classification (intent / dimension / impact / urgency) | Done, iterated 5 prompt versions | intent 90% / dimension 90% / impact 75% / urgency 85% / overall 65% |
| 5. Clustering + signal-strength | Done, validated both directions (avoids false merges, performs true merges) | See `docs/12-cluster-eval.md` |
| 6. Work-pack generation (RAG-grounded) | Done, iterated 4 prompt versions (generate-v1→v4) | 22/22 clusters generated; 8 quality flags across 5 clusters; human eval (R-05/07/10/11/12/18/20) pending |
| Deployed demo | Not started | — |

## Repo structure

```
data/      synthetic feedback, context docs, golden set + cluster hypothesis
eval/      taxonomy, schema, rubric
pipeline/  classification, PII redaction, clustering — see CLAUDE.md for full file map
docs/      iteration log, case study, cluster spec, eval results
```

For Claude Code / contributor instructions, see [`CLAUDE.md`](CLAUDE.md). For the single source of truth on product decisions, see [`project-context.md`](project-context.md).

## Running it

```bash
cp .env.example .env   # fill in ANTHROPIC_API_KEY
pip install -r requirements.txt
python pipeline/eval.py            # classification accuracy vs. golden set
python pipeline/classify_all.py    # classify all 29 items
python pipeline/cluster.py         # cluster + signal_strength + comparison report
python pipeline/generate.py        # work-pack generation (Sonnet, RAG-grounded)
```
