"""Local dev server — serves web/ static files + /api/pipeline endpoint.
Run: python api/dev_server.py
Then open http://localhost:8080
"""
import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT / "web")

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from api.pipeline import run_pipeline, check_rate_limit, MAX_ITEMS, MAX_ITEM_LENGTH


class DevHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/pipeline":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length)) if length else {}
                items = body.get("items", [])
                if not items:
                    self._json(400, {"error": "No items provided."})
                    return
                items = [str(i)[:MAX_ITEM_LENGTH] for i in items if str(i).strip()]
                if len(items) > MAX_ITEMS:
                    items = items[:MAX_ITEMS]
                result = run_pipeline(items)
                self._json(200, result)
            except Exception as e:
                self._json(500, {"error": str(e)[:300]})
        else:
            self.send_error(404)

    def _json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        if "/api/" in (args[0] if args else ""):
            print(f"  API: {args[0]}")


if __name__ == "__main__":
    port = 8080
    print(f"Dev server: http://localhost:{port}")
    print(f"Serving static files from: {ROOT / 'web'}")
    print(f"API endpoint: POST http://localhost:{port}/api/pipeline")
    print(f"API key: {'set' if os.environ.get('ANTHROPIC_API_KEY') else 'MISSING'}")
    print()
    HTTPServer(("", port), DevHandler).serve_forever()
