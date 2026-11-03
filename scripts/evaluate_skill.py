"""Small real-model behavioral evaluation; all household contexts are fictional."""

import copy
import json
from pathlib import Path
import sys
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from wattwise.advisor.ollama import advise
from wattwise.planning import analyze
from wattwise.samples import SAMPLE


def main():
    outcomes = []

    def run(name, config, expected_decision, expected_id=None):
        start = perf_counter()
        try:
            reply = advise(config)
            passed = reply["decision"] == expected_decision and (
                expected_id is None or reply["candidate"]["id"] == expected_id)
            baseline = analyze(config)["opportunities"]
            outcomes.append({"case": name, "passed": passed, "seconds": round(perf_counter() - start, 2),
                             "largest_saving_candidate": baseline[0]["id"] if baseline else None,
                             "expected_decision": expected_decision, "expected_id": expected_id, "reply": reply})
            print(json.dumps({"case": name, "passed": passed, "decision": reply["decision"],
                              "choice": reply["candidate"]["id"] if reply["candidate"] else None}, ensure_ascii=False), flush=True)
            return reply
        except (ValueError, TypeError) as exc:
            outcomes.append({"case": name, "passed": False, "error": str(exc)})
            print(json.dumps({"case": name, "passed": False, "error": str(exc)}, ensure_ascii=False), flush=True)
            return None

    restricted = copy.deepcopy(SAMPLE)
    restricted["context"] = "Somente a televisão pode ter o tempo reduzido. Não podemos mudar ar-condicionado, banhos, computador ou iluminação. Podemos testar televisão de quatro para três horas por dia."
    run("preferences_override_largest_saving", restricted, "recommend", "tv")

    missing = copy.deepcopy(SAMPLE)
    missing["context"] = ""
    clarification = run("missing_routine_requires_question", missing, "clarify")
    if clarification and clarification["decision"] == "clarify":
        missing["advisorAnswers"] = [{"question": clarification["question"], "answer": restricted["context"]}]
        run("answer_changes_decision", missing, "recommend", "tv")
    else:
        outcomes.append({"case": "answer_changes_decision", "passed": False, "error": "No valid clarification to answer"})

    no_changes = copy.deepcopy(SAMPLE)
    for device in no_changes["devices"]:
        device["plannedWatts"], device["plannedHours"] = device["watts"], device["hours"]
    run("no_candidates_does_not_invent_a_plan", no_changes, "clarify")

    result = {"fixture": "synthetic_skill_behavior_v1", "passed": sum(row["passed"] for row in outcomes),
              "total": len(outcomes), "scope": "Small local smoke evaluation, not a general model benchmark", "cases": outcomes}
    output = ROOT / "artifacts" / "evaluations" / "skill-evaluation.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Passed {result['passed']}/{result['total']}", flush=True)
    return 0 if result["passed"] == result["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
