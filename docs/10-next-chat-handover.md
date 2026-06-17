# Handover — Stage 7 (human eval + documentation + deployment decision)

## What the previous sessions completed (Stages 1–6)

Full pipeline code is done. All stages produce output and can be run in sequence:

```bash
python pipeline/eval.py            # classification accuracy vs golden-20 (Haiku, classify-v5)
python pipeline/classify_all.py    # classify all 29 items
python pipeline/cluster.py         # cluster + signal_strength (Haiku, cluster-v3)
python pipeline/generate.py        # work-pack generation (Sonnet, generate-v4) — idempotent
```

Key output files:
- `pipeline/output/classified-25-v4.json` — 29 items classified
- `pipeline/output/clusters-v1.json` — 22 clusters
- `pipeline/output/workpacks-v1.json` / `workpacks-v1.md` — 22 work packs
- `pipeline/output/workpack-generation-log.json` — per-cluster generation status

Classification scores (frozen): intent 90% / dimension 90% / impact 75% / urgency 85% / overall 65%.

Work-pack generation: 22/22 clusters, 0 hard_fail. 8 real quality flags across 5 clusters after fixing 2 false-positive bugs in auto-checks (documented in docs/06-iteration-log.md Stage 6 entries).

Full iteration history in `docs/06-iteration-log.md`. Full spec for generation stage in `docs/13-workpack-spec.md`. All known gaps in `CLAUDE.md` "Known gaps" table (single source of truth).

---

## What Stage 7 is

Three parallel tracks — only human eval blocks the others in practice:

### Track A: Human eval (Limin does the judgment, CC records it)

Read `pipeline/output/workpacks-v1.md`. For each work pack, make binary pass/fail/N/A calls on the 7 human-mode rubric items from `eval/05-rubric-v1.md`:

| Item | What to check | N/A when |
|---|---|---|
| R-05 | acceptance_criteria specific and verifiable, not "issue resolved" | tasks=[] |
| R-07 | reply touching money/timing/policy has needs_human_review flag | reply_draft=null |
| R-10 | no blame-shifting language toward the user | reply_draft=null |
| R-11 | no overpromising outcomes outside Vela Pay's control | reply_draft=null |
| R-12 | when source_refs=[], reply doesn't invent policy clauses | source_refs non-empty |
| R-18 | title accurate and specific, not generic | always applies |
| R-20 | reply doesn't contradict its cited SP-x clauses | source_refs=[] |

Limin tells CC the results in chat. CC records them in `docs/06-iteration-log.md` and decides whether a prompt iteration (generate-v5) is warranted. Also: Limin reads for any general quality impressions not captured by the rubric — these matter too.

The 8 existing quality flags to pay attention to during reading:
- CLU-005, CLU-006, CLU-016: `ambiguous_timestamp` — relative time expression detected
- CLU-006, CLU-019, CLU-016: `tone_violation` — first sentence / banned phrase check
- CLU-007, CLU-016: `fabricated_quote` — model paraphrased instead of quoting verbatim (2 genuine cases, not false positives)

### Track B: Documentation (CC does this independently)

- `docs/07-case-study-draft.md` §5 — add Stage 6 results table and the generate-v4 bug stories (two good iteration examples: whitespace false positive, TG/RM regex bug)
- `docs/07-case-study-draft.md` §6 — update Known Limitations to note generate.py idempotency gap (prompt changes don't auto-trigger regeneration)
- `docs/10-next-chat-handover.md` — update this file at each stage boundary (done for Stage 7)
- Wait for human eval results before writing case study final narrative prose

### Track C: Deployment (needs Limin's decision first)

Locked deliverable (project-context.md §0): a live demo. Confirmed: there will be a frontend UI showing the pipeline output + the project will be open-sourced.

**Not started. Blocked on two decisions from Limin:**
1. Frontend shape — what does the UI need to show? (work packs list + individual pack view? live pipeline run in browser? static export only?)
2. Hosting — Vercel / GitHub Pages / something else?

Once decided, implementation is Stage 8. Do not start Stage 8 until human eval is done and the work pack content is stable (a prompt iteration could change the output, and the frontend should show the final version).

Who handles Stage 8: UI/design decisions → Claude.ai chat (the one with more Vela Pay product context); frontend code + open-source packaging → Claude Code.

---

## Decisions to NOT revisit

These are locked or settled — do not reopen without re-reading the reasoning:
- No vector DB in v1 (project-context.md Decision #10)
- Classification stage ceiling (FB-01/10/23) — architectural, not a prompt problem
- Clustering scale limit MAX_SINGLE_CALL_ITEMS=50, upgrade trigger documented (docs/11-cluster-spec.md)
- FB-02/FB-11 NOT merged — defensible judgment call (data/03-golden-set-labeled.md note #6)
- Sonnet (not Haiku) for work-pack generation — based on this project's own evidence (docs/13-workpack-spec.md)
- dimension is always a distribution array, never a single enum (eval/04-taxonomy-and-schema.md)
