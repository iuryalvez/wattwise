# WattWise usage guide

Detailed setup, example assumptions, model configuration, and command-line usage. Run commands from the repository root. For a quick introduction, see the [project README](../README.md).

**Current MVP:** a Portuguese local web app with manual appliance/component entry, household context, estimated consumption, one-change comparisons, saved simulations, JSON export, and a Gemma 4 advisor through local Ollama. It also includes an illustrative industrial example with production constraints. The original command-line calculator remains available. Hardware measurements are a later milestone.

## Run

Requires Python 3.11+; no dependencies to install.

```powershell
python scripts/run.py serve
```

Open **http://127.0.0.1:8765/**. Add an appliance or select **Carregar exemplo**. The example values are fictional. Edit an appliance to specify current and proposed watts/hours; protect essential usage when it must remain unchanged. Set the variable rate and period, describe household constraints, and choose a plan. Only one selected change is included in the comparison; other usage stays at baseline.

The default example now covers a three-person family with eleven appliances or operating modes, including an electric shower, refrigerator, bedroom air conditioner, washing machine, microwave, air fryer, and router. Read [the family use case and its assumptions](FAMILY_USE_CASE.md). The refrigerator remains protected; its wattage represents a fictional average across compressor cycles.

For a larger expense scenario, choose **Alto consumo · 5 pessoas** in the example picker and select **Carregar exemplo**. Its 18 appliances or operating modes include three air conditioners, a dryer, electric cooking, and protected EV charging for work. At the same fictional R$1.05/kWh rate, it projects **2,011.20 kWh and R$2,111.76 over 30 days**, compared with the original example's 480.24 kWh and R$504.25. Its largest single proposed change projects **R$283.50 less variable cost (13.42%)**, leaving R$1,828.26: living-room cooling drops from eight to two hours, conditional on comfortable natural ventilation during the remaining hours. Read [the high-consumption use case](HIGH_CONSUMPTION_USE_CASE.md) for assumptions and the one-change comparison.

Choose **Indústria · embalagens** for a fictional factory with 11 equipment/mode entries and 24 eight-hour production days across a 30-day period. It projects **21,645.60 kWh and R$22,727.88**, with **R$2,419.20 (10.64%)** from one proposed change to compressor idle time under an assumed, already approved shutdown schedule. Production, extraction, cooling, and safety loads stay protected. Read [the industrial use case](INDUSTRIAL_USE_CASE.md) for calendar-day equivalents and limitations. This is an illustrative energy-cost comparison, not a complete industrial billing or equipment-control system.

Loading an example can be undone; all examples remain fictional manual estimates, separate from monitoring telemetry. Load an example again after a fixture update to replace its previously saved version.

The UI starts empty and stores household inputs and the last ten simulations in this browser's local storage. It supports editing, deletion with undo, and exported reports. There is no account, payment flow, remote database, or real meter adapter in this MVP. Use a different `--port` if necessary; saved browser data is specific to the origin, including the port.

After updating Python server code, stop the running app with **Ctrl+C**, run `python scripts/run.py serve` again, and refresh the browser. This server does not reload Python code automatically. Refreshing alone can show a new interface while the old server still lacks a newly added example endpoint.

### Smart-home monitoring mockup

Open **Casa conectada** in the sidebar, or visit **http://127.0.0.1:8765/monitor**, to explore a clickable five-room blueprint, nine mock sensors, simulated pairing/disconnection, three household scenarios, a changing power chart, and an energy counter for the active session. Monitoring has its own page and only loads its simulation scripts there; the overview keeps appliance planning and Gemma. Four demo sensors start connected; connection choices are saved separately from household estimates. Pause or resume the simulation at any time.

All these connections and readings are fictional. The monitoring mockup never accesses hardware, requests credentials, controls appliances, or supplies readings to the savings calculator or Gemma. Disconnected sensors show missing data rather than a zero-watt reading. See [the monitoring demo guide](MONITORING_DEMO.md).

Developer checks (Node is only needed for these checks):

```powershell
node tests/javascript/test_monitor.js
node tests/javascript/test_samples.js
node --check web/monitor.js
```

### Gemma through local Ollama

Install [Ollama](https://ollama.com/download), then download and run a local Gemma 4 model:

```powershell
ollama run gemma4:e2b
```

Keep Ollama running. In WattWise select the connection refresh button, then **Encontrar uma mudança com Gemma**. Start with E2B and benchmark latency on your machine. A supported larger local model can be selected before starting the app:

```powershell
$env:OLLAMA_MODEL = 'gemma4:e4b'
python scripts/run.py serve
```

The backend calls `http://127.0.0.1:11434/api/chat` with non-streaming structured output and `think: false` for concise, interactive replies. It uses a 4096-token context and bounded output. Model-generated choices are checked against eligible, precomputed changes. Protected uses cannot be changed. The interface renders the model's explanation as text; the numerical results come from the calculator. The local integration rejects cloud model tags.

The advisor loads its behavior from `skills/household-energy-coach/SKILL.md`. It can ask for clarification before recommending a change and considers up to four follow-up answers. Editing inputs resets those answers. Recommendations include a seven-day experiment; savings remain projections until supported by real measurements. The industrial profile supplies `site_type: industrial` to the advisor and uses follow-up language about production, quality, and safety. Legacy profiles default to household behavior.

No Ollama installation or model weights are included in this repository or automatically downloaded by the app. After the model is downloaded, local inference does not require a hosted API key. Performance depends on hardware; the first load can be slower. If Ollama is unavailable, **Usar maior potencial, sem IA** remains available and explicitly labels its numerical ranking as non-AI. It does not impersonate a model response.

To check the current model and instructions with Ollama running:

```powershell
python scripts/verify_ollama.py
```

The script writes a local report to `artifacts/evaluations/ollama-smoke-test.json`. Generated reports are ignored by Git. See the [evaluation guide](EVALUATION.md) for behavioral checks and how to interpret results.

See the official [Gemma 4 Ollama library](https://ollama.com/library/gemma4) and [chat API](https://docs.ollama.com/api/chat).

### CLI and tests

```powershell
python scripts/run.py estimate
python scripts/run.py estimate --mode simulated
python -m unittest discover -s tests/python -t . -v
```

Edit `examples/household.json` to enter an illustrative variable energy rate in BRL/kWh, component watts, and hours of use. Each appliance has a baseline and a proposed daily schedule. States are mutually exclusive; any unallocated hours have an explicit assumption of zero consumption. A state accepts either total `watts` or a `components` list, so a total and its components cannot be counted twice.

```text
energy (kWh) = power (W) × hours / 1000
estimated variable cost = energy × entered BRL/kWh rate
```

Nominal ratings, component estimates, variable loads, and assumed schedules do not establish actual consumption. In particular, a computer power supply's maximum rating is not its continuous power consumption.

The example contains entirely fictional power values and an illustrative rate of R$1/kWh. It is not an appliance specification or a current utility tariff. Component watts should represent electrical input at the wall; component DC ratings can omit power-supply losses.

## Evidence labels

| Label | Meaning |
| --- | --- |
| `manual_estimate` | Calculated from the entered watts and schedule; projected savings |
| `simulated` | Generated interval readings; demonstrates the calculation, not a real experiment |
| Measured — future | Readings from a supported energy monitor, with coverage and comparison checks |

Manual mode projects 30 days according to the input. Simulated mode generates two complete 24-hour windows from those same assumptions and compares their integrated energy. It is a software demonstration, not independent evidence of savings. Missing meter intervals are rejected instead of treated as zero consumption.

The rate is a simplified constant variable rate. Whole electricity bills also include taxes and other charges; a reduction in the modeled energy cost is not a prediction of an identical bill reduction. Time-of-use pricing and minimum billing charges are not modeled.

## Optional hosted Gemma integration for the CLI

Set `GEMINI_API_KEY` privately in your terminal environment, then run:

```powershell
python scripts/run.py estimate --gemma
```

This explicitly sends the calculated summary to Google's hosted Gemma API. It requests a Portuguese explanation, a useful follow-up question, and a practical next measurement. The numerical calculation is performed locally. No account names, addresses, or bills are included in this prototype's request. Never commit an API key.

The default is `gemma-4-26b-a4b-it`. Override with `GEMMA_MODEL` for another supported model. The non-AI mode is explicitly a calculator; it does not pretend to have invoked a model. Live API execution requires credentials and has not been validated in this checkout.

## Next product milestones

See the [roadmap](ROADMAP.md) for current priorities and contribution ideas, the [architecture guide](ARCHITECTURE.md) for implementation boundaries, and the [evaluation guide](EVALUATION.md) for verification. Hardware can eventually supply measured input through a device adapter.

## References

- [Gemma hosted API and supported models](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
- [Home Assistant energy inputs, power, and energy](https://www.home-assistant.io/docs/energy/)
- [ANEEL tariff information and excluded bill components](https://www.gov.br/aneel/pt-br/centrais-de-conteudos/relatorios-e-indicadores/tarifas-e-informacoes-economico-financeiras)
- [UN SDG 7, including target 7.3](https://sdgs.un.org/goals/goal7)

Code license: MIT. The model and hosted API have their own applicable terms.
