# Architecture

WattWise is a local application with a Python standard-library backend and plain HTML, CSS, and JavaScript. Its source lives in the `src/wattwise/` package. `python scripts/run.py serve` launches the checkout without installing it. It has no required Python packages, frontend compilation step, account system, or server database.

## Code map

| Location | Responsibility |
| --- | --- |
| `src/wattwise/__main__.py` | Command routing for `serve` and `estimate` |
| `src/wattwise/server.py` | Loopback HTTP server, static routes, and JSON endpoints |
| `src/wattwise/errors.py` | Expected failures with diagnostic codes, HTTP status, and optional field paths |
| `src/wattwise/planning.py` | Web-profile validation and single-change analysis |
| `src/wattwise/energy.py` | Numeric helpers, state/component calculations, and synthetic interval integration |
| `src/wattwise/cli.py` | Command-line estimates and optional hosted explanation orchestration |
| `src/wattwise/advisor/ollama.py` | Local model configuration, status, and advisor requests |
| `src/wattwise/advisor/hosted.py` | Explicitly opt-in hosted CLI explanation |
| `src/wattwise/advisor/skill.py` | Advisor instructions loader, follow-up validation, reply contract, and experiment descriptions |
| `src/wattwise/paths.py`, `src/wattwise/samples.py` | Checkout-relative resource paths and fictional web profiles |
| `skills/household-energy-coach/SKILL.md` | Runtime instructions loaded for advisor calls; the response includes their hash |
| `web/app.js` | Planning-page state, forms, local storage, API requests, comparisons, and saved simulations |
| `web/monitor-core.js` | Synthetic power snapshots and session-energy integration |
| `web/monitor.js` | Monitoring-page interaction, connection simulation, and chart updates |
| `web/i18n.js`, `web/locales/`, `web/locales.js` | Shared locale resolution, formatting, reviewed JSON catalogs and generated local bundle |
| `web/currency.js` | Validated, browser-local manual USD/EUR display conversion of canonical BRL amounts |
| `web/vendor/` | Pinned i18next browser runtime and license, with no CDN dependency |
| `src/wattwise/i18n.py` | Shared locale manifest, validated advisor locale, and local experiment descriptions |
| `scripts/build_locales.py`, `scripts/update_i18next.py` | Offline catalog bundling and explicit integrity-checked runtime updates |
| `scripts/evaluate_advisor_locales.py` | Optional real-model locale cases with separate pending language/grounding review |
| `web/*.html`, `web/*.css` | Page structure, accessibility hooks, and responsive styles |
| `examples/` | Fictional input fixtures for the web app and CLI |
| `tests/python/` | Python unit tests and command-entry checks |
| `tests/javascript/` | Node tests using built-ins and browser doubles |
| `scripts/run.py` | Source-checkout launcher that makes `src/` importable |
| `scripts/check.py` | Shared offline entry point for local and CI checks |
| `scripts/verify_ollama.py`, `scripts/evaluate_skill.py` | Optional live-model checks that write ignored reports in `artifacts/evaluations/` |
| `scripts/research/bdgd_grandes_consumidores.py` | Optional BDGD aggregation tool, separate from the planning app |
| `requirements/bdgd.txt` | Optional geodatabase reader dependency for BDGD research |

## Folder layout

```text
src/wattwise/          Python application package
  advisor/            Local and hosted model integrations
web/                  Browser pages, scripts, and styles
skills/               Runtime advisor instructions
examples/             Fictional input profiles
scripts/              Launch, check, and evaluation tools
  research/           Standalone public-data analysis
tests/
  python/             Backend, CLI, and research tests
  javascript/         Browser-logic and monitoring tests
requirements/         Optional tool dependencies
docs/                 Guides, screenshots, and documented research outputs
.github/              CI and contribution templates
```

The root contains project metadata and community documents. Runtime code uses package-relative imports; only launch and test entry points add `src/` to the import path. Resource paths are resolved from the checkout, so the launcher also works when invoked by absolute path from another directory. This layout runs from a source checkout; it does not provide an installable wheel yet.

## Planning flow

1. The browser loads a profile from local storage or starts with an empty device list.
2. Input changes invalidate the selected plan and schedule `POST /api/analyze`.
3. The backend validates watts, hours, price, identifiers, and protected usage. It calculates baseline consumption and proposed per-device changes.
4. Each eligible opportunity applies one change to the total baseline. Other devices retain their current usage.
5. The calculator action selects the largest modeled reduction. The advisor action sends precomputed candidates, routine text, and follow-up answers to local Ollama.
6. The backend validates the model's decision and candidate identifier. The browser renders the explanation alongside calculator-derived values.
7. Saving stores a limited simulation record in local storage. JSON export includes the current config, report, and selected plan.

The web profile uses `rate`, `days`, `devices`, `context`, optional `siteType`, and optional `advisorAnswers`. A device has baseline and proposed watts and hours. The CLI fixture uses a different schema with `variable_rate_brl_per_kwh`, `projection_days`, and `appliances` containing states and optional components. Do not pass a web fixture directly to `scripts/run.py estimate --input`.

## HTTP surface

| Method | Path | Result |
| --- | --- | --- |
| GET | `/`, `/monitor`, `/monitor/` | Planning and monitoring pages |
| GET | `/api/sample` | Fictional family web profile |
| GET | `/api/sample/high-consumption` | Fictional high-consumption web profile |
| GET | `/api/sample/industrial` | Fictional industrial web profile |
| GET | `/api/status` | Local Ollama and configured-model availability |
| POST | `/api/analyze` | Validated manual estimates and eligible opportunities |
| POST | `/api/advise` | Structured local-model recommendation or clarification |

Static assets use explicit route mappings, including local i18next and catalog assets. POST bodies must use JSON and are limited to 64 KB. Host and supplied Origin headers must match the loopback origin. Expected failures preserve `error` and add stable `code` and optional `field` values. Application exceptions also supply a localizable `message_key` and optional scalar `params`; browsers can localize envelope errors by diagnostic code. Status checks return HTTP 200 with diagnostic availability; advisor failures use 502/503/504 and invalid client input uses 400. See [API errors](API_ERRORS.md) for the contract. This surface is an internal development interface rather than a versioned public API.

## Calculation and evidence boundaries

Energy in kWh is watts multiplied by hours and divided by 1,000. Modeled variable cost is energy multiplied by the entered BRL/kWh rate. The calculation does not reconstruct utility bills, demand charges, or time-of-use tariffs.

`manual_estimate` means the result is derived from user assumptions. `simulated` means readings were generated by software. Neither establishes real-world savings. The monitoring page does not feed the calculator or advisor. A disconnected sensor has missing data rather than a zero reading.

Protected usage is validated in the backend. Candidate membership is also validated, but the feasibility of free-text preferences and the content of model explanations still rely on model behavior. The advisor currently considers at most eight candidates and four follow-up answers. See the [roadmap](ROADMAP.md) for planned improvements to these boundaries.

## Persistence and external calls

Planning data uses browser key `wattwise-mvp-v1`; simulated sensor connections use `wattwise-simulated-connections-v1`. There is no cross-device synchronization or server-side history. Saved planning records are capped at ten and do not yet include a complete reusable input snapshot. Startup validates each stored section independently, retains usable records, and explains recovery. The original active value is not overwritten on startup; a verified separate raw backup is required before later writes after recovery. Storage failures leave the calculator usable in memory. See [saved-state recovery](API_ERRORS.md#browser-recovery).

The web advisor calls loopback Ollama at `127.0.0.1:11434`. Only the explicit CLI `--gemma` option invokes the hosted provider. See [SECURITY.md](../SECURITY.md) before changing deployment or data-flow assumptions.

Language preference uses a separate `wattwise-locale-v1` key. English is the first-visit default; optional browser detection runs only for the saved `auto` choice. The reviewed locale manifest is shared by the frontend bundle and backend allowlist. Switching language rerenders presentation without persisting or changing household inputs or sensor state. The advisor receives a strictly validated locale in a trusted system instruction and reports it alongside the unchanged reply contract. See [translation architecture and contributions](TRANSLATING.md).

Currency preferences use `wattwise-display-currency-v2`, with USD as the initial display default and exchange-rate base, plus manual BRL/USD and EUR/USD parameters/timestamps. Valid v1 rates are inverted/cross-converted in memory; original storage is preserved. Both pages load the shared Settings dialog; planning also includes the BRL energy price and period. All parameters are validated before saving. Price/period changes invalidate the old plan and schedule recalculation, while currency-only changes make no API/model calls and leave canonical BRL amounts unchanged. Saved simulations and exports add a `display_currency` metadata snapshot including USD-base rates and BRL source provenance. Historical amounts use the current conversion while recorded snapshots remain unchanged. See [currency behavior](CURRENCIES.md).

## Verification limits

The offline suite covers calculations, example profiles, protected usage, candidate validation, sample selection, persistence behavior, and simulated monitoring. Model responses and browser APIs are mocked in those tests. Live-model checks and real-browser interaction are separate activities; passing CI does not establish model quality or measured savings. See the [evaluation guide](EVALUATION.md) for commands and review criteria.
