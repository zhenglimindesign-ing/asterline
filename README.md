# Asterline

**Live demo:** [asterline.liminzheng.com](https://asterline.liminzheng.com) · **Case study:** [`CASE-STUDY.md`](CASE-STUDY.md)

Product teams drown in feedback. Support tickets, app reviews, NPS comments, and survey responses arrive in different formats, with different levels of specificity, and nobody has time to turn them all into something actionable.

Asterline is an 8-stage pipeline that turns raw, unstructured feedback into traceable work packs — one per underlying issue, each backed by the quotes that surfaced it, the tasks it implies, and a drafted reply that waits on a human before it goes anywhere. The pipeline runs live at [asterline.liminzheng.com](https://asterline.liminzheng.com) — paste your own feedback, upload a CSV, or try 150 real CFPB consumer complaints.

---

## What the output looks like

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

The demo uses Vela Pay, a synthetic B2B payments product with authored context documents and hand-labeled feedback. All data is synthetic; the eval process is real. All 22 work packs: [`pipeline/output/workpacks-v1.md`](pipeline/output/workpacks-v1.md).

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

**Model selection.** Haiku for classification and clustering — short-output tasks where speed and cost matter more than prose quality. Sonnet for generation — Haiku was tested early and failed on constraint density across 14 rubric rules. Opus not needed; Sonnet meets the rubric at acceptable quality.

**Deterministic/model split.** The generation prompt asks the model for: title, problem_brief, key_quotes, source_refs, tasks[], reply_draft, review_flags. Python computes everything else: cluster_id, cluster_members, signal_strength, intent_type, dimension, confidence. This keeps model output auditable and deterministic logic testable without an API call.

**Nothing sends itself.** Tasks are recommendations, not filed tickets. Any reply touching money, timing, or policy is blocked by a review flag until a human verifies it.

---

## Build results

Classification overall accuracy: **40% (v0) → 65% (v4)** across 5 prompt versions, including one that regressed and was reverted.

| Stage | Versions | Result |
|---|---|---|
| Classification | 5 prompt versions (1 reverted) | intent 90% · dimension 90% · impact 75% · urgency 85% · overall 65% |
| Clustering | 3 prompt versions | 22 clusters; no false merges; true-merge validated on real data |
| Generation | 9 prompt versions, 4 human-eval rounds | 22/22 work packs; 0 fabricated quotes; 7 quality flags |

Evaluated against a 20-item hand-labeled golden set and a 20-rule rubric (14 automated, 7 human-judgment). The failed v3 attempt and its eval output are preserved ([`eval-results-v3-reverted.json`](docs/eval-results-v3-reverted.json)). Full accuracy tables (v0–v4) and generation iteration history (v1–v9): [case study §5](CASE-STUDY.md#5-results).

---

## What I built vs. what AI tools did

I used AI coding tools (Claude Code) to write the Python pipeline and build the frontend. I owned:

- **Pipeline architecture** — the 8-stage sequence, the deterministic/model split, which stages use which model and why
- **Prompt design and iteration** — 5 classification versions, 3 clustering versions, 9 generation versions, each driven by eval failures I identified and documented
- **Evaluation system** — golden set curation, rubric design (20 rules, inductively derived), scoring methodology, the decision to revert v3
- **Output schema** — work-pack field definitions, quality_flags taxonomy, review_flags trigger conditions
- **Product decisions** — what to automate vs. require human review, what limitations to accept in v1, what upgrade triggers to document for v2

The prompts went through 17+ versions total. Each change traces to a specific eval failure documented in the [iteration log](docs/06-iteration-log.md).

---

## Repo structure

```
CASE-STUDY.md    full technical narrative — design decisions, eval, iteration, results
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
