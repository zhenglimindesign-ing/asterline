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

load_dotenv()

MODEL = "claude-sonnet-4-6"
PROMPT_VERSION = "generate-v1"

REPO_ROOT = Path(__file__).parent.parent
PROMPT_PATH = Path(__file__).parent / "prompts" / "generate.txt"
CLUSTERS_PATH = REPO_ROOT / "pipeline" / "output" / "clusters-v1.json"
CLASSIFIED_PATH = REPO_ROOT / "pipeline" / "output" / "classified-25-v4.json"
FEEDBACK_PATH = REPO_ROOT / "data" / "02-synthetic-feedback-25.md"
CONTEXT_DOCS_PATH = REPO_ROOT / "data" / "01-vela-pay-context-docs.md"

WORKPACKS_JSON_PATH = REPO_ROOT / "pipeline" / "output" / "workpacks-v1.json"
WORKPACKS_MD_PATH = REPO_ROOT / "pipeline" / "output" / "workpacks-v1.md"
LOG_PATH = REPO_ROOT / "pipeline" / "output" / "workpack-generation-log.json"

CONFIDENCE_RANK = {"High": 3, "Medium": 2, "Low": 1}
RANK_TO_LABEL = {v: k for k, v in CONFIDENCE_RANK.items()}

BANNED_PHRASES = [
    "sorry for the inconvenience",
    "sorry for any inconvenience",
    "thank you for your patience",
    "as quickly as possible",
    "we apologize for",
    "we're sorry to hear",
]

RELATIVE_TIME_RE = re.compile(
    r"\b(yesterday|today|tomorrow|\d+\s+(day|days|hour|hours|week|weeks)\s+ago|"
    r"recently|last\s+(week|month|year)|soon|shortly)\b",
    re.IGNORECASE,
)

MONEY_OR_TIME_RE = re.compile(
    r"\$\d|\d+\s*(day|days|business day)|\d{4}-\d{2}-\d{2}|VP-\d+"
)

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


def parse_valid_clause_ids(context_docs_text: str) -> set:
    """Parse valid SP-x/TG-x/KI-x/RM-x IDs from the context doc itself, not a
    hardcoded list — keeps the doc as the single source of truth (see
    docs/13-workpack-spec.md)."""
    return set(re.findall(r"\*\*((?:SP|TG|KI|RM)-\d+)\.\*\*", context_docs_text))


def load_clusters(path: Path) -> list:
    return json.loads(path.read_text(encoding="utf-8"))["clusters"]


def load_classified(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {r["feedback_id"]: r for r in data["results"]}


def compute_dimension_distribution(members: list, classified: dict) -> list:
    counts: dict = {}
    for m in members:
        dim = (classified.get(m, {}).get("classification") or {}).get("dimension")
        if dim:
            counts[dim] = counts.get(dim, 0) + 1
    sorted_dims = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return [{"dimension": d, "count": c} for d, c in sorted_dims]


def compute_cluster_confidence(members: list, classified: dict) -> str:
    """Most conservative (lowest) confidence among cluster members."""
    ranks = []
    for m in members:
        conf = (classified.get(m, {}).get("classification") or {}).get("confidence")
        if conf in CONFIDENCE_RANK:
            ranks.append(CONFIDENCE_RANK[conf])
    if not ranks:
        return "Low"
    return RANK_TO_LABEL[min(ranks)]


def get_cluster_intent_type(members: list, classified: dict, cluster_id: str) -> str:
    intents = {
        (classified.get(m, {}).get("classification") or {}).get("intent_type")
        for m in members
    }
    intents.discard(None)
    if len(intents) != 1:
        raise ValueError(f"members have inconsistent intent_type: {intents}")
    return next(iter(intents))


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


def apply_deterministic_fields(
    content: dict, cluster: dict, intent_type: str, dimension_dist: list,
    confidence: str, valid_clause_ids: set, feedback_by_id: dict,
) -> dict:
    """Overwrite/enforce all deterministic fields and run auto rubric checks."""
    workpack = dict(content)
    workpack["cluster_id"] = cluster["cluster_id"]
    workpack["cluster_members"] = cluster["cluster_members"]
    workpack["signal_strength"] = cluster["signal_strength"]
    workpack["intent_type"] = intent_type
    workpack["dimension"] = dimension_dist
    workpack["confidence"] = confidence

    quality_flags = list(workpack.get("quality_flags") or [])
    review_flags = list(workpack.get("review_flags") or [])

    # R-13/14/15: noise enforcement, regardless of model output
    if intent_type == "noise":
        workpack["reply_draft"] = None
        workpack["tasks"] = []
        workpack["key_quotes"] = []

    # tasks=[] for praise too (schema field-rules table)
    if intent_type == "praise":
        workpack["tasks"] = []

    # R-02: truncate key_quotes to 2
    quotes = workpack.get("key_quotes") or []
    if len(quotes) > 2:
        quotes = quotes[:2]
        workpack["key_quotes"] = quotes

    # R-03: verbatim check against the union of all members' raw_text
    # (known limitation: no per-quote attribution to a specific member — see
    # docs/13-workpack-spec.md)
    all_raw_text = "\n".join(
        redact(feedback_by_id[m]["raw_text"])[0] for m in cluster["cluster_members"]
    )
    for q in quotes:
        if q not in all_raw_text:
            quality_flags.append({
                "flag": "fabricated_quote",
                "reason": f"quote not found verbatim in any cluster member's raw_text: {q!r}",
            })

    # R-16: cluster_members reference validity
    invalid_members = [m for m in cluster["cluster_members"] if m not in feedback_by_id]
    if invalid_members:
        quality_flags.append({
            "flag": "invalid_cluster_reference",
            "reason": f"unknown feedback_ids: {invalid_members}",
        })

    # R-19: confidence=Low -> needs_human_review must be present
    if confidence == "Low":
        has_flag = any(f.get("flag") == "needs_human_review" for f in review_flags)
        if not has_flag:
            review_flags.append({
                "flag": "needs_human_review",
                "reason": "Pipeline confidence is Low for this cluster.",
                "blocks": "reply_draft",
            })
        quality_flags.append({
            "flag": "low_confidence",
            "reason": "confidence=Low for this cluster",
        })

    # R-01: relative-time scan
    text_fields = " ".join(filter(None, [
        workpack.get("problem_brief") or "",
        " ".join(quotes),
        workpack.get("reply_draft") or "",
    ]))
    if RELATIVE_TIME_RE.search(text_fields):
        quality_flags.append({
            "flag": "ambiguous_timestamp",
            "reason": "relative time expression detected in problem_brief/key_quotes/reply_draft",
        })

    # R-08: banned filler phrases
    reply_lower = (workpack.get("reply_draft") or "").lower()
    for phrase in BANNED_PHRASES:
        if phrase in reply_lower:
            quality_flags.append({
                "flag": "tone_violation",
                "reason": f"banned phrase detected: {phrase!r}",
            })

    # R-09: money/timing-first sentence check
    source_refs = workpack.get("source_refs") or []
    has_sp_ref = any(ref.startswith("SP-") for ref in source_refs)
    reply_draft = workpack.get("reply_draft")
    if intent_type in ("actionable_bug", "complaint") and has_sp_ref and reply_draft:
        first_sentence = re.split(r"(?<=[.!?])\s", reply_draft.strip())[0]
        if not MONEY_OR_TIME_RE.search(first_sentence):
            quality_flags.append({
                "flag": "tone_violation",
                "reason": "first sentence of reply_draft does not reference transaction/amount/timing",
            })

    # source_refs existence check — clause IDs parsed at runtime from the
    # context doc itself, not a hardcoded list (see docs/13-workpack-spec.md)
    for ref in source_refs:
        if ref not in valid_clause_ids:
            quality_flags.append({
                "flag": "fabricated_source_ref",
                "reason": f"cited clause {ref!r} not found in data/01-vela-pay-context-docs.md",
            })

    workpack["review_flags"] = review_flags
    workpack["quality_flags"] = quality_flags
    return workpack


def validate_required_fields(workpack: dict) -> Optional[str]:
    """R-04 and R-17 hard_fail checks. Returns an error message if hard_fail, else None."""
    for task in workpack.get("tasks") or []:
        if (
            not task.get("assignee_team")
            or task.get("priority") not in ("High", "Medium", "Low")
            or not task.get("acceptance_criteria")
        ):
            return "R-04 hard_fail: a task is missing assignee_team, valid priority, or acceptance_criteria"
    if workpack.get("confidence") not in CONFIDENCE_RANK:
        return "R-17 hard_fail: confidence is not a valid enum value"
    return None


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
            intent_type = get_cluster_intent_type(members, classified, cluster_id)
            dimension_dist = compute_dimension_distribution(members, classified)
            confidence = compute_cluster_confidence(members, classified)
            members_block = build_member_block(members, feedback_by_id)

            content = generate_workpack_content(intent_type, members_block, context_docs_text)
            workpack = apply_deterministic_fields(
                content, cluster, intent_type, dimension_dist, confidence,
                valid_clause_ids, feedback_by_id,
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
