"""Call Claude API to classify a single feedback item.

Returns a dict with: intent_type, dimension, impact, urgency, confidence.
Prompt text lives in pipeline/prompts/classify.txt for independent versioning.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Optional

import anthropic
from dotenv import load_dotenv

load_dotenv()

MODEL = "claude-haiku-4-5-20251001"
PROMPT_VERSION = "classify-v1"
_PROMPT_PATH = Path(__file__).parent / "prompts" / "classify.txt"

_VALID = {
    "intent_type": {"actionable_bug", "feature_request", "complaint", "praise", "noise"},
    "dimension": {
        "Engineering", "UX", "Compliance", "Support Process",
        "Product/Roadmap", "Finance & Reporting", "Other/Uncategorized",
    },
    "impact": {"High", "Medium", "Low", "N/A"},
    "urgency": {"High", "Medium", "Low", "N/A"},
    "confidence": {"High", "Medium", "Low"},
}

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set. Copy .env.example to .env and fill in the key.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def classify(item: dict) -> dict:
    """Classify a feedback item. Raises on API or parse error."""
    prompt_template = _PROMPT_PATH.read_text(encoding="utf-8")
    prompt = prompt_template.replace("{raw_text}", item.get("raw_text", ""))

    response = _get_client().messages.create(
        model=MODEL,
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text
    parsed = json.loads(_strip_code_fence(raw))

    # Warn on unexpected values but don't hard-fail — eval captures them as disagreements
    for field, valid_set in _VALID.items():
        val = parsed.get(field)
        if val not in valid_set:
            print(f"    WARN {item.get('feedback_id')}: {field}={val!r} not in valid set")

    return parsed
