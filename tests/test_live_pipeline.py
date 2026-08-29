import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

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


@patch.dict("os.environ", {"LANGSMITH_TRACING": "false", "LANGSMITH_API_KEY": ""})
class LivePipelineTest(unittest.TestCase):
    def test_model_calls_have_expected_trace_names_and_correlation_id(self):
        responses = [
            SimpleNamespace(content=[SimpleNamespace(text='{"intent_type":"noise"}')]),
            SimpleNamespace(content=[SimpleNamespace(text='{"clusters":[]}')]),
            SimpleNamespace(content=[SimpleNamespace(text='{"title":"Generated"}')]),
        ]
        create = Mock(side_effect=responses)
        client = SimpleNamespace(messages=SimpleNamespace(create=create))
        run_id = "AST-7F2A"

        live_pipeline.classify_item(client, "UI-001", "Feedback", run_id)
        live_pipeline.run_clustering(client, "Items", run_id)
        live_pipeline.generate_workpack(
            client, "noise", "Members", "Context", run_id
        )

        self.assertEqual(create.call_count, 3)
        extras = [call.kwargs["langsmith_extra"] for call in create.call_args_list]
        self.assertEqual([extra["name"] for extra in extras], [
            "classify", "cluster", "generate",
        ])
        self.assertTrue(all(extra["metadata"] == {"run_id": run_id} for extra in extras))

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
        self.assertRegex(result["meta"]["run_id"], r"^AST-[0-9A-F]{4}$")
        self.assertGreaterEqual(result["meta"]["elapsed_ms"], 0)
        self.assertEqual(result["meta"]["llm_calls"], 4)

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
        self.assertRegex(result["meta"]["run_id"], r"^AST-[0-9A-F]{4}$")
        self.assertGreaterEqual(result["meta"]["elapsed_ms"], 0)
        self.assertEqual(result["meta"]["llm_calls"], 3)
        self.assertEqual(classify_item.call_count, 1)
        run_clustering.assert_called_once()
        generate_workpack.assert_called_once()

    @patch.object(live_pipeline, "generate_workpack")
    @patch.object(live_pipeline, "run_clustering")
    @patch.object(live_pipeline, "classify_item")
    @patch.object(live_pipeline, "_get_client", return_value=object())
    def test_llm_calls_excludes_generation_that_was_not_attempted(
        self, get_client, classify_item, run_clustering, generate_workpack
    ):
        classify_item.return_value = _classification("UI-001")
        run_clustering.return_value = [{
            "cluster_members": ["UI-001"],
        }]

        result = live_pipeline.run_pipeline(["The upload fails during submission."])

        self.assertEqual(result["meta"]["llm_calls"], 2)
        self.assertEqual(result["meta"]["hard_fails"], 1)
        generate_workpack.assert_not_called()


class LangSmithLifecycleTest(unittest.TestCase):
    def test_tracing_disabled_does_not_create_langsmith_client(self):
        expected = {"clusters": [], "meta": {}}
        with (
            patch.dict("os.environ", {
                "LANGSMITH_TRACING": "false",
                "LANGSMITH_API_KEY": "",
            }),
            patch.object(live_pipeline, "LangSmithClient") as client_factory,
            patch.object(
                live_pipeline,
                "_run_pipeline_traced",
                return_value=expected,
            ) as traced_pipeline,
        ):
            result = live_pipeline.run_pipeline(["Synthetic feedback"])

        self.assertIs(result, expected)
        client_factory.assert_not_called()
        traced_pipeline.assert_called_once_with(["Synthetic feedback"], "")

    def test_langsmith_client_creation_failure_runs_pipeline_untraced(self):
        expected = {"clusters": [], "meta": {}}
        with (
            patch.dict("os.environ", {
                "LANGSMITH_TRACING": "true",
                "LANGSMITH_API_KEY": "test-langsmith-key",
            }),
            patch.object(
                live_pipeline,
                "LangSmithClient",
                side_effect=RuntimeError("client creation failed"),
            ),
            patch.object(
                live_pipeline,
                "_run_pipeline_traced",
                return_value=expected,
            ) as traced_pipeline,
        ):
            result = live_pipeline.run_pipeline(["Synthetic feedback"])

        self.assertIs(result, expected)
        traced_pipeline.assert_called_once_with(["Synthetic feedback"], "")

    def test_tracing_enabled_flushes_explicit_parent_client(self):
        expected = {"clusters": [], "meta": {}}
        langsmith_client = Mock()
        lifecycle = []
        langsmith_client.flush.side_effect = lambda: lifecycle.append("flush")

        def complete_pipeline(*args, **kwargs):
            lifecycle.append("pipeline complete")
            return expected

        with (
            patch.dict("os.environ", {
                "LANGSMITH_TRACING": "true",
                "LANGSMITH_API_KEY": "test-langsmith-key",
            }),
            patch.object(
                live_pipeline,
                "LangSmithClient",
                return_value=langsmith_client,
            ),
            patch.object(
                live_pipeline,
                "_run_pipeline_traced",
                side_effect=complete_pipeline,
            ) as traced_pipeline,
        ):
            result = live_pipeline.run_pipeline(["Synthetic feedback"])

        self.assertIs(result, expected)
        self.assertIs(
            traced_pipeline.call_args.kwargs["langsmith_extra"]["client"],
            langsmith_client,
        )
        langsmith_client.flush.assert_called_once_with()
        self.assertEqual(lifecycle, ["pipeline complete", "flush"])

    def test_same_explicit_client_is_given_to_anthropic_wrapper(self):
        langsmith_client = Mock()
        anthropic_client = Mock()
        wrapped_client = Mock()
        with (
            patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-anthropic-key"}),
            patch("anthropic.Anthropic", return_value=anthropic_client),
            patch.object(
                live_pipeline,
                "wrap_anthropic",
                return_value=wrapped_client,
            ) as wrapper,
        ):
            result = live_pipeline._get_client(langsmith_client)

        self.assertIs(result, wrapped_client)
        wrapper.assert_called_once_with(
            anthropic_client,
            tracing_extra={"client": langsmith_client},
        )

    def test_flush_failure_does_not_change_successful_result(self):
        expected = {"clusters": [], "meta": {}}
        langsmith_client = Mock()
        langsmith_client.flush.side_effect = RuntimeError("flush failed")
        with (
            patch.dict("os.environ", {
                "LANGSMITH_TRACING": "true",
                "LANGSMITH_API_KEY": "test-langsmith-key",
            }),
            patch.object(
                live_pipeline,
                "LangSmithClient",
                return_value=langsmith_client,
            ),
            patch.object(
                live_pipeline,
                "_run_pipeline_traced",
                return_value=expected,
            ),
        ):
            result = live_pipeline.run_pipeline(["Synthetic feedback"])

        self.assertIs(result, expected)
        langsmith_client.flush.assert_called_once_with()

    def test_pipeline_error_is_preserved_after_flush_attempt(self):
        langsmith_client = Mock()
        langsmith_client.flush.side_effect = RuntimeError("flush failed")
        with (
            patch.dict("os.environ", {
                "LANGSMITH_TRACING": "true",
                "LANGSMITH_API_KEY": "test-langsmith-key",
            }),
            patch.object(
                live_pipeline,
                "LangSmithClient",
                return_value=langsmith_client,
            ),
            patch.object(
                live_pipeline,
                "_run_pipeline_traced",
                side_effect=RuntimeError("pipeline failed"),
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "pipeline failed"):
                live_pipeline.run_pipeline(["Synthetic feedback"])

        langsmith_client.flush.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
