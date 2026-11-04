"""Evaluator control flow only; these mocks are not language-compliance evidence."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from scripts.evaluate_advisor_locales import evaluate


class AdvisorLocaleEvaluationTests(unittest.TestCase):
    def test_unavailable_model_does_not_produce_a_pass_report(self):
        with patch("scripts.evaluate_advisor_locales.ollama_status", return_value={"available": False}), patch("builtins.print"):
            self.assertEqual(evaluate(["en"], Path("unused-report.json")), 1)

    def test_report_keeps_language_and_grounding_reviews_pending(self):
        def reply(config):
            no_candidates = all(device["plannedHours"] == device["hours"] and device["plannedWatts"] == device["watts"] for device in config["devices"])
            recommend = bool(config["context"]) and not no_candidates
            return {"decision": "recommend" if recommend else "clarify", "candidate": {"id": "tv"} if recommend else None,
                    "reason": "Mock text, not language evidence"}

        with TemporaryDirectory() as directory, patch("scripts.evaluate_advisor_locales.ollama_status", return_value={"available": True, "model": "mock"}), patch(
                "scripts.evaluate_advisor_locales.advise", side_effect=reply), patch("scripts.evaluate_advisor_locales.subprocess.run", return_value=SimpleNamespace(stdout="fake-commit")), patch("builtins.print"):
            output = Path(directory) / "report.json"
            self.assertEqual(evaluate(["en", "pt-BR", "es"], output), 0)
            report = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(len(report["cases"]), 9)
            self.assertEqual(report["language_compliance"], "not_established_until_manual_review")
            self.assertTrue(all(row["language_review"] == "pending" and row["grounding_review"] == "pending" for row in report["cases"]))
