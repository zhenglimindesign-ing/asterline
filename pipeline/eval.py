"""Eval runner: classify the 20 golden-set items and score against ground truth.

Usage: python pipeline/eval.py
Output: docs/eval-results-v0.json + terminal summary
"""

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running from repo root or from pipeline/
sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline.classify import MODEL, PROMPT_VERSION, classify
from pipeline.data_loader import filter_by_ids, load_feedback
from pipeline.pii import redact

GOLDEN_IDS = [
    "FB-01", "FB-02", "FB-03", "FB-05", "FB-06", "FB-07", "FB-08", "FB-09", "FB-10",
    "FB-12", "FB-13", "FB-14", "FB-15", "FB-16", "FB-17", "FB-19", "FB-20", "FB-22",
    "FB-23", "FB-24",
]

COMPARE_FIELDS = ["intent_type", "dimension", "impact", "urgency"]

INTENT_LABELS = ["actionable_bug", "feature_request", "complaint", "praise", "noise"]

REPO_ROOT = Path(__file__).parent.parent
FEEDBACK_PATH = REPO_ROOT / "data" / "02-synthetic-feedback-25.md"
GOLDEN_PATH = REPO_ROOT / "data" / "03-golden-set-labeled.md"
RESULTS_PATH = REPO_ROOT / "docs" / "eval-results-v2.json"


def load_golden_set(path: Path) -> dict[str, dict]:
    """Parse the labeled items table from the golden set markdown.

    Maps feedback_id -> {intent_type, dimension, impact, urgency}.
    Note: the golden set column is named 'intent'; this maps it to 'intent_type'
    to match the work pack schema (documented in 03-golden-set-labeled.md).
    """
    content = path.read_text(encoding="utf-8")
    table_match = re.search(
        r"\| ID \| intent \| dimension \| impact \| urgency \| source_refs \|(.*?)(?:\n\n|\Z)",
        content,
        re.DOTALL,
    )
    if not table_match:
        raise ValueError("Could not find labeled items table in golden set")

    golden: dict[str, dict] = {}
    for line in table_match.group(1).strip().split("\n"):
        if line.startswith("|---") or not line.strip():
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) < 5:
            continue
        fb_id, intent, dimension, impact, urgency = (
            parts[0], parts[1], parts[2], parts[3], parts[4]
        )
        golden[fb_id] = {
            "intent_type": intent,
            "dimension": dimension,
            "impact": impact,
            "urgency": urgency,
        }
    return golden


def build_confusion(predictions: list[str], actuals: list[str]) -> dict[str, dict[str, int]]:
    matrix: dict[str, dict[str, int]] = {
        label: {l: 0 for l in INTENT_LABELS} for label in INTENT_LABELS
    }
    for pred, actual in zip(predictions, actuals):
        row = matrix.setdefault(actual, {l: 0 for l in INTENT_LABELS})
        row[pred] = row.get(pred, 0) + 1
    return matrix


def print_confusion(matrix: dict) -> None:
    col_w = 16
    header = f"{'':25s}" + "".join(f"{l:<{col_w}}" for l in INTENT_LABELS)
    print(header)
    print("-" * len(header))
    for actual in INTENT_LABELS:
        row = matrix.get(actual, {})
        line = f"[actual] {actual:<16s}" + "".join(
            f"{row.get(pred, 0):<{col_w}}" for pred in INTENT_LABELS
        )
        print(line)


def main() -> None:
    all_feedback = load_feedback(str(FEEDBACK_PATH))
    items = filter_by_ids(all_feedback, GOLDEN_IDS)
    golden = load_golden_set(GOLDEN_PATH)

    print(f"Classifying {len(items)} items with {MODEL}...")
    print(f"Prompt version: {PROMPT_VERSION}\n")

    raw_results = []
    disagreements = []
    field_correct = {f: 0 for f in COMPARE_FIELDS}
    overall_correct = 0
    total = 0
    intent_preds: list[str] = []
    intent_actuals: list[str] = []

    for item in items:
        fb_id = item["feedback_id"]
        gt = golden.get(fb_id)
        if gt is None:
            print(f"  SKIP {fb_id}: not found in golden set")
            continue

        redacted_text, pii_found = redact(item["raw_text"])
        classify_input = {**item, "raw_text": redacted_text}

        try:
            prediction = classify(classify_input)
            error = None
        except Exception as exc:
            prediction = None
            error = str(exc)
            print(f"  ERROR {fb_id}: {exc}")

        total += 1

        result: dict = {
            "feedback_id": fb_id,
            "pii_detected": pii_found,
            "ground_truth": gt,
            "prediction": prediction,
            "error": error,
        }

        if prediction is not None:
            diffs = []
            all_match = True
            for field in COMPARE_FIELDS:
                pred_val = prediction.get(field)
                gt_val = gt.get(field)
                if pred_val == gt_val:
                    field_correct[field] += 1
                else:
                    all_match = False
                    diffs.append({"field": field, "ground_truth": gt_val, "predicted": pred_val})

            if all_match:
                overall_correct += 1

            result["diff_count"] = len(diffs)
            result["field_matches"] = {f: (prediction.get(f) == gt.get(f)) for f in COMPARE_FIELDS}

            if diffs:
                disagreements.append({
                    "feedback_id": fb_id,
                    "diff_count": len(diffs),
                    "diffs": diffs,
                })

            intent_preds.append(prediction.get("intent_type", "unknown"))
            intent_actuals.append(gt["intent_type"])

            status = "OK" if not diffs else f"{len(diffs)} diff(s)"
        else:
            status = "ERROR"

        raw_results.append(result)
        print(f"  {fb_id}: {status}")

    scores = {
        "intent_accuracy": round(field_correct["intent_type"] / total, 3) if total else 0.0,
        "dimension_accuracy": round(field_correct["dimension"] / total, 3) if total else 0.0,
        "impact_accuracy": round(field_correct["impact"] / total, 3) if total else 0.0,
        "urgency_accuracy": round(field_correct["urgency"] / total, 3) if total else 0.0,
        "overall_accuracy": round(overall_correct / total, 3) if total else 0.0,
    }

    disagreements.sort(key=lambda x: x["diff_count"], reverse=True)

    output = {
        "run_id": "v2",
        "model": MODEL,
        "prompt_version": PROMPT_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scores": scores,
        "disagreements": disagreements,
        "raw_results": raw_results,
    }
    RESULTS_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")

    # Terminal summary
    print("\n=== PER-FIELD ACCURACY ===")
    for field in COMPARE_FIELDS:
        key = field.replace("intent_type", "intent").replace("_type", "") + "_accuracy"
        score_key = field + "_accuracy" if field + "_accuracy" in scores else field.split("_")[0] + "_accuracy"
        # use the scores dict directly
    for k, v in scores.items():
        print(f"  {k}: {v:.1%}")

    print("\n=== INTENT_TYPE CONFUSION TABLE ===")
    print("Columns = predicted, rows = actual\n")
    confusion = build_confusion(intent_preds, intent_actuals)
    print_confusion(confusion)

    print("\n=== TOP 3 DISAGREEMENTS ===")
    for entry in disagreements[:3]:
        print(f"\n  {entry['feedback_id']} ({entry['diff_count']} field(s) differ):")
        for diff in entry["diffs"]:
            print(f"    {diff['field']:15s}  golden={diff['ground_truth']}  |  predicted={diff['predicted']}")

    print(f"\nFull results saved to {RESULTS_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
