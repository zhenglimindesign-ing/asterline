"""Stage 6: work pack generation (Layer 2, RAG-grounded).

Generates one work pack per cluster from cluster.py's output. Uses Sonnet
(not Haiku) for generation — see docs/13-workpack-spec.md "Model choice" for
why: reply_draft is the densest-constraint, customer-facing output in the
pipeline, and Haiku's classification-stage ceiling (65% overall despite 4
prompt iterations) is direct evidence in this project that Haiku has a real
calibration limit on nuanced, multi-constraint tasks.

Deterministic fields (dimension distribution, confidence, signal_strength,
intent_type, and all auto rubric checks) are computed/enforced in Python, not
asked of the model — see docs/13-workpack-spec.md for the full split.

Idempotent: rerunning only regenerates clusters that are missing, previously
failed, or whose membership changed since the last run (see docs/13-workpack-spec.md
"Idempotent reruns").

Usage: python pipeline/generate.py
Inputs:
  pipeline/output/clusters-v1.json
  pipeline/output/classified-25-v4.json
  data/02-synthetic-feedback-25.md
  data/01-vela-pay-context-docs.md
Outputs:
  pipeline/output/workpacks-v1.json
  pipeline/output/workpacks-v1.md
  pipeline/output/workpack-generation-log.json
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import anthropic
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.data_loader import load_feedback
from pipeline.pii import redact
from pipeline.runtime_checks import (
    apply_runtime_guardrails,
    get_cluster_intent_type,
    parse_valid_clause_ids,
    validate_required_fields,
)

load_dotenv()

MODEL = "claude-sonnet-4-6"
PROMPT_VERSION = "generate-v9"

REPO_ROOT = Path(__file__).parent.parent
PROMPT_PATH = Path(__file__).parent / "prompts" / "generate.txt"
CLUSTERS_PATH = REPO_ROOT / "pipeline" / "output" / "clusters-v1.json"
CLASSIFIED_PATH = REPO_ROOT / "pipeline" / "output" / "classified-25-v4.json"
FEEDBACK_PATH = REPO_ROOT / "data" / "02-synthetic-feedback-25.md"
CONTEXT_DOCS_PATH = REPO_ROOT / "data" / "01-vela-pay-context-docs.md"

WORKPACKS_JSON_PATH = REPO_ROOT / "pipeline" / "output" / "workpacks-v1.json"
WORKPACKS_MD_PATH = REPO_ROOT / "pipeline" / "output" / "workpacks-v1.md"
LOG_PATH = REPO_ROOT / "pipeline" / "output" / "workpack-generation-log.json"

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def load_clusters(path: Path) -> list:
    return json.loads(path.read_text(encoding="utf-8"))["clusters"]


def load_classified(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {r["feedback_id"]: r for r in data["results"]}


def build_member_block(members: list, feedback_by_id: dict) -> str:
    lines = []
    for fb_id in members:
        item = feedback_by_id[fb_id]
        redacted_text, _ = redact(item["raw_text"])
        lines.append(f"### {fb_id}\nraw_text: {redacted_text}\n")
    return "\n".join(lines)


def generate_workpack_content(intent_type: str, members_block: str, context_docs_text: str) -> dict:
    prompt_template = PROMPT_PATH.read_text(encoding="utf-8")
    prompt = (
        prompt_template
        .replace("{intent_type}", intent_type)
        .replace("{members_block}", members_block)
        .replace("{context_docs}", context_docs_text)
    )
    response = _get_client().messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text
    return json.loads(_strip_code_fence(raw))


def to_markdown(workpacks: list) -> str:
    lines = ["# Asterline — Work Packs", ""]
    for wp in workpacks:
        dim_str = ", ".join(f"{d['dimension']} ({d['count']})" for d in wp.get("dimension", []))
        lines.append(f"## {wp['cluster_id']} — {wp.get('title', '(no title)')}")
        lines.append(f"- intent_type: {wp.get('intent_type')}")
        lines.append(f"- dimension: {dim_str}")
        lines.append(f"- signal_strength: {wp.get('signal_strength')}")
        lines.append(f"- confidence: {wp.get('confidence')}")
        lines.append(f"- cluster_members: {', '.join(wp.get('cluster_members', []))}")
        lines.append("")
        lines.append(f"**Problem brief:** {wp.get('problem_brief')}")
        lines.append("")
        if wp.get("key_quotes"):
            lines.append("**Key quotes:**")
            for q in wp["key_quotes"]:
                lines.append(f"> {q}")
            lines.append("")
        if wp.get("source_refs"):
            lines.append(f"**Source refs:** {', '.join(wp['source_refs'])}")
            lines.append("")
        if wp.get("tasks"):
            lines.append("**Tasks:**")
            for t in wp["tasks"]:
                lines.append(
                    f"- [{t.get('priority')}] {t.get('task')} "
                    f"(assignee: {t.get('assignee_team')}, deadline: {t.get('deadline')})"
                )
                lines.append(f"  Acceptance criteria: {t.get('acceptance_criteria')}")
            lines.append("")
        if wp.get("reply_draft"):
            lines.append("**Reply draft:**")
            lines.append(f"> {wp['reply_draft']}")
            lines.append("")
        if wp.get("review_flags"):
            lines.append("**Review flags:**")
            for f in wp["review_flags"]:
                lines.append(f"- {f.get('flag')}: {f.get('reason')} (blocks: {f.get('blocks')})")
            lines.append("")
        if wp.get("quality_flags"):
            lines.append("**Quality flags:**")
            for f in wp["quality_flags"]:
                lines.append(f"- {f.get('flag')}: {f.get('reason')}")
            lines.append("")
        lines.append("---")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    clusters = load_clusters(CLUSTERS_PATH)
    classified = load_classified(CLASSIFIED_PATH)
    feedback = load_feedback(str(FEEDBACK_PATH))
    feedback_by_id = {f["feedback_id"]: f for f in feedback}
    redacted_text_by_id = {
        feedback_id: redact(item["raw_text"])[0]
        for feedback_id, item in feedback_by_id.items()
    }
    context_docs_text = CONTEXT_DOCS_PATH.read_text(encoding="utf-8")
    valid_clause_ids = parse_valid_clause_ids(context_docs_text)

    existing_workpacks = {}
    if WORKPACKS_JSON_PATH.exists():
        for wp in json.loads(WORKPACKS_JSON_PATH.read_text(encoding="utf-8")):
            existing_workpacks[wp["cluster_id"]] = wp

    workpacks = []
    log_entries = []
    generated = skipped = failed = 0

    print(f"Generating work packs for {len(clusters)} clusters with {MODEL} (prompt {PROMPT_VERSION})...")

    for cluster in clusters:
        cluster_id = cluster["cluster_id"]
        members = cluster["cluster_members"]

        existing = existing_workpacks.get(cluster_id)
        if existing and existing.get("cluster_members") == members:
            workpacks.append(existing)
            skipped += 1
            print(f"  {cluster_id}: SKIP (already generated, membership unchanged)")
            continue

        try:
            intent_type = get_cluster_intent_type(members, classified)
            members_block = build_member_block(members, feedback_by_id)

            content = generate_workpack_content(intent_type, members_block, context_docs_text)
            workpack = apply_runtime_guardrails(
                content,
                cluster_id=cluster_id,
                members=members,
                signal_strength=cluster["signal_strength"],
                classified=classified,
                redacted_text_by_id=redacted_text_by_id,
                valid_clause_ids=valid_clause_ids,
                enable_context_rules=True,
            )

            hard_fail = validate_required_fields(workpack)
            if hard_fail:
                raise ValueError(hard_fail)

            workpacks.append(workpack)
            generated += 1
            print(f"  {cluster_id}: OK")
            log_entries.append({
                "cluster_id": cluster_id,
                "status": "success",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as exc:
            failed += 1
            print(f"  {cluster_id}: ERROR — {exc}")
            log_entries.append({
                "cluster_id": cluster_id,
                "status": "error",
                "message": str(exc),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            if existing:
                workpacks.append(existing)

    WORKPACKS_JSON_PATH.write_text(json.dumps(workpacks, indent=2), encoding="utf-8")
    WORKPACKS_MD_PATH.write_text(to_markdown(workpacks), encoding="utf-8")
    LOG_PATH.write_text(json.dumps(log_entries, indent=2), encoding="utf-8")

    print(f"\n{generated} generated, {skipped} skipped (already done), {failed} failed.")
    if failed:
        print("Failed clusters:")
        for entry in log_entries:
            if entry["status"] == "error":
                print(f"  {entry['cluster_id']}: {entry['message']}")
    print(f"\nOutput: {WORKPACKS_JSON_PATH.relative_to(REPO_ROOT)}")
    print(f"         {WORKPACKS_MD_PATH.relative_to(REPO_ROOT)}")
    print(f"Log:    {LOG_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
