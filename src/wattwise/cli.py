"""Command-line calculator entry point."""

import json
import sys

from .advisor.hosted import gemma_explanation
from .energy import estimate_household, simulated_comparison
from .paths import EXAMPLES_DIR


def main(input_path=None, mode="manual", gemma=False):
    try:
        config = json.loads((input_path or EXAMPLES_DIR / "household.json").read_text(encoding="utf-8"))
        summary = estimate_household(config) if mode == "manual" else simulated_comparison(config)
        if gemma:
            summary["ai"] = gemma_explanation(summary)
        else:
            summary["ai"] = {"status": "not_invoked", "note": "Calculator mode; no model call was made."}
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print(f"Could not run prototype: {exc}", file=sys.stderr)
        return 1
    return 0
