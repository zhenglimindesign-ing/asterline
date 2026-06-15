"""Parse data/02-synthetic-feedback-25.md into structured dicts."""

import re
from pathlib import Path


def load_feedback(path: str) -> list[dict]:
    """Parse the synthetic feedback markdown file.

    Returns a list of dicts with keys:
        feedback_id, timestamp, channel, contact_email, account_id, raw_text
    Values that appear as '(none)' or '(missing...)' in the source are returned as None.
    """
    content = Path(path).read_text(encoding="utf-8")
    sections = re.split(r"\n---\n", content)

    items = []
    for section in sections:
        section = section.strip()
        if not section.startswith("## FB-"):
            continue

        lines = section.split("\n")
        feedback_id = lines[0].lstrip("# ").strip()

        item: dict = {"feedback_id": feedback_id}

        for field in ("timestamp", "channel", "contact_email", "account_id"):
            match = re.search(rf"^- {field}: (.+)$", section, re.MULTILINE)
            if match:
                val = match.group(1).strip()
                item[field] = None if val.startswith("(") else val
            else:
                item[field] = None

        raw_match = re.search(r"- raw_text: \|\n([\s\S]+)", section)
        if raw_match:
            raw_lines = raw_match.group(1).split("\n")
            processed = [ln[2:] if ln.startswith("  ") else ln for ln in raw_lines]
            item["raw_text"] = "\n".join(processed).strip()
        else:
            item["raw_text"] = ""

        items.append(item)

    return items


def filter_by_ids(items: list[dict], ids: list[str]) -> list[dict]:
    """Return only items whose feedback_id is in ids, preserving ids order."""
    lookup = {item["feedback_id"]: item for item in items}
    return [lookup[fid] for fid in ids if fid in lookup]
