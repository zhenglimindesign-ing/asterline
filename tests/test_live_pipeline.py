import unittest
from unittest.mock import patch

from api import pipeline as live_pipeline


def _classification(item_id, confidence="High"):
    return {
        "feedback_id": item_id,
        "intent_type": "actionable_bug",
        "dimension": "Engineering",
        "impact": "Medium",
        "urgency": "Medium",
        "confidence": confidence,
    }


def _valid_workpack():
    return {
        "title": "Upload failure",
        "problem_brief": "The upload fails during submission.",
        "key_quotes": ["upload fails"],
        "source_refs": [],
        "tasks": [{
            "task": "Investigate the upload failure.",
            "assignee_team": "Engineering",
            "priority": "High",
            "deadline": None,
            "acceptance_criteria": "Root cause is documented.",
        }],
        "reply_draft": "Your upload fails during submission. We are investigating.",
        "review_flags": [],
        "quality_flags": [],
    }


class LivePipelineTest(unittest.TestCase):
    @patch.object(live_pipeline, "generate_workpack")
    @patch.object(live_pipeline, "run_clustering")
    @patch.object(live_pipeline, "classify_item")
    @patch.object(live_pipeline, "_get_client", return_value=object())
    def test_live_pipeline_adds_checks_without_extra_model_calls(
        self, get_client, classify_item, run_clustering, generate_workpack
    ):
        classify_item.side_effect = [
            _classification("UI-001"),
            _classification("UI-002", confidence="Low"),
        ]
        run_clustering.return_value = [{
            "cluster_id": "CLU-001",
            "cluster_members": ["UI-001", "UI-002"],
        }]
        generate_workpack.return_value = _valid_workpack()

        result = live_pipeline.run_pipeline([
            "The upload fails during submission.",
            "The same upload fails for our second attempt.",
        ])

        self.assertEqual(classify_item.call_count, 2)
        run_clustering.assert_called_once()
        generate_workpack.assert_called_once()
        self.assertEqual(result["clusters"][0]["signal_strength"], "Medium")
        self.assertEqual(result["clusters"][0]["confidence"], "Low")
        self.assertEqual(result["meta"]["hard_fails"], 0)
        self.assertGreaterEqual(result["meta"]["quality_flags"], 1)

    @patch.object(live_pipeline, "generate_workpack")
    @patch.object(live_pipeline, "run_clustering")
    @patch.object(live_pipeline, "classify_item")
    @patch.object(live_pipeline, "_get_client", return_value=object())
    def test_hard_fail_is_reported_and_not_exported_as_a_workpack(
        self, get_client, classify_item, run_clustering, generate_workpack
    ):
        classify_item.return_value = _classification("UI-001")
        run_clustering.return_value = [{
            "cluster_id": "CLU-001",
            "cluster_members": ["UI-001"],
        }]
        invalid = _valid_workpack()
        invalid["tasks"][0].pop("assignee_team")
        generate_workpack.return_value = invalid

        result = live_pipeline.run_pipeline(["The upload fails during submission."])

        self.assertEqual(result["clusters"], [])
        self.assertEqual(result["meta"]["hard_fails"], 1)
        self.assertIn("R-04 hard_fail", result["meta"]["hard_failures"][0]["reason"])


if __name__ == "__main__":
    unittest.main()
