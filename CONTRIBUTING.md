# Contributing to WattWise

Thank you for helping make energy planning more useful and understandable. Code, documentation, accessibility reviews, translations, and feedback on fictional examples are welcome. You do not need energy hardware or a local model to contribute.

English and Portuguese are welcome in issues and pull requests. Follow the [code of conduct](CODE_OF_CONDUCT.md).

## Find a starting point

Read the [README](README.md), [architecture](docs/ARCHITECTURE.md), and [roadmap](docs/ROADMAP.md). The roadmap includes small tasks with acceptance criteria. Check [existing issues](https://github.com/rafaelsilvabr/wattwise/issues) before starting, and comment on an issue to coordinate work. A comment expresses interest; a maintainer confirms ownership when needed.

Small fixes can go straight to a pull request. For a new dependency, framework change, integration, data-format change, or substantial feature, open a proposal first so contributors can agree on the behavior and scope.

## Set up your checkout

1. Fork the repository on GitHub and clone your fork.
2. Install Python 3.11 or newer and Node.js 24 for contributor checks.
3. Create a branch for your change:

```sh
git clone https://github.com/YOUR-USERNAME/wattwise.git
cd wattwise
git switch -c fix/describe-your-change
python scripts/run.py serve
```

Open http://127.0.0.1:8765/. The runtime and offline checks use Python's standard library and Node built-ins, so there is no required package installation or frontend build step. A virtual environment is optional. The launcher resolves `src/wattwise/` automatically. Make backend changes inside that package, frontend changes in `web/`, and add tests under `tests/python/` or `tests/javascript/`.

Ollama and Gemma are optional. Follow the [usage guide](docs/USAGE.md) if your work needs a live advisor. The server must be restarted after backend changes; it does not reload Python automatically.

## Run the checks

From your checkout, run:

```sh
python scripts/check.py
```

The script checks prerequisites, runs the Python unit suite, checks JavaScript syntax, runs the JavaScript tests, and exercises both offline CLI modes. It exits with a nonzero status when a check fails. It also works from another directory when invoked using its full path.

Individual checks are useful while developing:

```sh
python -B -m unittest discover -s tests/python -t . -v
node tests/javascript/test_monitor.js
node tests/javascript/test_samples.js
node --check web/app.js
node --check web/monitor.js
```

CI runs the combined command on Ubuntu and Windows with Python 3.11, 3.13, and 3.14 and Node.js 24. A configured matrix is not a guarantee about untested Python versions or browsers.

For interface changes, also exercise the affected flow in a real browser at desktop and mobile widths. Check keyboard navigation, field labels, empty and error states, persistence after reload, and whether changing inputs invalidates an old plan. The JavaScript tests use DOM and fetch doubles; they do not replace a browser check.

For advisor behavior changes, use the optional commands below with local Ollama running:

```sh
python scripts/verify_ollama.py
python scripts/evaluate_skill.py
```

These scripts create their output directory and overwrite JSON reports in `artifacts/evaluations/`, which Git ignores. Record the model tag, skill hash when available, timing, and any limitations in your PR; attach a reviewed report when it helps explain a change. A successful candidate choice alone does not establish that every generated sentence is supported; read the output. See the [evaluation guide](docs/EVALUATION.md) for scope and current limitations.

## Design principles

- Keep energy arithmetic deterministic and inspectable. The model selects from calculated candidates; it does not supply trusted numeric results.
- Preserve essential usage and apply only one selected change in comparisons.
- Keep manual estimates, simulated readings, and future measured data distinguishable in reports and the interface.
- Use fictional data in fixtures. Document units, assumptions, and the source of any externally sourced values.
- Keep model calls optional and retain a useful calculator path.
- Preserve the distinction between household planning and the illustrative industrial profile.

## Code and documentation conventions

Use the surrounding style and the repository's `.editorconfig`: four spaces for Python, two for JavaScript and YAML, UTF-8, and LF line endings. Favor small functions and explicit validation over new abstractions that do not yet have a use.

Keep UI text in Brazilian Portuguese. Keep contributor documentation in English for a common reference; translated guides are welcome when linked and maintained alongside the original. Render user and model text as text, or escape it before inserting HTML. Do not commit model weights, local credentials, personal consumption data, caches, or generated build files.

Add a focused regression test for behavior fixes when practical. Documentation and visual-only changes need appropriate review rather than tests that merely repeat their content. Update the usage guide when a command or user-visible behavior changes.

## Open a pull request

Target `main` and use the [pull request template](.github/PULL_REQUEST_TEMPLATE.md). Explain the problem, resulting behavior, and how you verified it. Link the issue if one exists; an issue is not required for a small fix. Include screenshots for visible changes and redact personal data.

Keep unrelated refactors in a separate PR. Draft PRs are welcome for early feedback. Maintainers review scope, correctness, clarity, evidence labels, and relevant checks before merging. If review is delayed, a brief follow-up on the same PR is welcome; there is no guaranteed response time.

Use a descriptive commit subject. Conventional Commit prefixes are optional. Contributed code is included under the project's [MIT License](LICENSE); include appropriate attribution and compatible licensing for any third-party material.

## Report a problem

Use [SUPPORT.md](SUPPORT.md) for questions and reproducible bug reports. Follow [SECURITY.md](SECURITY.md) for vulnerabilities and avoid disclosing exploit details in public issues.
