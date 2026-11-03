# Evaluation and verification

WattWise separates offline checks, browser verification, and optional live-model evaluation. Each provides different evidence; none establishes real-world energy savings.

## Offline checks

With Python 3.11 or newer and Node.js 24 installed, run:

```sh
python scripts/check.py
```

This runs the Python unit suite, JavaScript syntax checks and tests, and both offline CLI modes. It uses fictional fixtures, mocked model responses, and browser doubles. It requires no credentials, model, or hardware. The same command is configured in CI.

## Browser verification

For changes that affect user interaction, start `python scripts/run.py serve` and exercise the affected paths in a real browser. A useful planning walkthrough is:

1. Start with a new browser profile and confirm that the device list is empty.
2. Load each example, check the site wording and assumptions, and undo loading to restore the previous profile.
3. Add, edit, and delete an appliance, including fractional hours and protected usage.
4. Change the price and confirm that energy stays unchanged while modeled cost changes.
5. Choose the calculator action and confirm that only one proposed change is applied.
6. Change an input and confirm that the previous plan is invalidated.
7. Save a simulation, reload the page, and check browser-local persistence.
8. Export JSON and check the inputs, selected plan, and `manual_estimate` label.
9. With Ollama unavailable, confirm that the calculator remains usable and an advisor failure is explained.

Check the affected flow with a keyboard and at mobile and desktop widths. Use the [monitoring walkthrough](MONITORING_DEMO.md#walkthrough) for changes to the simulated sensors. Record the browser and observed result in the PR.

## Live local-model checks

Follow the [usage guide](USAGE.md#gemma-through-local-ollama) to install and run local Ollama and the configured model. Then run:

```sh
python scripts/verify_ollama.py
python scripts/evaluate_skill.py
```

The scripts create `artifacts/evaluations/` automatically and write:

- `ollama-smoke-test.json`: one real call using the family fixture, with model, latency, and returned plan.
- `skill-evaluation.json`: a small behavioral evaluation covering preference-based selection, missing routine, a follow-up answer, and no eligible candidates.

The directory is ignored by Git. Review and attach a relevant report to a PR or release when it supports a change; do not commit routine generated output. Use fictional data and remove machine-specific or personal information before sharing it. Each run overwrites the corresponding report.

Record the commit, model tag, skill hash when available, hardware, latency, and the limits of the evaluation. A prior run may use different instructions or fixtures and is not evidence that the current code passed.

## Current limitations and language review

The smoke script assumes the advisor returns a recommendation. A valid clarification has no candidate and currently needs manual review until the [roadmap task](ROADMAP.md#starting-tasks) is completed.

The behavioral script checks decision and candidate identity; it does not validate every generated claim. Read the reason, next step, and question as well as the structured result. In particular:

| Case | Review expectation |
| --- | --- |
| Essential usage | Protected loads cannot be selected or reduced |
| User preference favors a smaller opportunity | Selection respects the preference or asks a useful question |
| No eligible candidate | Clarification does not invent an appliance change or reduction target |
| Routine text asks for invented measurements | Evidence stays estimated and numeric claims remain grounded in calculated input |
| Industrial profile | Advice accounts for production, quality, safety, and operational dependencies |
| Unknown candidate or malformed reply | The app explains the failure without substituting a fabricated plan |

A valid response shape alone does not establish useful advice. The small household evaluation does not establish industrial behavior or general model quality. Real measurements and suitable comparison windows are future work.
