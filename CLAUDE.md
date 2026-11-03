# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Python 3.11+, standard library only (no runtime dependencies to install).

```bash
python app.py                      # local web app at http://127.0.0.1:8765/ (use --port N to change)
python demo.py                     # CLI calculator, manual projection, reads examples/household.json
python demo.py --mode simulated    # CLI with generated 24h interval windows
python demo.py --gemma             # CLI + hosted Gemma explanation (needs GEMINI_API_KEY; GEMMA_MODEL overrides)

python -m unittest discover -s tests -v              # full test suite (Ollama calls are mocked)
python -m unittest tests.test_app.AppTests.test_single_change_keeps_other_household_uses   # single test
node --check web/app.js                              # syntax check for the frontend

python scripts/verify_ollama.py    # live smoke test against a running local Ollama
python scripts/evaluate_skill.py   # 4-case live behavioral eval; rerun after changing the model or SKILL.md
```

Local model: `ollama run gemma4:e2b`; choose another with `OLLAMA_MODEL` (must match `gemma4[:tag]`, cloud tags are rejected). `requirements-dev.txt` (PyYAML) is only for the upstream skill-creator validator.

## Architecture

WattWise is a loopback-only household energy planning MVP. The UI and all user-facing error messages are in **Brazilian Portuguese**; keep new user-facing strings in Portuguese. Code and CLI messages are in English.

- **`demo.py`**: the deterministic calculation core and the original CLI. `number()` (numeric validation) and `reduction()` (kWh/BRL delta dict) are imported by `app.py`. The CLI input format (`examples/household.json`) uses `household_voltage_v`, `variable_rate_brl_per_kwh`, and appliances with `baseline`/`proposed` lists of mutually exclusive states, each with either `watts` or `components` (never both).
- **`app.py`**: `ThreadingHTTPServer` bound to `127.0.0.1`. Endpoints: `GET /api/sample` (serves `examples/family-household.json`), `GET /api/status`, `POST /api/analyze`, `POST /api/advise`. Static files are an explicit allowlist (`/`, `/app.js`, `/styles.css` from `web/`); adding a web asset requires adding it to that map. The handler enforces Host/Origin checks, `application/json`, a 64 KB body limit, and a strict CSP. The web input format is flat: `voltage`, `rate`, `days`, `context`, and `devices[]` with `watts`/`hours`/`plannedWatts`/`plannedHours`/`protected`.
- **`energy_skill.py`**: loads `skills/household-energy-coach/SKILL.md` at request time (its body becomes the Ollama system prompt and its sha256 is returned for traceability), builds the JSON schema for structured output, validates model replies, and constructs the 7-day experiment.
- **`web/`**: plain HTML/JS/CSS, no build step. All state (household inputs, up to 4 follow-up answers, last 10 simulations) lives in browser `localStorage` under the key `wattwise-mvp-v1`. There is no server-side storage.

### Advisor flow (`advise()`)

`analyze()` computes per-device energy and ranks **opportunities**: unprotected devices with a positive reduction, each evaluated as a *single* change with the rest of the household at baseline. The top 8 become candidates. Gemma (via `http://127.0.0.1:11434/api/chat`, non-streaming, `think: false`, `temperature: 0`, `num_ctx` 4096) may only `recommend` one candidate id or `clarify` with a question. If there is no routine context and no answers, or no candidates, the schema forces clarification only, and a recommendation is rejected server-side anyway.

## Invariants to preserve

- **The model never does arithmetic.** All kWh/BRL numbers come from the deterministic calculator; model output is constrained to an enum of precomputed candidate ids and validated by `validate_reply()`.
- **Protected (essential) uses cannot change**: `analyze()` rejects a protected device whose planned values differ, and protected devices are never candidates.
- **Evidence labels stay honest**: `manual_estimate` and `simulated` are projections, not measured savings. Do not present them as real-world results. Missing meter intervals are rejected, never treated as zero.
- Voltage is descriptive metadata and is never multiplied into energy (`kWh = W × h / 1000`).
- The non-AI fallback ("Usar maior potencial, sem IA") must stay labeled as a calculator ranking, never as a model response.
- Never commit API keys (`.env*` is gitignored).

## Further context

`README.md` (usage and evidence labels), `PROJECT.md` (product brief and scope), `docs/CURRENT_STATE.md` (architecture assessment and known gaps), `docs/HACKATHON.md` (demo script). Example data is fictional.
