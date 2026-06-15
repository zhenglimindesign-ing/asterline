"""Regex-based PII redaction. Runs on raw_text BEFORE any other processing.

Redacts: email addresses, phone numbers, account numbers (ACC-XXXX or >=8 digits),
and heuristic full names (two consecutive Title Case words not at sentence start).

Known limitation: name detection is imperfect. Human names at line beginnings may be
missed or false-positived with company names. This is a documented v1 constraint.
"""

import re

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

_PHONE = re.compile(
    r"(?:"
    r"\+\d[\d\s\-\.\(\)]{8,15}"   # +1 (415) 555-0142  /  +44 7700 900123
    r"|"
    r"\(\d{3}\)\s*\d{3}[\-\s\.]\d{4}"  # (415) 555-0142
    r"|"
    r"\b\d{3}[\-\.]\d{3}[\-\.]\d{4}\b"  # 415-555-0142
    r")"
)

_ACCOUNT = re.compile(r"\bACC-\d+\b|\b\d{8,}\b")

_NAME = re.compile(r"\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b")


def _is_sentence_start(text: str, pos: int) -> bool:
    """Return True if position pos is at the start of a sentence or the text."""
    if pos == 0:
        return True
    preceding = text[:pos].rstrip(" \t")
    return not preceding or preceding[-1] in ".!?"


def redact(text: str) -> tuple[str, bool]:
    """Redact PII from text. Returns (redacted_text, pii_detected)."""
    original = text
    text = _EMAIL.sub("[REDACTED]", text)
    text = _PHONE.sub("[REDACTED]", text)
    text = _ACCOUNT.sub("[REDACTED]", text)

    # Name heuristic: replace two consecutive Title Case words not at sentence start
    def _replace_name(m: re.Match) -> str:
        if _is_sentence_start(text, m.start()):
            return m.group(0)
        return "[REDACTED]"

    text = _NAME.sub(_replace_name, text)

    return text, text != original
