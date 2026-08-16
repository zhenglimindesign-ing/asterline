"""Shared deterministic runtime checks for offline and live work packs.

This module intentionally uses only the Python standard library. Context-specific
rules can be enabled by the evaluated Vela pipeline while the public endpoint
uses the context-independent guardrails until uploaded documents have a defined
clause schema.
"""

from __future__ import annotations

import re
from typing import Mapping, Optional


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
INTERNAL_REF_RE = re.compile(r"\b(SP|KI|TG|RM)-\d+\b")
PAYMENT_SP_REFS = {f"SP-{i}" for i in range(1, 10)}
AUTO_CHECK_OWNED_FLAGS = {
    "ambiguous_timestamp",
    "fabricated_quote",
    "tone_violation",
    "fabricated_source_ref",
}


def _classification(record: dict) -> dict:
    nested = record.get("classification")
    return nested if isinstance(nested, dict) else record


def parse_valid_clause_ids(context_docs_text: str) -> set[str]:
    """Parse Vela-style clause IDs from bold Markdown headings."""
    return set(re.findall(r"\*\*((?:SP|TG|KI|RM)-\d+)\.", context_docs_text))


def compute_dimension_distribution(members: list[str], classified: Mapping[str, dict]) -> list[dict]:
    counts: dict[str, int] = {}
    for member in members:
        dimension = _classification(classified.get(member, {})).get("dimension")
        if dimension:
            counts[dimension] = counts.get(dimension, 0) + 1
    return [
        {"dimension": dimension, "count": count}
        for dimension, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def compute_cluster_confidence(members: list[str], classified: Mapping[str, dict]) -> str:
    ranks = [
        CONFIDENCE_RANK[confidence]
        for member in members
        if (confidence := _classification(classified.get(member, {})).get("confidence"))
        in CONFIDENCE_RANK
    ]
    return RANK_TO_LABEL[min(ranks)] if ranks else "Low"


def get_cluster_intent_type(members: list[str], classified: Mapping[str, dict]) -> str:
    intents = {
        _classification(classified.get(member, {})).get("intent_type")
        for member in members
    }
    intents.discard(None)
    if len(intents) != 1:
        raise ValueError(f"members have inconsistent intent_type: {intents}")
    return next(iter(intents))


def compute_signal_strength(
    members: list[str],
    classified: Mapping[str, dict],
    account_ids: Optional[Mapping[str, Optional[str]]] = None,
) -> str:
    """Compute signal without treating unknown accounts as distinct evidence.

    Account diversity contributes only when at least two members have distinct
    known account IDs. Unknown IDs never count as distinct-account evidence.
    """
    impacts = [
        _classification(classified.get(member, {})).get("impact")
        for member in members
    ]
    known_accounts = [
        account_id
        for member in members
        if account_ids is not None
        and (account_id := account_ids.get(member))
    ]

    if len(members) >= 2 and len(set(known_accounts)) >= 2:
        return "High"
    if len(members) == 1 and any(impact == "High" for impact in impacts):
        return "High"
    if len(members) >= 2:
        return "Medium"
    if any(impact == "Medium" for impact in impacts):
        return "Medium"
    return "Low"


def _normalize_source(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace(chr(0x201C), chr(0x27)).replace(chr(0x201D), chr(0x27))
    return text.replace('"', chr(0x27)).lower()


def _normalize_quote(text: str) -> str:
    return _normalize_source(text).rstrip(".,;!?")


def apply_runtime_guardrails(
    content: dict,
    *,
    cluster_id: str,
    members: list[str],
    signal_strength: str,
    classified: Mapping[str, dict],
    redacted_text_by_id: Mapping[str, str],
    valid_clause_ids: Optional[set[str]] = None,
    enable_context_rules: bool = False,
) -> dict:
    """Overwrite deterministic fields and apply the shared runtime guardrails."""
    intent_type = get_cluster_intent_type(members, classified)
    confidence = compute_cluster_confidence(members, classified)

    workpack = dict(content)
    workpack["cluster_id"] = cluster_id
    workpack["cluster_members"] = members
    workpack["signal_strength"] = signal_strength
    workpack["intent_type"] = intent_type
    workpack["dimension"] = compute_dimension_distribution(members, classified)
    workpack["confidence"] = confidence

    quality_flags = [
        flag
        for flag in (workpack.get("quality_flags") or [])
        if flag.get("flag") not in AUTO_CHECK_OWNED_FLAGS
    ]
    review_flags = list(workpack.get("review_flags") or [])

    if intent_type == "noise":
        workpack["reply_draft"] = None
        workpack["tasks"] = []
        workpack["key_quotes"] = []
    elif intent_type == "praise":
        workpack["tasks"] = []

    quotes = workpack.get("key_quotes") or []
    if len(quotes) > 2:
        quotes = quotes[:2]
        workpack["key_quotes"] = quotes

    all_raw_text = _normalize_source(
        " ".join(redacted_text_by_id.get(member, "") for member in members)
    )
    for quote in quotes:
        if not isinstance(quote, str) or _normalize_quote(quote) not in all_raw_text:
            quality_flags.append({
                "flag": "fabricated_quote",
                "reason": f"quote not found verbatim in any cluster member's raw_text: {quote!r}",
                "remediation": "Remove this key_quote or replace it with a verbatim substring from the source feedback.",
            })

    invalid_members = [member for member in members if member not in redacted_text_by_id]
    if invalid_members:
        quality_flags.append({
            "flag": "invalid_cluster_reference",
            "reason": f"unknown feedback_ids: {invalid_members}",
            "remediation": "Remove unknown feedback IDs from cluster_members.",
        })

    for flag in review_flags:
        if flag.get("flag") == "needs_human_review" and not flag.get("blocks"):
            quality_flags.append({
                "flag": "unclear_execution_order",
                "reason": "needs_human_review flag is missing a populated blocks field",
                "remediation": "Add a blocks field identifying which output field requires human sign-off.",
            })

    if confidence == "Low":
        if not any(flag.get("flag") == "needs_human_review" for flag in review_flags):
            review_flags.append({
                "flag": "needs_human_review",
                "reason": "Pipeline confidence is Low for this cluster.",
                "blocks": "reply_draft",
            })
        quality_flags.append({
            "flag": "low_confidence",
            "reason": "confidence=Low for this cluster",
            "remediation": "Review the classification output for this cluster's members before acting on the work pack.",
        })

    generated_text = " ".join(filter(None, [
        workpack.get("problem_brief") or "",
        " ".join(quote for quote in quotes if isinstance(quote, str)),
        workpack.get("reply_draft") or "",
    ]))
    if RELATIVE_TIME_RE.search(generated_text):
        quality_flags.append({
            "flag": "ambiguous_timestamp",
            "reason": "relative time expression detected in problem_brief/key_quotes/reply_draft",
            "remediation": "Replace the relative expression with the absolute UTC+0 timestamp from the feedback metadata, or remove the time reference if the timestamp is unknown.",
        })

    reply_draft = workpack.get("reply_draft")
    reply_lower = (reply_draft or "").lower()
    for phrase in BANNED_PHRASES:
        if phrase in reply_lower:
            quality_flags.append({
                "flag": "tone_violation",
                "reason": f"banned phrase detected: {phrase!r}",
                "remediation": "Remove or rewrite this sentence to state what happened and what happens next.",
            })

    source_refs = workpack.get("source_refs") or []
    if enable_context_rules:
        has_payment_sp_ref = any(ref in PAYMENT_SP_REFS for ref in source_refs)
        if intent_type in ("actionable_bug", "complaint") and has_payment_sp_ref and reply_draft:
            first_sentence = re.split(r"(?<=[.!?])\s", reply_draft.strip())[0]
            if not MONEY_OR_TIME_RE.search(first_sentence):
                quality_flags.append({
                    "flag": "tone_violation",
                    "reason": "first sentence of reply_draft does not reference transaction/amount/timing",
                    "remediation": "Revise the first sentence to address the money or timing question directly (per TG-5).",
                })

        if reply_draft:
            for match in INTERNAL_REF_RE.finditer(reply_draft):
                quality_flags.append({
                    "flag": "internal_ref_in_reply",
                    "reason": f"clause ID {match.group()!r} found in reply_draft",
                    "remediation": "Remove the internal clause ID and express the policy in plain language.",
                })

        allowed_ids = valid_clause_ids or set()
        for ref in source_refs:
            if ref not in allowed_ids:
                quality_flags.append({
                    "flag": "fabricated_source_ref",
                    "reason": f"cited clause {ref!r} not found in the configured context document",
                    "remediation": "Remove this source_ref or cite a clause ID that exists in the context document.",
                })

    workpack["review_flags"] = review_flags
    workpack["quality_flags"] = quality_flags
    return workpack


def validate_required_fields(workpack: dict) -> Optional[str]:
    """Return the first R-04/R-17 hard-fail reason, if any."""
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
