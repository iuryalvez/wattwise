"""Fictional planning profiles shared by the server and evaluation tools."""

import json

from .paths import EXAMPLES_DIR

SAMPLE = json.loads((EXAMPLES_DIR / "family-household.json").read_text(encoding="utf-8"))
HIGH_CONSUMPTION_SAMPLE = json.loads((EXAMPLES_DIR / "high-consumption-household.json").read_text(encoding="utf-8"))
INDUSTRIAL_SAMPLE = json.loads((EXAMPLES_DIR / "industrial-packaging.json").read_text(encoding="utf-8"))
