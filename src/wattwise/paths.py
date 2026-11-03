"""Resolve checkout resources independently of the current directory."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB_DIR = ROOT / "web"
EXAMPLES_DIR = ROOT / "examples"
SKILL_PATH = ROOT / "skills" / "household-energy-coach" / "SKILL.md"
