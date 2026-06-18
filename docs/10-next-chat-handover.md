# Handover — Stage 8 (frontend + open-source packaging)

## What the previous sessions completed (Stages 1–7)

Full pipeline code is done. All stages produce output and can be run in sequence:

```bash
python pipeline/eval.py            # classification accuracy vs golden-20 (Haiku, classify-v5)
python pipeline/classify_all.py    # classify all 29 items
python pipeline/cluster.py         # cluster + signal_strength (Haiku, cluster-v3)
python pipeline/generate.py        # work-pack generation (Sonnet, generate-v9) — idempotent
```

Key output files:
- `pipeline/output/classified-25-v4.json` — 29 items classified
- `pipeline/output/clusters-v1.json` — 22 clusters
- `pipeline/output/workpacks-v1.json` / `workpacks-v1.md` — 22 work packs (generate-v8, stable)
- `pipeline/output/workpack-generation-log.json` — per-cluster generation status

Classification scores (frozen): intent 90% / dimension 90% / impact 75% / urgency 85% / overall 65%.

Work-pack generation: 22/22 clusters, 0 hard_fail. generate-v9 (2026-06-18): 7 quality flags across clusters (ambiguous_timestamp: 5, tone_violation: 1, non_english_feedback: 1), 15 review flags (needs_human_review), 0 fabricated_quote, 0 internal_ref_in_reply, 0 invalid assignee_team.

Stage 7 human eval complete: 12 clusters sampled across 4 rounds (generate-v5 → v9). No blocking issues remain. Full prompt iteration history in `docs/06-iteration-log.md`.

---

## What Stage 8 is

Two tracks:

### Track A: Frontend (Limin leads design; Claude Code implements)

A live demo site is the locked deliverable (project-context.md §0). Confirmed: frontend UI + open-source release.

**Design brief for frontend:** `docs/14-frontend-brief.md` — self-contained brief for the frontend Claude session. Covers product description, pipeline stages, real work pack example, key design decisions, page structure for landing page + product overview, file references, and vocabulary.

**Actual output to display:** `pipeline/output/workpacks-v1.md` and `workpacks-v1.json` — these are stable and ready.

Pages in scope: landing page + product overview. Limin is handling design in a separate Claude session.

### Track B: Documentation final pass

Still pending:
- `docs/07-case-study-draft.md` §5.3 — ✅ updated to generate-v9, final flag counts, and eval completion
- `docs/07-case-study-draft.md` §6 — Known Limitations pass
- `CLAUDE.md` Known gaps table — update README/case study gap to "complete" once case study final pass is done

---

## Output is stable — what that means

Work packs were generated at generate-v9. The output is considered stable. Any future prompt iteration would require:
1. Clearing `pipeline/output/workpacks-v1.json` manually (idempotent skip is by cluster_members, not prompt version)
2. Rerunning `python pipeline/generate.py`
3. Rerunning verification sampling (4 clusters minimum)

Do not start Stage 8 frontend work on a moving target — the output is now frozen at v9.

---

## Decisions to NOT revisit

These are locked or settled — do not reopen without re-reading the reasoning:
- No vector DB in v1 (project-context.md Decision #10)
- Classification stage ceiling (FB-01/10/23) — architectural, not a prompt problem
- Clustering scale limit MAX_SINGLE_CALL_ITEMS=50, upgrade trigger documented (docs/11-cluster-spec.md)
- FB-02/FB-11 NOT merged — defensible judgment call (data/03-golden-set-labeled.md note #6)
- Sonnet (not Haiku) for work-pack generation — based on this project's own evidence (docs/13-workpack-spec.md)
- dimension is always a distribution array, never a single enum (eval/04-taxonomy-and-schema.md)
- CLU-010 opening matrix: "process friction" → acknowledge (not apology) — deliberate framework choice, not a bug (docs/06-iteration-log.md Round 3)
- CLU-016 intent_type=actionable_bug possibly misclassified — known observation, deferred to future classification eval extension (docs/06-iteration-log.md Round 3)
