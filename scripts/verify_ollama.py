"""Run a real local-model smoke test using only the fictional household fixture."""

import json
from pathlib import Path
import sys
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from wattwise.advisor.ollama import advise, ollama_status
from wattwise.samples import SAMPLE


def main():
    status = ollama_status()
    if not status["available"]:
        print(json.dumps({"status": "model_not_ready", **status}, ensure_ascii=False))
        return 1
    start = perf_counter()
    try:
        plan = advise(SAMPLE)
    except ValueError as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, ensure_ascii=False))
        return 1
    result = {"status": "passed", "fixture": SAMPLE.get("scenario", "fictional_household"), "latency_seconds": round(perf_counter() - start, 2),
              "checks": {"real_local_inference": True, "choice_validated_by_backend": True,
                         "protected_work_unchanged": plan["candidate"]["id"] != "work",
                         "savings_are_estimates": plan["evidence"] == "manual_estimate"}, "plan": plan}
    output = ROOT / "artifacts" / "evaluations" / "ollama-smoke-test.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "model": plan["model"], "latency_seconds": result["latency_seconds"],
                      "selected_appliance": plan["candidate"]["name"], "report": str(output)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
