"""Vercel Python serverless function: run the Asterline pipeline on user input.

POST /api/pipeline
Body: { "items": ["feedback text 1", "feedback text 2", ...] }
Response: { "clusters": [...],
            "meta": { "hard_fails": int, "hard_failures": [...], ... } }

Constraints:
- Max 3 items per request for serverless reliability; the CFPB client sends 1
- Rate limit: 5 runs per IP per day (in-memory, resets on cold start)
- API key held server-side only (ANTHROPIC_API_KEY env var)
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import secrets
import sys
import time
from pathlib import Path

from langsmith import Client as LangSmithClient
from langsmith import traceable, tracing_context
from langsmith.run_helpers import get_current_run_tree
from langsmith.wrappers import wrap_anthropic

# Rate limiting (in-memory — resets on cold start, good enough for demo)
_rate_limit: dict[str, list[float]] = {}
MAX_RUNS_PER_IP_PER_DAY = 5
MAX_ITEMS = 3
MAX_ITEM_LENGTH = 2000

# Paths — Vercel deploys the entire project
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from pipeline.runtime_checks import (
    apply_runtime_guardrails,
    compute_signal_strength,
    get_cluster_intent_type,
    validate_required_fields,
)

CLASSIFY_PROMPT = ROOT / "pipeline" / "prompts" / "classify.txt"
CLUSTER_PROMPT = ROOT / "pipeline" / "prompts" / "cluster.txt"
GENERATE_PROMPT = ROOT / "pipeline" / "prompts" / "generate.txt"

# Models
CLASSIFY_MODEL = "claude-haiku-4-5-20251001"
GENERATE_MODEL = "claude-sonnet-4-6"


_TRUTHY_ENV_VALUES = {"1", "true", "yes", "on"}


def _create_langsmith_client():
    tracing_enabled = (
        os.environ.get("LANGSMITH_TRACING", "").strip().lower()
        in _TRUTHY_ENV_VALUES
    )
    if not tracing_enabled or not os.environ.get("LANGSMITH_API_KEY"):
        return None
    try:
        return LangSmithClient()
    except Exception:
        return None


def _flush_langsmith_client(client) -> None:
    if client is None:
        return
    try:
        client.flush()
    except Exception:
        pass


def _get_client(langsmith_client=None):
    import anthropic
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    tracing_extra = (
        {"client": langsmith_client} if langsmith_client is not None else None
    )
    return wrap_anthropic(
        anthropic.Anthropic(api_key=api_key),
        tracing_extra=tracing_extra,
    )


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

def classify_item(client, item_id: str, raw_text: str, run_id: str) -> dict:
    prompt_template = CLASSIFY_PROMPT.read_text(encoding="utf-8")
    prompt = prompt_template.replace("{raw_text}", raw_text)
    response = client.messages.create(
        model=CLASSIFY_MODEL, max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
        langsmith_extra={"name": "classify", "metadata": {"run_id": run_id}},
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


def run_clustering(client, items_block: str, run_id: str) -> list[dict]:
    prompt_template = CLUSTER_PROMPT.read_text(encoding="utf-8")
    prompt = prompt_template.replace("{items}", items_block)
    response = client.messages.create(
        model=CLASSIFY_MODEL, max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
        langsmith_extra={"name": "cluster", "metadata": {"run_id": run_id}},
    )
    parsed = json.loads(_strip_code_fence(response.content[0].text))
    if isinstance(parsed, list):
        return parsed
    return parsed.get("clusters", parsed.get("results", []))


# --- Generate ---

def generate_workpack(
    client, intent_type: str, members_block: str, context_docs: str, run_id: str
) -> dict:
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
        langsmith_extra={"name": "generate", "metadata": {"run_id": run_id}},
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

@traceable(name="run_pipeline", run_type="chain")
def _run_pipeline_traced(items: list[str], context_doc: str = "") -> dict:
    started_at = time.perf_counter()
    run_id = f"AST-{secrets.token_hex(2).upper()}"
    llm_calls = 0
    trace_run = get_current_run_tree()
    if trace_run:
        trace_run.metadata.update({
            "run_id": run_id,
            "item_count": len(items),
            "has_context": bool(context_doc),
            "classify_model": CLASSIFY_MODEL,
            "cluster_model": CLASSIFY_MODEL,
            "generate_model": GENERATE_MODEL,
            "llm_call_count": llm_calls,
        })

    langsmith_client = trace_run.ls_client if trace_run else None
    client = _get_client(langsmith_client)

    # 1. PII redaction + assign IDs
    processed = []
    for i, text in enumerate(items):
        item_id = f"UI-{i+1:03d}"
        redacted = redact_pii(text)
        processed.append({"id": item_id, "raw_text": text, "redacted_text": redacted})

    # 2. Classify each item
    for item in processed:
        llm_calls += 1
        if trace_run:
            trace_run.metadata["llm_call_count"] = llm_calls
        classification = classify_item(
            client, item["id"], item["redacted_text"], run_id
        )
        item["classification"] = classification

    # 3. Cluster
    items_block = build_items_block(processed)
    llm_calls += 1
    if trace_run:
        trace_run.metadata["llm_call_count"] = llm_calls
    clusters = run_clustering(client, items_block, run_id)

    items_by_id = {item["id"]: item for item in processed}

    # 4. Compute signal strength + generate and validate work packs
    workpacks = []
    hard_failures = []
    classified_by_id = {
        item["id"]: item["classification"]
        for item in processed
    }
    redacted_text_by_id = {
        item["id"]: item["redacted_text"]
        for item in processed
    }
    for cluster in clusters:
        members = cluster.get("cluster_members", [])
        cluster_id = cluster.get("cluster_id")
        if not cluster_id:
            hard_failures.append({
                "cluster_id": None,
                "reason": "cluster output is missing cluster_id",
            })
            continue

        signal = compute_signal_strength(members, classified_by_id)
        cluster["signal_strength"] = signal

        try:
            intent_type = get_cluster_intent_type(members, classified_by_id)
        except ValueError as exc:
            hard_failures.append({
                "cluster_id": cluster_id,
                "reason": str(exc),
            })
            continue

        members_text = "\n".join(
            f"### {m}\nraw_text: {items_by_id.get(m, {}).get('redacted_text', '')}\n"
            for m in members
        )

        try:
            ctx = context_doc if context_doc else "(no context documents loaded)"
            llm_calls += 1
            if trace_run:
                trace_run.metadata["llm_call_count"] = llm_calls
            content = generate_workpack(
                client, intent_type, members_text, ctx, run_id
            )
        except Exception as exc:
            content = {
                "title": f"Generation failed: {str(exc)[:100]}",
                "problem_brief": "Work pack generation encountered an error.",
                "key_quotes": [],
                "source_refs": [],
                "tasks": [],
                "reply_draft": None,
                "review_flags": [],
                "quality_flags": [{"flag": "generation_error", "reason": str(exc)[:200]}],
            }

        try:
            workpack = apply_runtime_guardrails(
                content,
                cluster_id=cluster_id,
                members=members,
                signal_strength=signal,
                classified=classified_by_id,
                redacted_text_by_id=redacted_text_by_id,
                enable_context_rules=False,
            )
            hard_fail = validate_required_fields(workpack)
        except Exception as exc:
            hard_fail = f"runtime validation failed: {str(exc)[:200]}"
        if hard_fail:
            hard_failures.append({
                "cluster_id": cluster_id,
                "reason": hard_fail,
            })
            continue
        workpacks.append(workpack)

    quality_flag_count = sum(
        len(wp.get("quality_flags") or []) for wp in workpacks
    )
    elapsed_ms = max(0, round((time.perf_counter() - started_at) * 1000))
    if trace_run:
        trace_run.metadata.update({
            "cluster_count": len(clusters),
            "llm_call_count": llm_calls,
            "elapsed_ms": elapsed_ms,
            "hard_fail_count": len(hard_failures),
            "quality_flag_count": quality_flag_count,
        })

    return {
        "clusters": workpacks,
        "meta": {
            "items_received": len(items),
            "items_processed": len(processed),
            "clusters_formed": len(clusters),
            "quality_flags": quality_flag_count,
            "hard_fails": len(hard_failures),
            "hard_failures": hard_failures,
            "run_id": run_id,
            "elapsed_ms": elapsed_ms,
            "llm_calls": llm_calls,
        }
    }


def run_pipeline(items: list[str], context_doc: str = "") -> dict:
    langsmith_client = _create_langsmith_client()
    try:
        if langsmith_client is not None:
            return _run_pipeline_traced(
                items,
                context_doc,
                langsmith_extra={"client": langsmith_client},
            )
        with tracing_context(enabled=False):
            return _run_pipeline_traced(items, context_doc)
    finally:
        _flush_langsmith_client(langsmith_client)


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

            context_doc = str(body.get("context_doc", ""))[:50000]

            # Run pipeline
            result = run_pipeline(items, context_doc)

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
