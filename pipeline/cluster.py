"""Stage 5: cluster classified feedback items, compute signal_strength, and
compare the result against the golden set's cluster hypothesis.

Design rationale: docs/11-cluster-spec.md
  - Clustering: single LLM call over all 25 items (not pairwise, not embeddings).
  - signal_strength: deterministic Python rule (Axis 4 in eval/04-taxonomy-and-schema.md),
    not an LLM judgment — it is a fixed lookup over already-structured fields.

Usage: python pipeline/cluster.py
Inputs:
  pipeline/output/classified-25-v4.json   (from classify_all.py)
  data/02-synthetic-feedback-25.md        (for raw_text, redacted again here)
  data/03-golden-set-labeled.md           (for the comparison table)
Outputs:
  pipeline/output/clusters-v1.json
  docs/12-cluster-eval.md
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

MODEL = "claude-haiku-4-5-20251001"
PROMPT_VERSION = "cluster-v3"

REPO_ROOT = Path(__file__).parent.parent
PROMPT_PATH = Path(__file__).parent / "prompts" / "cluster.txt"
CLASSIFIED_PATH = REPO_ROOT / "pipeline" / "output" / "classified-25-v4.json"
FEEDBACK_PATH = REPO_ROOT / "data" / "02-synthetic-feedback-25.md"
GOLDEN_PATH = REPO_ROOT / "data" / "03-golden-set-labeled.md"
CLUSTERS_OUTPUT = REPO_ROOT / "pipeline" / "output" / "clusters-v1.json"
REPORT_OUTPUT = REPO_ROOT / "docs" / "12-cluster-eval.md"

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


def load_classified(path: Path) -> dict[str, dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {r["feedback_id"]: r for r in data["results"]}


def build_items_block(feedback: list[dict], classified: dict[str, dict]) -> str:
    lines = []
    for item in feedback:
        fb_id = item["feedback_id"]
        record = classified.get(fb_id, {})
        cls = record.get("classification") or {}
        redacted_text, _ = redact(item["raw_text"])
        lines.append(
            f"### {fb_id}\n"
            f"account_id: {item['account_id']}\n"
            f"intent_type: {cls.get('intent_type')}\n"
            f"dimension: {cls.get('dimension')}\n"
            f"raw_text: {redacted_text}\n"
        )
    return "\n".join(lines)


def run_clustering(items_block: str) -> list[dict]:
    prompt_template = PROMPT_PATH.read_text(encoding="utf-8")
    prompt = prompt_template.replace("{items}", items_block)

    response = _get_client().messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text
    parsed = json.loads(_strip_code_fence(raw))
    return parsed["clusters"]


def compute_signal_strength(members: list[str], feedback_by_id: dict, classified: dict) -> str:
    """Axis 4 (eval/04-taxonomy-and-schema.md): deterministic rule over structured fields."""
    accounts = {feedback_by_id[m]["account_id"] for m in members}
    impacts = [
        (classified.get(m, {}).get("classification") or {}).get("impact")
        for m in members
    ]

    if len(members) >= 2 and len(accounts) >= 2:
        return "High"
    if any(i == "High" for i in impacts) and len(members) == 1:
        return "High"
    if len(members) >= 2:
        return "Medium"
    if any(i == "Medium" for i in impacts):
        return "Medium"
    return "Low"


def parse_golden_hypothesis(path: Path) -> dict[str, tuple[str, frozenset]]:
    """Returns feedback_id -> (hypothesis_cluster_id, frozenset of member ids)."""
    content = path.read_text(encoding="utf-8")
    table_match = re.search(
        r"\| Cluster ID \| Members \| Signal-strength \| Notes \|(.*?)\n\n",
        content,
        re.DOTALL,
    )
    if not table_match:
        raise ValueError("Could not find cluster groupings table in golden set")

    mapping: dict[str, tuple[str, frozenset]] = {}
    for line in table_match.group(1).strip().split("\n"):
        if line.startswith("|---") or not line.strip():
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) < 2:
            continue
        cluster_id, members_str = parts[0], parts[1]
        raw_ids = [m.strip() for m in members_str.split(",")]
        # "All others" row uses shorthand like "FB-02,03,09" — bare numbers
        # share the "FB-" prefix of the first entry in the list.
        member_ids = []
        for raw_id in raw_ids:
            member_ids.append(raw_id if raw_id.startswith("FB-") else f"FB-{raw_id}")

        if cluster_id == "All others":
            # Each listed id is its own singleton hypothesis cluster
            for fb_id in member_ids:
                mapping[fb_id] = (f"singleton-{fb_id}", frozenset([fb_id]))
        else:
            member_set = frozenset(member_ids)
            for fb_id in member_ids:
                mapping[fb_id] = (cluster_id, member_set)
    return mapping


MAX_SINGLE_CALL_ITEMS = 50
# Conservative placeholder, not yet calibrated against a real stress test.
# Upgrade trigger (documented in docs/11-cluster-spec.md): if a synthetic stress
# test with 100+ items and a known number of true-positive duplicate pairs shows
# this single-call approach recovering less than 90% of those pairs, switch to a
# two-stage architecture (cheap candidate generation, then this same judgment
# prompt applied only within candidate groups). Do not raise this threshold
# without first running that stress test.


class ClusteringScaleError(RuntimeError):
    """Raised when item count exceeds what single-call clustering has been validated for."""


def categorize(actual_members: frozenset, hypothesis_members: Optional[frozenset]) -> str:
    if hypothesis_members is None:
        return "not in golden set"
    if actual_members == hypothesis_members:
        return "exact match"
    if len(hypothesis_members) > 1 and len(actual_members) == 1:
        return "split-when-hypothesis-merged"
    if len(hypothesis_members) == 1 and len(actual_members) > 1:
        return "merged-when-hypothesis-split"
    return "new grouping not in hypothesis"


def main() -> None:
    feedback = load_feedback(str(FEEDBACK_PATH))
    if len(feedback) > MAX_SINGLE_CALL_ITEMS:
        raise ClusteringScaleError(
            f"{len(feedback)} items exceeds the single-call clustering limit "
            f"({MAX_SINGLE_CALL_ITEMS}). This approach has not been validated past "
            f"this size — see docs/11-cluster-spec.md for the upgrade trigger. "
            f"Do not raise MAX_SINGLE_CALL_ITEMS without running that stress test first."
        )
    feedback_by_id = {f["feedback_id"]: f for f in feedback}
    classified = load_classified(CLASSIFIED_PATH)

    print(f"Clustering {len(feedback)} items with {MODEL} (prompt {PROMPT_VERSION})...")
    items_block = build_items_block(feedback, classified)
    clusters = run_clustering(items_block)
    print(f"  Model returned {len(clusters)} clusters")

    # Validate every feedback_id appears exactly once
    seen = []
    for c in clusters:
        seen.extend(c["cluster_members"])
    missing = set(feedback_by_id) - set(seen)
    duplicates = [x for x in set(seen) if seen.count(x) > 1]
    if missing:
        print(f"  WARNING: items missing from clustering output: {missing}")
    if duplicates:
        print(f"  WARNING: items appearing in multiple clusters: {duplicates}")

    for c in clusters:
        c["signal_strength"] = compute_signal_strength(
            c["cluster_members"], feedback_by_id, classified
        )

    output = {
        "model": MODEL,
        "prompt_version": PROMPT_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "clusters": clusters,
    }
    CLUSTERS_OUTPUT.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"  Saved clusters to {CLUSTERS_OUTPUT.relative_to(REPO_ROOT)}")

    # Build actual-cluster lookup: feedback_id -> (cluster_id, member frozenset)
    actual_by_id: dict[str, tuple[str, frozenset]] = {}
    for c in clusters:
        member_set = frozenset(c["cluster_members"])
        for fb_id in c["cluster_members"]:
            actual_by_id[fb_id] = (c["cluster_id"], member_set)

    hypothesis_by_id = parse_golden_hypothesis(GOLDEN_PATH)

    rows = []
    for fb_id in sorted(feedback_by_id, key=lambda x: int(x.split("-")[1])):
        actual_cluster_id, actual_members = actual_by_id.get(fb_id, ("MISSING", frozenset()))
        hyp = hypothesis_by_id.get(fb_id)
        hyp_cluster_id = hyp[0] if hyp else "(excluded from golden set)"
        hyp_members = hyp[1] if hyp else None
        category = categorize(actual_members, hyp_members)
        rows.append({
            "feedback_id": fb_id,
            "golden_hypothesis_cluster": hyp_cluster_id,
            "actual_cluster": actual_cluster_id,
            "category": category,
        })

    # Write report
    lines = [
        "# Stage 5 — Cluster Evaluation Report",
        "",
        f"Run: {PROMPT_VERSION} | Model: {MODEL} | Generated: {output['timestamp']}",
        "",
        "Dev-time validation against the golden set's cluster hypothesis only.",
        "This has no effect on runtime/production pipeline behavior — clustering",
        "remains advisory per project-context.md §4 HITL map. No confidence-scoring",
        "or HITL logic is added as a result of this comparison.",
        "",
        "## Comparison table",
        "",
        "| feedback_id | golden hypothesis cluster | actual cluster (cluster.py) | category |",
        "|---|---|---|---|",
    ]
    for r in rows:
        lines.append(
            f"| {r['feedback_id']} | {r['golden_hypothesis_cluster']} | "
            f"{r['actual_cluster']} | {r['category']} |"
        )

    lines.append("")
    lines.append("## Category counts")
    lines.append("")
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["category"]] = counts.get(r["category"], 0) + 1
    lines.append("| Category | Count |")
    lines.append("|---|---|")
    for cat, count in sorted(counts.items(), key=lambda x: -x[1]):
        lines.append(f"| {cat} | {count} |")

    lines.append("")
    lines.append("## Key checkpoint: CLU-006-022 (FB-06, FB-22)")
    lines.append("")
    fb06 = next(r for r in rows if r["feedback_id"] == "FB-06")
    fb22 = next(r for r in rows if r["feedback_id"] == "FB-22")
    same_cluster = fb06["actual_cluster"] == fb22["actual_cluster"]
    lines.append(
        f"FB-06 actual cluster: {fb06['actual_cluster']}  |  "
        f"FB-22 actual cluster: {fb22['actual_cluster']}"
    )
    lines.append("")
    if same_cluster:
        lines.append(
            "**Result: MERGED.** Golden set hypothesis expected a split — "
            "this is the failure case the test was designed to catch."
        )
    else:
        lines.append(
            "**Result: SPLIT, as expected.** The clustering correctly distinguished "
            "the name-mismatch issue (FB-06) from the 2FA issue (FB-22) despite both "
            "being Engineering items from the same account."
        )

    REPORT_OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"  Saved report to {REPORT_OUTPUT.relative_to(REPO_ROOT)}")

    print("\n=== CATEGORY COUNTS ===")
    for cat, count in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    print("\n=== CLU-006-022 CHECKPOINT ===")
    print(f"  FB-06 -> {fb06['actual_cluster']}  |  FB-22 -> {fb22['actual_cluster']}")
    print(f"  {'MERGED (unexpected)' if same_cluster else 'SPLIT (expected)'}")


if __name__ == "__main__":
    main()
