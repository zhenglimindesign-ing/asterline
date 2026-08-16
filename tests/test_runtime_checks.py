import unittest

from pipeline.runtime_checks import (
    apply_runtime_guardrails,
    compute_signal_strength,
    validate_required_fields,
)


class RuntimeChecksTest(unittest.TestCase):
    def setUp(self):
        self.classified = {
            "UI-001": {
                "intent_type": "actionable_bug",
                "dimension": "Engineering",
                "impact": "Medium",
                "confidence": "High",
            },
            "UI-002": {
                "intent_type": "actionable_bug",
                "dimension": "UX",
                "impact": "Low",
                "confidence": "Low",
            },
        }

    def test_signal_strength_is_conservative_without_account_metadata(self):
        members = ["UI-001", "UI-002"]
        self.assertEqual(compute_signal_strength(members, self.classified), "Medium")
        self.assertEqual(
            compute_signal_strength(
                members,
                self.classified,
                {"UI-001": "ACC-1", "UI-002": "ACC-2"},
            ),
            "High",
        )
        self.assertEqual(
            compute_signal_strength(
                members,
                self.classified,
                {"UI-001": "ACC-1", "UI-002": "ACC-1"},
            ),
            "Medium",
        )
        self.assertEqual(
            compute_signal_strength(
                ["UI-001", "UI-002", "UI-003"],
                self.classified,
                {"UI-001": "ACC-1", "UI-002": "ACC-2", "UI-003": None},
            ),
            "High",
        )

    def test_single_high_impact_item_remains_high(self):
        classified = {
            "UI-001": {**self.classified["UI-001"], "impact": "High"},
        }
        self.assertEqual(compute_signal_strength(["UI-001"], classified), "High")

    def test_shared_guardrails_overwrite_fields_and_add_flags(self):
        content = {
            "title": "Upload issue",
            "problem_brief": "The upload failed yesterday.",
            "key_quotes": ["upload failed", "invented quote", "third quote"],
            "source_refs": [],
            "tasks": [],
            "reply_draft": "Sorry for the inconvenience. We are checking it.",
            "review_flags": [],
            "quality_flags": [],
        }
        result = apply_runtime_guardrails(
            content,
            cluster_id="CLU-001",
            members=["UI-001", "UI-002"],
            signal_strength="Medium",
            classified=self.classified,
            redacted_text_by_id={
                "UI-001": "The upload failed during submission.",
                "UI-002": "A second quote describes the same issue.",
            },
        )

        self.assertEqual(result["signal_strength"], "Medium")
        self.assertEqual(result["confidence"], "Low")
        self.assertEqual(
            result["dimension"],
            [
                {"dimension": "Engineering", "count": 1},
                {"dimension": "UX", "count": 1},
            ],
        )
        self.assertEqual(len(result["key_quotes"]), 2)
        flags = {flag["flag"] for flag in result["quality_flags"]}
        self.assertIn("fabricated_quote", flags)
        self.assertIn("ambiguous_timestamp", flags)
        self.assertIn("tone_violation", flags)
        self.assertIn("low_confidence", flags)
        self.assertTrue(result["review_flags"])

    def test_noise_fields_are_enforced(self):
        classified = {
            "UI-001": {
                "intent_type": "noise",
                "dimension": "Other/Uncategorized",
                "impact": "N/A",
                "confidence": "High",
            }
        }
        result = apply_runtime_guardrails(
            {
                "title": "Noise",
                "problem_brief": "No action.",
                "key_quotes": ["anything"],
                "source_refs": [],
                "tasks": [{"priority": "High"}],
                "reply_draft": "A reply",
                "review_flags": [],
                "quality_flags": [],
            },
            cluster_id="CLU-001",
            members=["UI-001"],
            signal_strength="Low",
            classified=classified,
            redacted_text_by_id={"UI-001": "anything"},
        )
        self.assertEqual(result["tasks"], [])
        self.assertEqual(result["key_quotes"], [])
        self.assertIsNone(result["reply_draft"])

    def test_context_specific_rules_can_remain_disabled_for_live_input(self):
        content = {
            "title": "Policy question",
            "problem_brief": "A policy question.",
            "key_quotes": [],
            "source_refs": ["SP-99"],
            "tasks": [],
            "reply_draft": "The policy is described in SP-99.",
            "review_flags": [],
            "quality_flags": [],
        }
        common = dict(
            cluster_id="CLU-001",
            members=["UI-001"],
            signal_strength="Medium",
            classified={"UI-001": self.classified["UI-001"]},
            redacted_text_by_id={"UI-001": "A policy question."},
        )
        live_result = apply_runtime_guardrails(content, **common)
        offline_result = apply_runtime_guardrails(
            content,
            **common,
            valid_clause_ids={"SP-1"},
            enable_context_rules=True,
        )
        self.assertNotIn(
            "fabricated_source_ref",
            {flag["flag"] for flag in live_result["quality_flags"]},
        )
        self.assertIn(
            "fabricated_source_ref",
            {flag["flag"] for flag in offline_result["quality_flags"]},
        )

    def test_invalid_task_is_a_hard_fail(self):
        self.assertIn(
            "R-04 hard_fail",
            validate_required_fields({
                "confidence": "High",
                "tasks": [{"priority": "High", "acceptance_criteria": "Verified"}],
            }),
        )


if __name__ == "__main__":
    unittest.main()
