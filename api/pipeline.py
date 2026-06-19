"""Vercel Python serverless function: run the Asterline pipeline on user input.

POST /api/pipeline
Body: { "items": ["feedback text 1", "feedback text 2", ...] }
Response: { "clusters": [...], "meta": { "items_received": N, "items_processed": N } }

Constraints:
- Max 3 items per request (Vercel Free plan 10s timeout)
- Rate limit: 5 runs per IP per day (in-memory, resets on cold start)
- API key held server-side only (ANTHROPIC_API_KEY env var)
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import sys
import time
from pathlib import Path

# Rate limiting (in-memory — resets on cold start, good enough for demo)
_rate_limit: dict[str, list[float]] = {}
MAX_RUNS_PER_IP_PER_DAY = 5
MAX_ITEMS = 3
MAX_ITEM_LENGTH = 2000

# Paths — Vercel deploys the entire project
ROOT = Path(__file__).parent.parent
CLASSIFY_PROMPT = ROOT / "pipeline" / "prompts" / "classify.txt"
CLUSTER_PROMPT = ROOT / "pipeline" / "prompts" / "cluster.txt"
GENERATE_PROMPT = ROOT / "pipeline" / "prompts" / "generate.txt"

# Models
CLASSIFY_MODEL = "claude-haiku-4-5-20251001"
GENERATE_MODEL = "claude-sonnet-4-6"


def _get_client():
    import anthropic
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=api_key)


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


# --- PII redaction (from pipeline/pii.py) ---

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE = re.compile(
    r"(?:\+\d[\d\s\-\.\(\)]{8,15}|\(\d{3}\)\s*\d{3}[\-\s\.]\d{4}|\b\d{3}[\-\.]\d{3}[\-\.]\d{4}\b)"
)
_ACCOUNT = re.compile(r"\bACC-\d+\b|\b\d{8,}\b")

def redact_pii(text: str) -> str:
    text = _EMAIL.sub("[REDACTED]", text)
    text = _PHONE.sub("[REDACTED]", text)
    text = _ACCOUNT.sub("[REDACTED]", text)
    return text


# --- Classify (from pipeline/classify.py) ---

VALID_INTENTS = {"actionable_bug", "feature_request", "complaint", "praise", "noise"}

def classify_item(client, item_id: str, raw_text: str) -> dict:
    prompt_template = CLASSIFY_PROMPT.read_text(encoding="utf-8")
    prompt = prompt_template.replace("{raw_text}", raw_text)
    response = client.messages.create(
        model=CLASSIFY_MODEL, max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    parsed = json.loads(_strip_code_fence(response.content[0].text))
    if isinstance(parsed, list):
        parsed = parsed[0] if parsed else {}
    parsed["feedback_id"] = item_id
    return parsed


# --- Cluster (from pipeline/cluster.py) ---

def build_items_block(items: list[dict]) -> str:
    lines = []
    for item in items:
        lines.append(
            f"### {item['id']}\n"
            f"account_id: anonymous\n"
            f"intent_type: {item['classification'].get('intent_type')}\n"
            f"dimension: {item['classification'].get('dimension')}\n"
            f"raw_text: {item['redacted_text']}\n"
        )
    return "\n".join(lines)


def run_clustering(client, items_block: str) -> list[dict]:
    prompt_template = CLUSTER_PROMPT.read_text(encoding="utf-8")
    prompt = prompt_template.replace("{items}", items_block)
    response = client.messages.create(
        model=CLASSIFY_MODEL, max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    parsed = json.loads(_strip_code_fence(response.content[0].text))
    if isinstance(parsed, list):
        return parsed
    return parsed.get("clusters", parsed.get("results", []))


def compute_signal_strength(members: list[str], items_by_id: dict) -> str:
    if len(members) >= 2:
        return "High" if len(members) >= 2 else "Medium"
    impacts = [items_by_id.get(m, {}).get("classification", {}).get("impact") for m in members]
    if any(i == "High" for i in impacts):
        return "High"
    if any(i == "Medium" for i in impacts):
        return "Medium"
    return "Low"


# --- Generate (from pipeline/generate.py, simplified) ---

def generate_workpack(client, intent_type: str, members_block: str, context_docs: str) -> dict:
    prompt_template = GENERATE_PROMPT.read_text(encoding="utf-8")
    prompt = (
        prompt_template
        .replace("{intent_type}", intent_type)
        .replace("{members_block}", members_block)
        .replace("{context_docs}", context_docs)
    )
    response = client.messages.create(
        model=GENERATE_MODEL, max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(_strip_code_fence(response.content[0].text))


# --- Rate limiting ---

def check_rate_limit(ip: str) -> bool:
    now = time.time()
    day_ago = now - 86400
    if ip not in _rate_limit:
        _rate_limit[ip] = []
    _rate_limit[ip] = [t for t in _rate_limit[ip] if t > day_ago]
    if len(_rate_limit[ip]) >= MAX_RUNS_PER_IP_PER_DAY:
        return False
    _rate_limit[ip].append(now)
    return True


# --- Main pipeline ---

def run_pipeline(items: list[str]) -> dict:
    client = _get_client()

    # 1. PII redaction + assign IDs
    processed = []
    for i, text in enumerate(items):
        item_id = f"UI-{i+1:03d}"
        redacted = redact_pii(text)
        processed.append({"id": item_id, "raw_text": text, "redacted_text": redacted})

    # 2. Classify each item
    for item in processed:
        classification = classify_item(client, item["id"], item["redacted_text"])
        item["classification"] = classification

    # 3. Cluster
    items_block = build_items_block(processed)
    clusters = run_clustering(client, items_block)

    items_by_id = {item["id"]: item for item in processed}

    # 4. Compute signal strength + generate work packs
    workpacks = []
    for cluster in clusters:
        members = cluster.get("cluster_members", [])
        signal = compute_signal_strength(members, items_by_id)
        cluster["signal_strength"] = signal

        intent_types = {
            items_by_id.get(m, {}).get("classification", {}).get("intent_type")
            for m in members
        }
        intent_types.discard(None)
        intent_type = next(iter(intent_types)) if intent_types else "noise"

        members_text = "\n".join(
            f"### {m}\nraw_text: {items_by_id.get(m, {}).get('redacted_text', '')}\n"
            for m in members
        )

        try:
            wp = generate_workpack(client, intent_type, members_text, "(no context documents loaded)")
            wp["cluster_id"] = cluster["cluster_id"]
            wp["cluster_members"] = members
            wp["signal_strength"] = signal
            wp["intent_type"] = intent_type
            workpacks.append(wp)
        except Exception as e:
            workpacks.append({
                "cluster_id": cluster["cluster_id"],
                "cluster_members": members,
                "signal_strength": signal,
                "intent_type": intent_type,
                "title": f"Generation failed: {str(e)[:100]}",
                "problem_brief": "Work pack generation encountered an error.",
                "key_quotes": [],
                "source_refs": [],
                "tasks": [],
                "reply_draft": None,
                "review_flags": [],
                "quality_flags": [{"flag": "generation_error", "reason": str(e)[:200]}],
            })

    return {
        "clusters": workpacks,
        "meta": {
            "items_received": len(items),
            "items_processed": len(processed),
            "clusters_formed": len(clusters),
        }
    }


# --- Vercel handler ---

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_POST(self):
        try:
            # Rate limit
            ip = self.headers.get("x-forwarded-for", self.client_address[0]).split(",")[0].strip()
            if not check_rate_limit(ip):
                self._error(429, "Rate limit exceeded — max 5 runs per day.")
                return

            # Parse body
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self._error(400, "Empty request body.")
                return
            body = json.loads(self.rfile.read(content_length))

            items = body.get("items", [])
            if not items or not isinstance(items, list):
                self._error(400, "Request must include a non-empty 'items' array.")
                return

            # Validate
            items = [str(item)[:MAX_ITEM_LENGTH] for item in items if str(item).strip()]
            if len(items) > MAX_ITEMS:
                items = items[:MAX_ITEMS]

            if not items:
                self._error(400, "No valid feedback items after filtering.")
                return

            # Run pipeline
            result = run_pipeline(items)

            self.send_response(200)
            self._cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        except Exception as e:
            self._error(500, f"Pipeline error: {str(e)[:200]}")

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _error(self, code: int, message: str):
        self.send_response(code)
        self._cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode())

    def log_message(self, format, *args):
        pass
