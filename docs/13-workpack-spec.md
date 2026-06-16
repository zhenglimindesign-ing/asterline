# Stage 6 — Work Pack Generation Spec (draft for review, revised after triple self-critique 2026-06-16)

## Inputs

- `pipeline/output/clusters-v1.json` — cluster assignments + signal_strength (Stage 5 output)
- `pipeline/output/classified-25-v4.json` — per-item intent_type/dimension/impact/urgency/confidence (Stage 1-4 output)
- `data/02-synthetic-feedback-25.md` — raw_text per item (re-redacted, same as prior stages)
- `data/01-vela-pay-context-docs.md` — RAG context, stuffed in full per `project-context.md` Decision #10 (no vector DB in v1)

One work pack is generated per cluster. Output: one JSON array (machine) + one Markdown file (human), per project-context.md Decision #6.

## Model choice

`reply_draft` generation uses **Sonnet** (claude-sonnet-4-6), not Haiku — decided in the Stage 5→6 handover. Reasoning: reply_draft is the densest-constraint, customer-facing output in the pipeline (TG-1 through TG-6 simultaneously, plus R-08/R-09/R-10/R-11/R-12/R-20), and Haiku's classification-stage ceiling (stalled at 65% overall despite 4 prompt iterations) is direct evidence in this project that Haiku has a real calibration limit on nuanced, multi-constraint tasks. Cost difference at this project's volume (a few dozen work packs, ever) is cents — not a real constraint.

The rest of the work pack (title, problem_brief, key_quotes selection, tasks[], initial source_refs/review_flags judgment) is generated in the **same single Sonnet call** as reply_draft — not a separate Haiku call — because these fields are interdependent (e.g. reply_draft tone depends on what source_refs were cited; tasks depend on the same problem_brief). Splitting them across two models/calls risks inconsistency between fields that need to agree with each other.

## What's deterministic (Python) vs. model judgment (prompt) — same split principle as Stage 5

Stage 5 kept signal_strength as a fixed rule because it was a lookup over already-structured data, not a natural-language judgment. Same principle applied here:

**Deterministic (computed/enforced in Python, not asked of the model):**

- `signal_strength` — already computed by cluster.py, just carried over unchanged.

- `dimension` (cluster-level) — **revised after review, see eval/04-taxonomy-and-schema.md.** Not a single majority value. Always a distribution array (`[{dimension, count}, ...]`) over cluster_members' individual classified dimensions, sorted by count descending then alphabetically (alphabetical tie-break is only for stable array ordering — it does not pick a "winner," because we no longer collapse to one value). Single-entry array is the expected/common case for actionable_bug/feature_request/complaint clusters. Multiple entries are expected for praise/noise bulk clusters, by design (docs/11-cluster-spec.md) — collapsing those to one value would discard real information about what's actually being praised/reported, which is why the original "majority vote" design was wrong and is not used.

- `confidence` (cluster-level) — the most conservative value among cluster_members' classified confidence. Ordinal mapping: High=3, Medium=2, Low=1; take the minimum across members, then map back to the enum label. Rationale: confidence's only function is gating R-19's human-review trigger — unlike dimension, it isn't content-bearing, so collapsing to the worst case preserves its purpose exactly (a work pack is only as trustworthy as its least-confident member) rather than losing information the way a forced single dimension value would.

- `intent_type` (cluster-level) — taken from any member, since by cluster design all members of a cluster share intent_type. Code asserts this (checks all members agree) rather than silently picking one. **On assertion failure: skip this one cluster, log the error, continue with the rest of the run** — do not abort the whole batch over one cluster's data anomaly. Same failure-handling philosophy as classify_all.py.

- `cluster_members`, `cluster_id` — carried over from cluster.py output unchanged.

- R-02 (key_quotes length ≤ 2) — auto-truncate if the model returns more.

- R-03 (quote verbatim fidelity) — **known limitation, not a clean check.** The work pack schema's `key_quotes[]` has no per-quote attribution to which cluster member it came from (this is an existing schema gap from Stage 1, not introduced here). For multi-member clusters, the check is: does this quote appear verbatim in the raw_text of *any* member of the cluster (not necessarily a specific one)? This is weaker than true per-quote traceability — flagged explicitly in "Known gaps" below, not silently accepted as fine.

- R-04 (task field completeness) — presence/type check; hard_fail if missing, per rubric.

- R-13/R-14/R-15 (noise → reply_draft=null, tasks=[], key_quotes=[]) — enforced in code regardless of what the model returns, not left to model discretion.

- `tasks=[]` for praise too (per schema field-rules table, not just noise) — same enforcement.

- R-16 (cluster_members reference validity) — checked against the input dataset.

- R-17 (confidence populated) — presence/enum check; hard_fail if missing.

- R-19 (confidence=Low → needs_human_review present) — auto-patched: if the cluster-level confidence (computed above) is Low and review_flags doesn't already contain needs_human_review, code adds it.

- R-01 (relative-time regex scan) — quality_flag if a relative time expression is detected in problem_brief/key_quotes/reply_draft.

- R-08 (banned phrase regex scan) — quality_flag if found. Not auto-fixed (rewriting tone automatically risks producing worse text than flagging for review).

- R-09 (money/timing-first scan) — regex/keyword scan of reply_draft's first sentence for transaction ref / amount / date tokens, when intent is actionable_bug/complaint and source_refs includes an SP-x clause; quality_flag if absent.

- **New: source_refs existence check (not in original draft, added after review).** Before accepting a cited clause ID (e.g. "SP-3") in source_refs, verify it actually exists. The valid ID set is **parsed at runtime from `data/01-vela-pay-context-docs.md`** (regex over the doc's own `**SP-1.**` / `**TG-1.**` / `**KI-1.**` / `**RM-1.**` heading pattern) — not a hardcoded list in code, specifically so the context doc stays the single source of truth and this check never goes stale if the doc is edited. Footnote risk: this still couples the parser to the doc's current formatting convention (bold-markdown + number + period); if that formatting ever changes, the regex needs updating — smaller risk than a hardcoded ID list, but not zero. If a cited ID isn't found, quality_flag: fabricated_source_ref (this is a narrower, cheaper check than full R-12 compliance, which still requires human judgment of whether the *content* matches the clause).

**Model judgment (in the generation prompt):**
- `title`, `problem_brief`, `key_quotes` selection (which ≤2 quotes are most signal-rich)
- `source_refs` — which SP-x/KI-x/RM-x clauses actually apply (cites from the 4 stuffed context docs; empty array if none match — must not fabricate, R-12)
- `tasks[]` content — task description, assignee_team, priority, deadline, acceptance_criteria
- `reply_draft` — full customer-facing reply, TG-1 through TG-6
- `review_flags[]` — the model's own initial judgment on R-07 (does this reply touch money/timing/policy enough to need human sign-off before sending) — code only adds R-19's mechanical trigger on top, doesn't replace the model's R-07 judgment
- `quality_flags[]` — model can self-report flags too (e.g. if it knows a quote is paraphrased), code-detected ones are merged in on top, not overwritten

R-05, R-07, R-10, R-11, R-12, R-18, R-20 stay Human-mode per the rubric (offline eval only) — nothing here tries to fully automate them, consistent with the existing rubric design.

## Noise and praise handling

- `noise`: minimal work pack — title + problem_brief only. `tasks=[]`, `key_quotes=[]`, `reply_draft=null`. Enforced in code (R-13/14/15), not trusted to the model.
- `praise`: `tasks=[]` (per schema), but `reply_draft` is populated (e.g. a short thank-you) — schema says null only for noise. `key_quotes` may be populated (no rule against it for praise).

## Output

- `pipeline/output/workpacks-v1.json` — array of work pack objects, schema per eval/04-taxonomy-and-schema.md Part 2.
- `pipeline/output/workpacks-v1.md` — same content, human-readable Markdown (one section per work pack).
- `pipeline/output/workpack-generation-log.json` — per-cluster status (success/error + message + timestamp), kept separate from the main output file so error placeholders never pollute the work-pack schema.

## Idempotent reruns — manual trigger, automatic targeting

Generation is **not** auto-retried in the background. The user decides when to rerun the command. But rerunning the same command does not regenerate everything from scratch:

1. Before generating a cluster's work pack, check whether `workpacks-v1.json` already has a successful entry for that `cluster_id` **and** that entry's `cluster_members` exactly matches the current `cluster_id`'s members from `clusters-v1.json`. Only skip if both match.
2. The member-match check matters because if cluster.py is re-run later (e.g. a prompt change) and produces different membership under the same `cluster_id`, a stale work pack must not be silently treated as still valid just because the ID happens to match.
3. Generate only for clusters that are missing, previously failed, or whose membership changed.
4. At the end of the run, print a clear summary: how many succeeded, how many failed and why (cluster_id + error message), pointing to `workpack-generation-log.json` for the durable record.

This gives manual retry of just the failed clusters without a separate "retry mode" flag — rerunning the same command is the retry.

## What this stage does NOT do

- Does not score R-05/R-07/R-10/R-11/R-12/R-18/R-20 — those stay human-judgment, offline, same as the existing rubric design. This stage produces output; scoring it against those items is a separate, later step (analogous to how eval.py scores classify.py's output).
- Does not implement the "Execution order when review_flags is non-empty" gating (tasks may proceed, reply_draft blocked until human clears the flag) as a real workflow — there's no human-review UI in this project. The work pack JSON correctly records the flag and what it blocks; enforcing the gate is a downstream product concern, out of scope for v1.

## Cross-review checkpoint (after generation, before calling this stage done)

Per the Stage 5→6 handover: generate a few sample work packs, then check with the Vela Pay design chat specifically on reply_draft tone (TG-1 through TG-6) — that chat has more context on the original intent behind the tone guideline than this session does. Not a blocking gate; do after a first generation pass, before treating Stage 6 as closed.

## Known gaps from this stage

Full index: `CLAUDE.md` "Known gaps" — this is the single source of truth across the whole project; entries below are the detailed version, not duplicated in full anywhere else.

- R-03 quote-source ambiguity for multi-member clusters (key_quotes[] has no per-quote attribution to a specific cluster member) — see the R-03 entry above.
- source_refs validity check is coupled to data/01-vela-pay-context-docs.md's current bold-markdown heading format — see the source_refs existence check entry above.
