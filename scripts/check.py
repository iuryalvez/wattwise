"""Run all offline contributor checks: python scripts/check.py."""

import json
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def main():
    if sys.version_info < (3, 11):
        print("Checks require Python 3.11 or newer.", file=sys.stderr)
        return 1
    node = shutil.which("node")
    if node is None:
        print("Checks require Node.js 24. Install it and restart your terminal.", file=sys.stderr)
        return 1

    try:
        version = subprocess.run([node, "--version"], check=True, capture_output=True, text=True).stdout.strip()
        if int(version.removeprefix("v").split(".")[0]) < 24:
            print(f"Checks require Node.js 24 or newer; found {version}.", file=sys.stderr)
            return 1
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"Could not check the Node.js version: {exc}", file=sys.stderr)
        return 1

    commands = [("Python unit tests", [sys.executable, "-B", "-m", "unittest", "discover", "-s", "tests", "-v"])]
    for directory in ("web", "tests"):
        for file in sorted((ROOT / directory).glob("*.js")):
            relative = file.relative_to(ROOT).as_posix()
            commands.append((f"JavaScript syntax: {relative}", [node, "--check", relative]))
    for file in sorted((ROOT / "tests").glob("test_*.js")):
        relative = file.relative_to(ROOT).as_posix()
        commands.append((f"JavaScript tests: {relative}", [node, relative]))

    try:
        for label, command in commands:
            print(f"\n{label}", flush=True)
            result = subprocess.run(command, cwd=ROOT)
            if result.returncode:
                print(f"Failed: {label}", file=sys.stderr)
                return result.returncode if result.returncode > 0 else 1

        for mode in ("manual", "simulated"):
            print(f"\nOffline CLI: {mode}", flush=True)
            result = subprocess.run([sys.executable, "-B", "demo.py", "--mode", mode],
                                    cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
            if result.returncode:
                print(result.stderr or result.stdout, file=sys.stderr)
                return result.returncode if result.returncode > 0 else 1
            report = json.loads(result.stdout)
            expected = "manual_estimate" if mode == "manual" else "simulated"
            if report.get("evidence") != expected or report.get("ai", {}).get("status") != "not_invoked":
                print(f"Unexpected evidence or AI status in {mode} CLI output.", file=sys.stderr)
                return 1
    except (OSError, ValueError) as exc:
        print(f"Could not complete checks: {exc}", file=sys.stderr)
        return 1

    print("\nAll offline checks passed. No model or hardware was required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
