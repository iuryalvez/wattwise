"""Protect checkout entry points and resource lookup during reorganizations."""

import json
import subprocess
import sys
import unittest

from wattwise.paths import ROOT


class EntrypointTests(unittest.TestCase):
    def run_command(self, *arguments):
        return subprocess.run(
            [sys.executable, "-B", str(ROOT / "scripts" / "run.py"), *arguments],
            cwd=ROOT / "docs", capture_output=True, text=True, encoding="utf-8", timeout=10,
        )

    def test_estimates_find_default_fixture_from_another_directory(self):
        for mode, evidence in [("manual", "manual_estimate"), ("simulated", "simulated")]:
            with self.subTest(mode=mode):
                result = self.run_command("estimate", "--mode", mode)
                self.assertEqual(result.returncode, 0, result.stderr)
                report = json.loads(result.stdout)
                self.assertEqual(report["evidence"], evidence)
                self.assertEqual(report["ai"]["status"], "not_invoked")

    def test_subcommand_help_exposes_the_correct_options(self):
        for command, option in [("serve", "--port"), ("estimate", "--input")]:
            with self.subTest(command=command):
                result = self.run_command(command, "--help")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(option, result.stdout)

    def test_invalid_subcommand_fails_without_starting_a_server(self):
        result = self.run_command("unknown")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("invalid choice", result.stderr)


if __name__ == "__main__":
    unittest.main()
