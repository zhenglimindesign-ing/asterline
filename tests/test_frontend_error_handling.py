import json
from pathlib import Path
import re
import subprocess
import unittest


ROOT = Path(__file__).parent.parent
INDEX_HTML = ROOT / "web" / "index.html"


class FrontendErrorHandlingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        html = INDEX_HTML.read_text(encoding="utf-8")
        match = re.search(
            r'<script type="text/x-dc"[^>]*data-dc-script[^>]*>(.*?)</script>',
            html,
            re.DOTALL,
        )
        if not match:
            raise AssertionError("Could not find the frontend component script")
        cls.component_script = match.group(1)

    def test_structured_422_uses_boundary_message_not_generic_error_copy(self):
        boundary_message = (
            "This feedback formed 3 distinct issues. The current live demo "
            "supports up to 2 generated work packs per synchronous run. Split "
            "the feedback into smaller batches and try again."
        )
        probe = f"""
class DCLogic {{}}
{self.component_script}
const boundary = Component.prototype.livePipelineErrorMessage(
  422,
  {{ error: "synchronous_runtime_limit", message: {json.dumps(boundary_message)} }},
  ""
);
const generic = Component.prototype.livePipelineErrorMessage(500, null, "");
process.stdout.write(JSON.stringify({{ boundary, generic }}));
"""

        completed = subprocess.run(
            ["node", "-"],
            input=probe,
            text=True,
            capture_output=True,
            check=True,
        )
        result = json.loads(completed.stdout)

        self.assertEqual(result["boundary"], boundary_message)
        self.assertNotIn("Pipeline request failed", result["boundary"])
        self.assertNotIn("Request timed out", result["boundary"])
        self.assertEqual(result["generic"], "Pipeline request failed (HTTP 500).")


if __name__ == "__main__":
    unittest.main()
