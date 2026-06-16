# Handover — Vela Pay-2 -> Stage 6

## What this chat completed

**Stage 1-4: Classification pipeline (Layer 1)**, built and iterated to ceiling.

| File | Contents |
|---|---|
| pipeline/prompts/classify.txt | Final classify prompt (classify-v5) |
| docs/eval-results-v0 through v4.json | Full eval history |
| docs/eval-results-v3-reverted.json | Failed v3 attempt, kept as case study evidence |
| docs/06-iteration-log.md | Classification iteration entries (v0->v1, v1->v2, v2->v3 fail, v3->v4) |

Final classification scores: intent 90% / dimension 90% / impact 75% / urgency 85% / overall 65%.

Known ceilings (do not re-attempt in prompt — see data/03-golden-set-labeled.md "Known labeling uncertainties" #5 for full reasoning):
- FB-01: impact/urgency over-estimated — workaround info lives in KI-1 (a context doc), not visible at classification stage. Architectural, not a prompt problem. Will not change after RAG is introduced in Stage 6 generation, because this is a Layer 1 label, not a Layer 2 output.
- FB-23: dimension unstable between Finance & Reporting / Engineering — inherently ambiguous item.
- FB-10: impact over-estimated by one notch; accept as-is.

**Stage 5: Clustering**, built, debated, and validated bidirectionally.

| File | Contents |
|---|---|
| pipeline/cluster.py | Clustering + deterministic signal_strength + golden-set comparison report generator |
| pipeline/prompts/cluster.txt | Final cluster prompt (cluster-v3) |
| pipeline/smoke_test_cluster.py | Isolated mechanism test, never touches real data |
| docs/11-cluster-spec.md | Design rationale, merge-threshold logic, scale upgrade trigger |
| docs/12-cluster-eval.md | Comparison report (regenerated each cluster.py run) |
| data/03-golden-set-labeled.md | Now includes FB-26-29 (clustering positive-controls) and updated cluster hypothesis |

Key decisions (full reasoning in docs/06-iteration-log.md and docs/11-cluster-spec.md, not repeated here):
- Merge threshold varies by intent_type: actionable_bug/feature_request/complaint use a strict "same underlying problem, same fix" standard (validated by CLU-006-022 splitting correctly); praise/noise bulk-merge into one cluster per intent_type regardless of topic (no differentiated action, so no cost to merging coarsely).
- signal_strength is computed deterministically in Python (eval/04-taxonomy-and-schema.md Axis 4), never by the model.
- The original 25-item dataset had no genuine "should merge" case — every multi-member hypothesis tested false-merge avoidance only. Added FB-26/FB-27 (KI-1 duplicate) and FB-28/FB-29 (RM-1 duplicate) as deliberate positive controls. Both merged correctly on real pipeline output, with signal_strength=High via the "≥2 items, different accounts" path firing for the first time.
- Single-call clustering (no embeddings, no pairwise) is validated only up to 29 items. Guard rail `MAX_SINGLE_CALL_ITEMS=50` in cluster.py raises `ClusteringScaleError` above that. Documented upgrade trigger: a 100+ item stress test showing <90% recall on known duplicate pairs. Decided NOT to build a two-stage (candidate-blocking) architecture now — see docs/11-cluster-spec.md "Scale limit and upgrade trigger" for the full cost/benefit reasoning. Do not build this without re-reading that section first.
- FB-02/FB-11 (dashboard currency/amount display issues) deliberately NOT merged despite a shared surface theme — they need different fixes. Recorded as a defensible judgment call in golden set note #6, not an error to fix later.

## Documentation backlog opened this session (2026-06-16) — check before assuming docs are current

- `docs/07-case-study-draft.md` Sections 4-5 — being filled this session, may or may not be done depending on when this doc is read.
- `README.md` — still a 2-line placeholder. Locked deliverable (project-context.md §0) requires it to carry the case-study narrative. Must be written immediately after the case study fill (same batch, not deferred again).

## What Stage 6 should do

Build pipeline/generate.py — work pack generation (Layer 2, with RAG).

**Model choice, decided this session**: use Sonnet (not Haiku) for reply_draft generation specifically. Classification and clustering can stay on Haiku (already validated, no need to re-spend). Reasoning: reply_draft is the densest-constraint, highest-stakes, customer-facing output in the pipeline (must satisfy TG-1 through TG-6 simultaneously, plus rubric items R-08 through R-12, R-19, R-20), and this project's own evidence (Haiku's classification ceiling stalling at 65% overall despite 4 prompt iterations) suggests Haiku has a real calibration limit on nuanced, multi-constraint tasks. Cost difference at this project's volume is negligible (cents), so quality should drive the choice here, not price.

**Input**: cluster output from pipeline/output/clusters-v1.json + the underlying classified items from pipeline/output/classified-25-v4.json.

**Task**: for each cluster, generate a full work pack per the schema in eval/04-taxonomy-and-schema.md Part 2 — title, problem_brief, key_quotes[], source_refs[], tasks[], reply_draft, review_flags[], quality_flags[].

**RAG**: stuff all 4 documents from data/01-vela-pay-context-docs.md into the generation prompt. Cite clause IDs (SP-x, TG-x, KI-x, RM-x) in source_refs[] — only when a real clause matches; never fabricate (rubric R-12).

**Rubric compliance to design for** (eval/05-rubric-v1.md):
- R-01 (absolute timestamps), R-02 (key_quotes <=2), R-03 (verbatim quotes), R-04 (task field completeness) — structural, should be straightforward.
- R-08 (no banned filler phrases), R-09 (money/timing first), R-10 (no blame-shifting), R-11 (no overpromising) — tone, this is where model choice matters most.
- R-07/R-19 (needs_human_review triggers), R-06 (blocks field populated) — HITL flag logic, deterministic where possible (e.g. R-19's confidence=Low trigger should be a code check, not a model judgment, consistent with how signal_strength was kept deterministic in Stage 5).
- R-20 (reply doesn't contradict cited policy) — likely needs human eval, hard to auto-check.

**Cross-review checkpoint**: after generating a few sample work packs, this is a good point to check with the Vela Pay design chat (the other Claude.ai project, which co-designed TG-1-6 and the rubric) — specifically on whether reply_draft tone actually reads as compliant, since that chat has more context on the original intent behind the tone guideline. Not a blocking gate, but worth doing before treating Stage 6 as closed, the same way Stage 5's intent_type merge-threshold decision was a judgment call worth a second opinion.

**Output**: work pack JSON + Markdown export (per project-context.md §1 Decision #6: Markdown for humans, JSON for machines).
