# Handover — Vela Pay-2 -> Stage 5

## What this chat completed
Classification pipeline (Layer 1) built and iterated to ceiling.

| File | Contents |
|---|---|
| pipeline/prompts/classify.txt | Final classify prompt (v5, classify-v4 run) |
| docs/eval-results-v0 through v4.json | Full eval history |
| docs/eval-results-v3-reverted.json | Failed v3 attempt, kept as case study evidence |
| docs/06-iteration-log.md | 4 iteration entries (v0->v1, v1->v2, v2->v3 fail, v3->v4) |

## Final classification scores
intent 90% / dimension 90% / impact 75% / urgency 85% / overall 65%

## Known ceilings (do not re-attempt in prompt)
- FB-01: impact/urgency over-estimated — workaround info in KI-1, not visible at Layer 1. This is a classification-stage label; it will not change even after RAG is introduced in Layer 2 generation.
- FB-23: dimension unstable between Finance & Reporting / Engineering — inherently ambiguous item.
- FB-10: impact over-estimated by one notch; accept as-is.

## What Stage 5 should do
Build pipeline/cluster.py.

Input: classified output from classify.py for all 25 items.
Task: group items describing the same problem into clusters.
Reference cluster hypotheses: data/03-golden-set-labeled.md
  (section: "Cluster groupings v1 hypothesis")
Expected clusters: CLU-001, CLU-005, CLU-006-022, CLU-007, CLU-008,
  CLU-012-015, CLU-014, CLU-016, plus single-member clusters.
Key test: CLU-006-022 (FB-06 + FB-22) — pipeline may or may not split
  them; compare to golden set hypothesis and note the difference.

After clustering: compute signal_strength per cluster using taxonomy
definition in eval/04-taxonomy-and-schema.md (Axis 4).

Output: cluster assignments JSON + signal_strength per cluster.
