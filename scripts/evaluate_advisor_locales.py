"""Optional real local-model locale evaluation; output still requires prose review."""

import argparse
import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from wattwise.advisor.ollama import advise, ollama_status
from wattwise.advisor.skill import load_skill
from wattwise.i18n import LANGUAGES
from wattwise.samples import SAMPLE


def evaluate(locales, output):
    status = ollama_status()
    if not status["available"]:
        print(json.dumps({"status": "not_run", "reason": status}, ensure_ascii=False))
        return 1
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    dirty = bool(subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    outcomes = []
    for locale in locales:
        for case in ("recommend", "clarify", "no_candidates"):
            config = copy.deepcopy(SAMPLE)
            config["locale"] = locale
            # Deliberately retain Portuguese source data to test output language independently.
            config["context"] = "Só podemos reduzir a televisão de quatro para três horas. Preserve todos os outros usos."
            if case == "clarify":
                config["context"] = ""
            if case == "no_candidates":
                for device in config["devices"]:
                    device["plannedWatts"], device["plannedHours"] = device["watts"], device["hours"]
            started = perf_counter()
            row = {"locale": locale, "case": case, "language_review": "pending", "grounding_review": "pending"}
            try:
                reply = advise(config)
                expected = "recommend" if case == "recommend" else "clarify"
                row.update(reply=reply, contract_valid=True,
                           expected_decision=expected, expected_behavior=reply["decision"] == expected and
                           (case != "recommend" or reply["candidate"] is not None and reply["candidate"]["id"] == "tv"))
            except (ValueError, OSError) as exc:
                row.update(contract_valid=False, expected_behavior=False, error=str(exc))
            row["seconds"] = round(perf_counter() - started, 2)
            outcomes.append(row)
            print(json.dumps({key: row.get(key) for key in ("locale", "case", "contract_valid", "expected_behavior", "seconds")}), flush=True)
    report = {"created_at": datetime.now(timezone.utc).isoformat(), "commit": commit, "dirty_checkout": dirty,
              "model": status["model"], "skill_sha256": load_skill()["sha256"],
              "runtime_source_sha256": {name: hashlib.sha256((ROOT / "src/wattwise" / name).read_text(encoding="utf-8").encode()).hexdigest()
                                        for name in ("advisor/ollama.py", "i18n.py", "advisor/skill.py")},
              "scope": "Fictional household recommendation, clarification, and no-candidate cases per locale; not the full issue #6 evaluation.",
              "language_compliance": "not_established_until_manual_review", "cases": outcomes}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Report: {output}. Language and grounding review remain pending.")
    return 0 if all(row["contract_valid"] and row["expected_behavior"] for row in outcomes) else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--locale", choices=list(LANGUAGES), action="append", help="Repeat to select locales; defaults to all enabled locales")
    args = parser.parse_args()
    return evaluate(args.locale or list(LANGUAGES), ROOT / "artifacts/evaluations/advisor-locales.json")


if __name__ == "__main__":
    raise SystemExit(main())
