# Asterline — Project Context

> **The single source of truth for this project.** This is the only file kept inside the Claude Project (auto-loaded once per chat, then resident for that chat). All other working files (data, taxonomy, eval plan, golden set) live locally and are pasted into the relevant chat only when needed.
>
> **What belongs in this file:** a line earns its place only if it is *both* (a) stable enough to outlast many chats and (b) useful in most chats. Fast-churning detail goes to a local working file and is brought in on demand. The real cost of this file is not tokens — it is drift: any stale line silently misleads every future chat.
>
> **Decision tiers:**
> - `[LOCK]` — settled now; do not re-open without flagging an explicit reason.
> - `[FLUID]` — a v1 value we build with now, but expect to change through eval iteration. Never treat as settled.
> - `[PENDING-EVIDENCE]` — not yet decided; unblocks once the golden set / real examples exist. (Distinct from `[FLUID]`: there is no working value yet.)
> - `(proposed)` — a recommendation awaiting Limin's confirmation; a quick yes/no, no new data required.
> - `[DEFERRED]` — deliberately out of current scope; revisit at a named later milestone.

---

## 0. Purpose & success criteria

- This is a **job-search evidence pack**, not (yet) a maintained product. Target roles: AI Product Manager / Technical Product Manager.
- Deliverables: (1) a **deployed demo** (public link, synthetic data), (2) an **eval harness** (golden set + rubric + before/after iteration log), (3) a **case study** (English).
- The artifact must visibly demonstrate three capabilities: **eval design, iteration, traceability**.
- `[LOCK]` Deploy a live demo. [LOCK] Open-source the repo, with a README that carries the case-study narrative (never commit API keys). Productizing for real users = a separate decision point after eval results exist `[DEFERRED]`.

---

## 1. Decision log (tiered)

| # | Decision | Tier |
|---|---|---|
| 1 | Tool name: **Asterline** — "Connect scattered signals into product direction." | `[LOCK]` |
| 2 | Demo product: **Vela Pay** — "Stablecoin payments across borders." (B2B cross-border / corporate cards / payouts for SMEs.) | `[LOCK]` |
| 3 | Core function: raw feedback → traceable, ready-to-work **work packs** | `[LOCK]` |
| 4 | Primary user: whoever digests feedback (small team / indie builder) — **no fixed role** | `[LOCK]` |
| 5 | Inputs: **paste / CSV upload / built-in data pack** (demo + stress packs) | `[LOCK]` |
| 6 | Export: **Markdown** (human) + **JSON** (machine, Jira/Linear-shaped fields, no live API in v1) | `[LOCK]` |
| 7 | Pipeline skeleton (see §2) | `[LOCK]` |
| 8 | Taxonomy **axes** (intent / dimension / severity / signal-strength) | `[LOCK]` |
| 8b | Taxonomy **values**, severity thresholds, signal scale, review triggers, rubric items | `[PENDING-EVIDENCE]` |
| 9 | HITL touchpoints & which are blocking (see §4) | `[LOCK]` |
| 10 | RAG: stuff ~4 context docs into the prompt, cite source clause; **no vector DB in v1**, upgrade trigger documented | `[LOCK]` |
| 11 | PII: regex redaction + no persistence + synthetic-only demo. Production hardening = separate workstream. | `[LOCK]` (demo) |
| 12 | Work pack v1 field set (see §3) — updated in Workstream B chat | `[FLUID]` |
| 13 | Query-time filter by dimension (e.g. "show only design signals") — view/filter, not a role-permission system | `(proposed)` |
| 14 | Language: Chinese in chat, English in all deliverables | `[LOCK]` |

---

## 2. Pipeline skeleton `[LOCK]`

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

`intent` and `dimension` are **orthogonal axes**: intent answers "should this become an action?", dimension answers "who owns it?".

---

## 3. Work pack — v1 field set `[FLUID]`

The field *structure* below reflects decisions made during Workstream B (golden set + rubric design).
Field *values* (content) churn during eval, so worked examples live in `data-and-taxonomy.md`.

Fields:
`cluster_id / cluster_members[] / title / signal_strength / intent_type / confidence /
problem_brief / key_quotes[] / source_refs[] /
tasks[](each with: task + assignee_team + priority + deadline? + acceptance_criteria) /
reply draft / review_flags[](each with: flag + reason + blocks) /
quality_flags[](each with: flag + reason)

**Removed from original spec:** `qa_cases[]` — work packs are triage artifacts;
QA test cases are written by engineers after task pickup, not at triage stage.

**Execution order when review_flags is non-empty:**
- tasks[] may proceed immediately (parallel to human review)
- reply_draft is blocked until needs_human_review is cleared by a human
- The `blocks` field in each review_flag specifies exactly what is gated

**Null/empty conventions:**
- Empty arrays: `[]`
- Optional non-array fields not applicable: `null`
- Never use the string `"N/A"` in any field


A full worked example (Vela Pay) — one card that shows traceability (quotes/refs link back), RAG (cites a policy clause), and HITL (a review flag) at once — lives in `data-and-taxonomy.md`. Bring it into chat when working on work-pack design.

---

## 4. Human-in-the-loop map `[LOCK]` (positions)

| Touchpoint | Blocking? |
|---|---|
| After clustering, before generation — edit/merge/split clusters | No (advisory; proceeds with AI clusters if untouched) |
| `needs_human_review` gate before export — flagged items only | **Yes**, but only for flagged items (money/timing replies, low-confidence clusters) |
| After generation, before export — edit the work pack | No (advisory) |
| Offline golden-set labeling | N/A — dev-side ground truth |

Principle: review **blocks only where the cost of error is highest** (money-touching replies); everywhere else it is advisory, so the tool stays fast.

---

## 5. Eval approach (high level; values and rubric items are decided against the golden set)

- **The standard** = golden set (~20 labeled items) + rubric (scoring checklist) + taxonomy values. Stabilize this BEFORE mass generation, so "what counts as good" isn't re-decided every iteration.
- **Offline eval**: score the golden set against the rubric; track scores across prompt versions; keep a failure log.
- **Runtime check**: the programmatic subset of the same rubric runs in-product on the tool's own output (e.g. flags banned phrasing, checks that a reply cites a source).
- Lock the standard; keep the generated output `[FLUID]` — the output is exactly what the iteration story improves.

---

## 6. Data sources & context posture `[LOCK]`

Context always helps; the product always uses whatever context is available. The three sources differ only in **how much** context exists — a feature of the eval design, not a claim that context is optional.

| Source | Context | Purpose |
|---|---|---|
| Demo (Vela Pay) | Rich, authored (4 docs) | Best-case quality + RAG citation |
| Stress test (public dataset, optional) | No-context arm; optional quick-context arm | Measure the **delta** — how much the context scaffold contributes |
| User data | Optional but encouraged | Degrades gracefully without it |

Vela Pay context docs to author (before the golden set exists): product one-pager · support policy · tone guideline · known-issues/roadmap.

---

## 7. Where work happens

- **This Project (Claude.ai chat)**: product definition, golden-set / taxonomy / rubric co-build, case study.
- **Claude Code**: pipeline build + eval loop.
- **Files**: this file is the only auto-loaded Project file. `data-and-taxonomy.md` (incl. the work-pack worked example), `eval-plan.md`, `golden-set.csv` are local; bring them into the relevant chat on demand.

---

## 8. Open / not yet decided

- Taxonomy values, severity thresholds, signal scale, review triggers, rubric items — `[PENDING-EVIDENCE]`.
- Query-time dimension filter — `(proposed)`, confirm during build.
- Productization / monetization — `[DEFERRED]` until eval results exist.
- Signal-strength: whether scoring may reference external context doc evidence (e.g. KI-x noting recurrence)
in addition to in-dataset item count — `[PENDING-EVIDENCE]`
- Dimension labels for praise/noise intents: whether dimension should be required, optional, or excluded
for non-actionable intent types — `[PENDING-EVIDENCE]`
- Impact × Urgency combined "Critical" shorthand for High+High cases — `[PENDING-EVIDENCE]`
