import copy
from io import BytesIO
import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from wattwise.advisor.ollama import advise, ollama_model, ollama_status
from wattwise.planning import analyze
from wattwise.samples import HIGH_CONSUMPTION_SAMPLE, INDUSTRIAL_SAMPLE, SAMPLE
from wattwise.server import Handler


class AppTests(unittest.TestCase):
    def setUp(self):
        self.config = copy.deepcopy(SAMPLE)

    def test_single_change_keeps_other_household_uses(self):
        report = analyze(self.config)
        best = report["opportunities"][0]
        self.assertEqual(best["id"], "ac")
        self.assertEqual(best["energy_reduction_kwh"], 27)
        self.assertAlmostEqual(best["household_after_kwh"], report["total"]["baseline_kwh"] - 27)
        self.assertNotIn("work", [c["id"] for c in report["opportunities"]])

    def test_family_appliances_use_average_power_and_total_daily_shower_time(self):
        report = analyze(self.config)
        rows = {row["id"]: row for row in report["devices"]}
        self.assertEqual(rows["shower"]["baseline_kwh"], 82.5)
        self.assertEqual(rows["shower"]["energy_reduction_kwh"], 16.5)
        self.assertEqual(rows["fridge"]["baseline_kwh"], 50.4)
        self.assertEqual(rows["fridge"]["hours"], 24)
        self.assertTrue(rows["fridge"]["protected"])
        self.assertNotIn("fridge", [c["id"] for c in report["opportunities"]])
        self.assertEqual(report["total"]["baseline_kwh"], 480.24)

    def test_cannot_reduce_a_protected_use(self):
        self.config["devices"][0]["plannedHours"] = 1
        with self.assertRaisesRegex(ValueError, "protegido"):
            analyze(self.config)

    def test_duplicate_ids_and_invalid_hours_are_rejected(self):
        self.config["devices"][1]["id"] = "work"
        with self.assertRaises(ValueError):
            analyze(self.config)
        self.config = copy.deepcopy(SAMPLE)
        self.config["devices"][0]["hours"] = 25
        with self.assertRaises(ValueError):
            analyze(self.config)

    def test_zero_price_keeps_energy_opportunity(self):
        self.config["rate"] = 0
        report = analyze(self.config)
        self.assertGreater(report["opportunities"][0]["energy_reduction_kwh"], 0)
        self.assertEqual(report["opportunities"][0]["modeled_variable_cost_reduction_brl"], 0)

    def test_high_consumption_case_uses_more_energy_at_the_same_rate(self):
        report = analyze(copy.deepcopy(HIGH_CONSUMPTION_SAMPLE))
        self.assertEqual(report["rate"], self.config["rate"])
        self.assertEqual(report["days"], 30)
        self.assertEqual(report["total"]["baseline_kwh"], 2011.2)
        self.assertEqual(report["total"]["baseline_cost_brl"], 2111.76)
        self.assertEqual(report["evidence"], "manual_estimate")
        best = report["opportunities"][0]
        self.assertEqual(best["id"], "ac-living")
        self.assertEqual(best["watts"], best["plannedWatts"])
        self.assertEqual(best["hours"], 8)
        self.assertEqual(best["plannedHours"], 2)
        self.assertEqual(best["energy_reduction_kwh"], 270)
        self.assertEqual(best["modeled_variable_cost_reduction_brl"], 283.5)
        self.assertEqual(best["household_after_kwh"], 1741.2)
        self.assertEqual(best["household_after_cost_brl"], 1828.26)

    def test_high_consumption_case_preserves_essential_loads(self):
        config = copy.deepcopy(HIGH_CONSUMPTION_SAMPLE)
        rows = {row["id"]: row for row in analyze(config)["devices"]}
        for identity in ["work", "fridge", "freezer", "ac-bedroom", "ev", "router"]:
            with self.subTest(identity=identity):
                self.assertTrue(rows[identity]["protected"])
                self.assertEqual(rows[identity]["energy_reduction_kwh"], 0)
        self.assertEqual(rows["ev"]["baseline_kwh"], 216)
        self.assertEqual(rows["shower"]["baseline_kwh"], 225)
        self.assertEqual(rows["shower"]["energy_reduction_kwh"], 56.25)
        self.assertEqual(rows["dryer"]["energy_reduction_kwh"], 37.5)
        self.assertEqual(rows["fridge"]["baseline_kwh"], 64.8)
        self.assertEqual(rows["freezer"]["baseline_kwh"], 39.6)

    def test_sample_routes_keep_the_original_case_and_reject_unknown_paths(self):
        handler = Handler.__new__(Handler)
        handler.server = SimpleNamespace(server_port=8765)
        handler.headers = {"Host": "127.0.0.1:8765"}
        handler.send = Mock()
        for path, expected in [("/api/sample", SAMPLE), ("/api/sample/high-consumption", HIGH_CONSUMPTION_SAMPLE),
                               ("/api/sample/industrial", INDUSTRIAL_SAMPLE)]:
            with self.subTest(path=path):
                handler.path = path
                handler.do_GET()
                handler.send.assert_called_with(200, expected)
        handler.path = "/api/sample/unknown"
        handler.do_GET()
        self.assertEqual(handler.send.call_args.args[0], 404)
        handler.path = "/api/sample/high-consumption"
        handler.headers["Host"] = "example.com"
        handler.do_GET()
        self.assertEqual(handler.send.call_args.args[0], 403)

    def test_industrial_case_preserves_production_in_single_change_comparison(self):
        report = analyze(copy.deepcopy(INDUSTRIAL_SAMPLE))
        self.assertEqual(report["site_type"], "industrial")
        self.assertEqual(report["total"]["baseline_kwh"], 21645.6)
        self.assertEqual(report["total"]["baseline_cost_brl"], 22727.88)
        self.assertEqual(report["evidence"], "manual_estimate")
        best = report["opportunities"][0]
        self.assertEqual(best["id"], "compressor-idle")
        self.assertEqual(best["energy_reduction_kwh"], 2304)
        self.assertEqual(best["modeled_variable_cost_reduction_brl"], 2419.2)
        self.assertEqual(best["household_after_kwh"], 19341.6)
        self.assertEqual(best["household_after_cost_brl"], 20308.68)
        rows = {row["id"]: row for row in report["devices"]}
        for identity in ["production-line", "compressor-active", "extraction", "process-cooling", "production-lighting", "safety-network"]:
            with self.subTest(identity=identity):
                self.assertTrue(rows[identity]["protected"])
                self.assertEqual(rows[identity]["energy_reduction_kwh"], 0)

    def test_industrial_daily_equivalents_include_operating_and_calendar_days(self):
        rows = {row["id"]: row for row in analyze(copy.deepcopy(INDUSTRIAL_SAMPLE))["devices"]}
        self.assertEqual(rows["production-line"]["baseline_kwh"], 45 * 8 * 24)
        self.assertEqual(rows["compressor-active"]["baseline_kwh"], 22 * 8 * 24)
        self.assertEqual(rows["compressor-idle"]["baseline_kwh"], 6 * 16 * 24)
        self.assertEqual(rows["safety-network"]["baseline_kwh"], 0.25 * 24 * 30)
        self.assertEqual(rows["warehouse-lighting"]["energy_reduction_kwh"], 3 * (16 - 4) * 24)

    def test_unknown_site_type_is_rejected_and_legacy_households_keep_the_default(self):
        self.assertEqual(analyze(self.config)["site_type"], "household")
        for invalid in ["unknown", None, [], True]:
            with self.subTest(site_type=invalid):
                self.config["siteType"] = invalid
                with self.assertRaisesRegex(ValueError, "perfil"):
                    analyze(self.config)

    def model_response(self, candidate_id="tv", decision="recommend"):
        content = json.dumps({"decision": decision, "candidate_id": candidate_id, "reason": "Compatível com a rotina.",
                              "next_step": "Confirme o período de uso.", "question": "Esse ajuste é possível?"})
        return BytesIO(json.dumps({"message": {"content": content}}).encode())

    def test_model_selects_only_precomputed_candidate(self):
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=self.model_response()) as mocked:
            result = advise(self.config)
            payload = json.loads(mocked.call_args.args[0].data)
        self.assertFalse(payload["stream"])
        self.assertFalse(payload["think"])
        self.assertIn("candidate_id", payload["format"]["properties"])
        self.assertEqual(result["provider"], "ollama")
        self.assertEqual(result["candidate"]["id"], "tv")
        self.assertEqual(result["candidate"]["energy_reduction_kwh"], 3)
        self.assertEqual(result["candidate"]["modeled_variable_cost_reduction_brl"], 3.15)
        self.assertEqual(result["skill"]["name"], "household-energy-coach")
        self.assertEqual(result["experiment"]["duration_days"], 7)

    def test_advisor_accepts_high_consumption_choice_and_rejects_essential_cooling(self):
        config = copy.deepcopy(HIGH_CONSUMPTION_SAMPLE)
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=self.model_response("ac-living")):
            result = advise(config)
        self.assertEqual(result["candidate"]["household_after_cost_brl"], 1828.26)
        self.assertEqual(result["experiment"]["appliance_id"], "ac-living")
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=self.model_response("ac-bedroom")):
            with self.assertRaisesRegex(ValueError, "fora das opções"):
                advise(config)

    def test_industrial_advisor_uses_operational_context_and_protects_active_equipment(self):
        config = copy.deepcopy(INDUSTRIAL_SAMPLE)
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=self.model_response("compressor-idle")) as mocked:
            result = advise(config)
        payload = json.loads(mocked.call_args.args[0].data)
        self.assertEqual(json.loads(payload["messages"][1]["content"])["site_type"], "industrial")
        self.assertIn("production", result["experiment"]["check"])
        self.assertIn("quality", result["experiment"]["check"])
        self.assertNotIn("comfort", result["experiment"]["check"])
        self.assertEqual(result["candidate"]["household_after_cost_brl"], 20308.68)
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=self.model_response("compressor-active")):
            with self.assertRaisesRegex(ValueError, "fora das opções"):
                advise(config)

    def test_invalid_or_protected_model_choice_is_rejected(self):
        for identity in ["invented", "work"]:
            with self.subTest(identity=identity), patch("wattwise.advisor.ollama.request.urlopen", return_value=self.model_response(identity)):
                with self.assertRaisesRegex(ValueError, "fora das opções"):
                    advise(self.config)

    def test_missing_model_does_not_report_ready(self):
        with patch("wattwise.advisor.ollama.request.urlopen", side_effect=ConnectionRefusedError):
            self.assertFalse(ollama_status()["available"])

    def test_cloud_tags_are_not_accepted_as_local(self):
        with patch.dict("os.environ", {"OLLAMA_MODEL": "gemma4:31b-cloud"}):
            with self.assertRaises(ValueError):
                ollama_model()

    def test_no_eligible_change_can_be_clarified_without_inventing_savings(self):
        for device in self.config["devices"]:
            device["plannedHours"], device["plannedWatts"] = device["hours"], device["watts"]
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=self.model_response("none", "clarify")):
            result = advise(self.config)
        self.assertEqual(result["decision"], "clarify")
        self.assertIsNone(result["candidate"])
        self.assertIsNone(result["experiment"])

    def test_answers_and_real_skill_are_loaded_into_model_request(self):
        self.config["advisorAnswers"] = [{"question": "Qual uso pode mudar?", "answer": "A televisão pode ser reduzida."}]
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=self.model_response()) as mocked:
            result = advise(self.config)
        payload = json.loads(mocked.call_args.args[0].data)
        from wattwise.advisor.skill import load_skill
        self.assertIn(load_skill()["body"], payload["messages"][0]["content"])
        self.assertIn("Response locale: en.", payload["messages"][0]["content"])
        supplied = json.loads(payload["messages"][1]["content"])
        self.assertEqual(supplied["answers"], self.config["advisorAnswers"])
        self.assertEqual(result["answers_considered"], 1)

    def test_clarification_cannot_smuggle_an_action(self):
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=self.model_response("ac", "clarify")):
            with self.assertRaises(ValueError):
                advise(self.config)

    def test_missing_routine_constrains_generation_to_a_question(self):
        self.config["context"] = ""
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=self.model_response("none", "clarify")) as mocked:
            result = advise(self.config)
        payload = json.loads(mocked.call_args.args[0].data)
        self.assertEqual(payload["format"]["properties"]["decision"]["enum"], ["clarify"])
        self.assertEqual(payload["format"]["properties"]["candidate_id"]["enum"], ["none"])
        self.assertIsNone(result["candidate"])


if __name__ == "__main__":
    unittest.main()
