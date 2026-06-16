"""Classify all 25 feedback items (not just the golden-set 20).

This produces the full classified dataset that clustering (Stage 5) consumes.
For the 20 golden-set items, this uses the pipeline's own prediction
(not the golden-set label) — clustering must operate on what the pipeline
actually produced, consistent with how it will run on real unlabeled data.

Usage: python pipeline/classify_all.py
Output: pipeline/output/classified-25-v4.json
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.classify import MODEL, PROMPT_VERSION, classify
from pipeline.data_loader import load_feedback
from pipeline.pii import redact

REPO_ROOT = Path(__file__).parent.parent
FEEDBACK_PATH = REPO_ROOT / "data" / "02-synthetic-feedback-25.md"
OUTPUT_PATH = REPO_ROOT / "pipeline" / "output" / "classified-25-v4.json"


def main() -> None:
    items = load_feedback(str(FEEDBACK_PATH))
    print(f"Classifying {len(items)} items with {MODEL} (prompt {PROMPT_VERSION})...")

    results = []
    for item in items:
        fb_id = item["feedback_id"]
        redacted_text, pii_found = redact(item["raw_text"])
        classify_input = {**item, "raw_text": redacted_text}

        try:
            prediction = classify(classify_input)
            error = None
        except Exception as exc:
            prediction = None
            error = str(exc)
            print(f"  ERROR {fb_id}: {exc}")

        results.append({
            "feedback_id": fb_id,
            "timestamp": item["timestamp"],
            "channel": item["channel"],
            "account_id": item["account_id"],
            "pii_detected": pii_found,
            "classification": prediction,
            "error": error,
        })
        print(f"  {fb_id}: {'OK' if prediction else 'ERROR'}")

    output = {
        "model": MODEL,
        "prompt_version": PROMPT_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "item_count": len(results),
        "results": results,
    }
    OUTPUT_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\nSaved to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
