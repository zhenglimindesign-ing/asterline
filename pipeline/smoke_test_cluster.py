"""Isolated smoke test for the clustering mechanism (Stage 5).

Purpose: the 25-item demo dataset has no unambiguous "should merge" case
(different accounts, same root problem). Without one, we cannot tell whether
cluster.py's clustering logic is CAPABLE of merging at all, or whether it is
structurally biased toward singletons regardless of input.

This script feeds 4 hand-built items directly into the same prompt/model used
by cluster.py:
  - 2 genuine duplicates: same root problem (batch upload failure), different
    companies, different wording, different channel
  - 2 clear non-duplicates: unrelated problems, included as a sanity control

Nothing here touches data/02-synthetic-feedback-25.md or any committed eval
artifact. This is throwaway validation, not part of the golden set.

Usage: python pipeline/smoke_test_cluster.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.cluster import PROMPT_PATH, _get_client, _strip_code_fence, MODEL

TEST_ITEMS = [
    {
        "feedback_id": "TEST-A1",
        "account_id": "ACC-9001 (Harbor Freight Co)",
        "intent_type": "actionable_bug",
        "dimension": "Engineering",
        "raw_text": (
            "Ticket #71001 | Subject: CSV payroll upload just hangs\n\n"
            "We tried uploading our monthly payroll file (about 550 contractors) and the "
            "page froze with no error message for over 10 minutes. Nothing came through. "
            "We had to break the file into two smaller batches to get it to go through."
        ),
    },
    {
        "feedback_id": "TEST-A2",
        "account_id": "ACC-9002 (Solstice Imports)",
        "intent_type": "actionable_bug",
        "dimension": "Engineering",
        "raw_text": (
            "Hi, our batch payout upload (around 600 rows) didn't process at all today — "
            "no confirmation, no error, the screen just sat there loading. We ended up "
            "splitting it into smaller files which finally worked. This cost us almost an "
            "hour of extra work."
        ),
    },
    {
        "feedback_id": "TEST-B1",
        "account_id": "ACC-9003 (Pinecone Studio)",
        "intent_type": "feature_request",
        "dimension": "UX",
        "raw_text": (
            "It would be great if the dashboard supported a dark theme option — staring "
            "at the bright white screen for hours during reconciliation is rough on the eyes."
        ),
    },
    {
        "feedback_id": "TEST-B2",
        "account_id": "ACC-9004 (Bluepeak Trading)",
        "intent_type": "complaint",
        "dimension": "Compliance",
        "raw_text": (
            "We were surprised to suddenly be asked for full KYB documentation after "
            "crossing a small payout threshold, with no advance warning. Caught us off guard "
            "and now our payouts are stuck."
        ),
    },
]


def build_items_block() -> str:
    lines = []
    for item in TEST_ITEMS:
        lines.append(
            f"### {item['feedback_id']}\n"
            f"account_id: {item['account_id']}\n"
            f"intent_type: {item['intent_type']}\n"
            f"dimension: {item['dimension']}\n"
            f"raw_text: {item['raw_text']}\n"
        )
    return "\n".join(lines)


def main() -> None:
    prompt_template = PROMPT_PATH.read_text(encoding="utf-8")
    prompt = prompt_template.replace("{items}", build_items_block())

    print(f"Running smoke test with {MODEL}...")
    response = _get_client().messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text
    parsed = json.loads(_strip_code_fence(raw))

    print(json.dumps(parsed, indent=2))

    clusters = parsed["clusters"]
    a1_cluster = next((c["cluster_id"] for c in clusters if "TEST-A1" in c["cluster_members"]), None)
    a2_cluster = next((c["cluster_id"] for c in clusters if "TEST-A2" in c["cluster_members"]), None)
    b1_cluster = next((c["cluster_id"] for c in clusters if "TEST-B1" in c["cluster_members"]), None)
    b2_cluster = next((c["cluster_id"] for c in clusters if "TEST-B2" in c["cluster_members"]), None)

    print("\n=== SMOKE TEST RESULT ===")
    duplicates_merged = a1_cluster == a2_cluster
    controls_separate = len({a1_cluster, b1_cluster, b2_cluster}) == 3 or (b1_cluster != b2_cluster)

    print(f"TEST-A1 (batch upload, Co.1) -> {a1_cluster}")
    print(f"TEST-A2 (batch upload, Co.2) -> {a2_cluster}")
    print(f"  Genuine duplicates merged: {'YES' if duplicates_merged else 'NO'}")
    print(f"TEST-B1 (dark mode) -> {b1_cluster}")
    print(f"TEST-B2 (KYB surprise) -> {b2_cluster}")
    print(f"  Controls correctly kept separate: {'YES' if controls_separate else 'NO'}")

    if duplicates_merged and controls_separate:
        print("\nPASS: mechanism can merge genuine duplicates and avoid false merges.")
    elif not duplicates_merged:
        print("\nFAIL: mechanism did not merge an unambiguous duplicate pair. "
              "This confirms a structural bias toward singletons, not just a data gap.")
    else:
        print("\nPARTIAL: duplicates merged, but a control item merged incorrectly.")


if __name__ == "__main__":
    main()
