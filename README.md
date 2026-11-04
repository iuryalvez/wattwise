# WattWise

**Understand energy use. Choose one practical change. Track what happens next.**

WattWise is an open-source energy planning app that runs on your computer. Compare appliance usage, preserve essential activities, and explore one change at a time, with an optional local Gemma advisor.

[Get started](#get-started) · [Documentation](docs/README.md) · [Contribute](CONTRIBUTING.md) · [Roadmap](docs/ROADMAP.md) · [Report a bug](https://github.com/rafaelsilvabr/wattwise/issues/new?template=bug_report.yml)

**Status: development preview.** The interface starts in English, with Brazilian Portuguese and Spanish available in the language selector. Costs are calculated in BRL; display conversion to USD and EUR is available with your manual exchange rate. Household planning is the primary implemented journey; an industrial example explores an additional use case. Real-device monitoring and measured savings are planned work. See [display currencies](docs/CURRENCIES.md), the [translation guide](docs/TRANSLATING.md) and [review status](docs/I18N_REVIEW.md).

## What you can do today

- Enter appliances, current usage, proposed usage, and an energy price.
- Protect essential activities from proposed reductions.
- Compare the projected energy and variable cost of one selected change.
- Display BRL cost estimates in USD (default) or EUR using saved manual rates based on 1 USD, independently of language.
- Ask Gemma through local Ollama to choose among eligible changes or clarify your routine.
- Use a deterministic ranking when you prefer the calculator without AI.
- Save the last ten simulations in your browser and export a JSON report.
- Explore a separate monitoring demonstration with fictional sensors and readings.

All example data is fictional. Manual estimates and simulated readings are labeled separately. Savings are projections, and the entered variable rate does not reconstruct a complete electricity bill. Numerical results come from the calculator; the advisor selects and explains a change.

## Get started

Requires **Python 3.11 or newer**. Running the app requires no Python packages, Node.js, account, or API key.

```sh
git clone https://github.com/rafaelsilvabr/wattwise.git
cd wattwise
python scripts/run.py serve
```

Open **http://127.0.0.1:8765/**.

1. Select **Load example** to explore a fictional household or industrial profile, or add your own appliances.
2. Review watts, hours, proposed usage, and the energy price. Mark essential usage with **Preserve usage**.
3. Describe your constraints and choose **Use highest potential, without AI** for a calculator comparison.
4. Review the selected change, save the simulation, or export its assumptions and results.

Use `python scripts/run.py serve --port 8766` to choose another port. Browser storage belongs to the address and port you use. Restart the Python process after changing backend code.

### Optional local advisor

Install [Ollama](https://ollama.com/download) and run:

```sh
ollama run gemma4:e2b
```

Keep Ollama running, refresh its connection status in WattWise, and choose **Find a change with Gemma**. New advisor requests use the selected language; model language compliance still needs live evaluation. Model downloads and inference are optional; response time depends on your hardware. The app does not install or download models for you.

See the [usage guide](docs/USAGE.md) for model configuration, troubleshooting, all examples, and the optional hosted CLI integration.

## A look at the monitoring demo

![WattWise monitoring demo with fictional sensors and readings](docs/screenshots/monitor-page.jpg)

The `/monitor` page demonstrates the interaction with simulated telemetry. It does not connect to hardware or supply readings to the planning calculator. See the [monitoring guide](docs/MONITORING_DEMO.md).

## Optional public-data analysis

An optional script summarises public ANEEL BDGD data on medium-voltage customers for market research. It needs a separate data download and `pip install -r requirements/bdgd.txt` in a virtual environment; the app does not depend on it. Reported consumption, including zero months, determines the selected units. An explicit `--estimate-zero-months` scenario adds separately labeled estimates without changing that selection. See the [BDGD data guide](docs/BDGD_DATA.md).

## Contribute

Contributions can include bug fixes, accessibility improvements, documentation, translations, example reviews, and model evaluations. English and Portuguese are welcome in issues and pull requests.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup and the review process. The [roadmap](docs/ROADMAP.md) lists scoped starting tasks with acceptance criteria; propose a task in an issue before taking on a larger change.

With Python and **Node.js 24** installed, run all offline contributor checks:

```sh
python scripts/check.py
```

The same command is configured in [GitHub Actions](.github/workflows/ci.yml) for Ubuntu and Windows with Python 3.11, 3.13, and 3.14. Checks need no model, credentials, or real hardware. Live model evaluation is separate.

## Project guide

Application code lives in `src/wattwise/`, with advisor integrations under `src/wattwise/advisor/`. Browser assets stay in `web/`; tests are grouped under `tests/python/` and `tests/javascript/`. Developer commands live in `scripts/`, public-data tools in `scripts/research/`, and optional dependencies in `requirements/`. See the [folder layout](docs/ARCHITECTURE.md#folder-layout) for the full code map.

| Resource | What it covers |
| --- | --- |
| [Documentation](docs/README.md) | Setup, examples, and project references |
| [Architecture](docs/ARCHITECTURE.md) | Code map, request flow, and calculation boundaries |
| [Roadmap](docs/ROADMAP.md) | Priorities, contribution ideas, and acceptance criteria |
| [Changelog](CHANGELOG.md) | Unreleased changes and release history |
| [Contribution guide](CONTRIBUTING.md) | Development workflow, checks, and pull requests |
| [Support](SUPPORT.md) | Questions, troubleshooting, and bug reports |
| [Security policy](SECURITY.md) | Private reporting and the local-only deployment scope |
| [Code of conduct](CODE_OF_CONDUCT.md) | Community expectations and moderation |
| [Maintainer guide](docs/MAINTAINING.md) | Triage, GitHub setup, and release preparation |

## Data and privacy

Household inputs, follow-up answers, and saved simulations stay in this browser's local storage. The web app sends your inputs to the local Python server; using the advisor also sends routine text and candidate data to local Ollama. Clearing browser data removes saved profiles and history.

The separate CLI sends a calculated summary to a hosted provider only when you explicitly use `python scripts/run.py estimate --gemma`. Read the [usage guide](docs/USAGE.md#optional-hosted-gemma-integration-for-the-cli) before enabling it. Do not include personal information or secrets in public issues, screenshots, or exported reports.

## License

WattWise code is available under the [MIT License](LICENSE). Model weights, hosted services, and their tools have separate terms.
