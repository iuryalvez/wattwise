import json
from pathlib import Path
import unittest
from unittest.mock import patch

from wattwise.advisor.hosted import gemma_explanation
from wattwise.energy import daily_energy, estimate_household, integrate_simulated_day, simulate_intervals


class EnergyTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((Path(__file__).parents[2] / "examples" / "household.json").read_text(encoding="utf-8"))

    def test_one_kw_for_one_hour_is_one_kwh(self):
        self.assertEqual(daily_energy([{"hours": 1, "watts": 1000}]), 1)

    def test_components_and_monthly_example(self):
        result = estimate_household(self.config)
        self.assertEqual(result["evidence"], "manual_estimate")
        self.assertEqual(result["total"]["baseline_kwh"], 78.9)
        self.assertEqual(result["total"]["proposed_kwh"], 57.3)
        self.assertEqual(result["total"]["energy_reduction_kwh"], 21.6)

    def test_simulation_preserves_fractional_duration_and_zero_fill(self):
        states = [{"hours": 0.3, "watts": 1000}]
        intervals = simulate_intervals(states)
        self.assertAlmostEqual(integrate_simulated_day(intervals), 0.3)

    def test_missing_intervals_cannot_look_like_savings(self):
        intervals = simulate_intervals([{"hours": 24, "watts": 100}])
        with self.assertRaises(ValueError):
            integrate_simulated_day(intervals[:4] + intervals[5:])
        with self.assertRaises(ValueError):
            integrate_simulated_day(intervals[:-1])

    def test_invalid_schedules_and_double_counting(self):
        for state in [{"hours": 25, "watts": 10}, {"hours": -1, "watts": 10},
                      {"hours": 1, "watts": float("nan")}, {"hours": True, "watts": 10},
                      {"hours": 1, "watts": 100, "components": [{"watts": 100}]}]:
            with self.subTest(state=state), self.assertRaises(ValueError):
                daily_energy([state])

    def test_zero_baseline_is_not_percentage_saving(self):
        appliance = self.config["appliances"][0]
        appliance["baseline"] = [{"hours": 24, "watts": 0}]
        result = estimate_household(self.config)["total"]
        self.assertIsNone(result["reduction_percent"])
        self.assertLess(result["energy_reduction_kwh"], 0)

    def test_gemma_requires_explicit_credentials(self):
        with patch.dict("os.environ", {}, clear=True), self.assertRaisesRegex(ValueError, "GEMINI_API_KEY"):
            gemma_explanation({})


if __name__ == "__main__":
    unittest.main()
