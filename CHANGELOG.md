# Changelog

User-facing changes and contributor infrastructure will be recorded here. There is no published stable release series yet; entries under Unreleased describe work awaiting a release.

## Unreleased

### Fixed

- Return consistent API diagnostic codes and field validation errors for expected configuration, Ollama transport, timeout, and malformed-response failures.
- Recover usable saved planning data without startup crashes or silent replacement of the original; explain exclusions, preserve a verified raw backup before later writes, and keep the calculator usable when browser storage fails.

### Added

- USD-default display selection with manual BRL-per-USD and EUR-per-USD rates in Settings, local persistence, migration of older rates, localized validation and export provenance. Planning Settings also contains the BRL energy price and period with explicit Save/Cancel. Tariffs and calculated/stored amounts remain BRL; no exchange-rate service is used.
- Local i18next catalogs for English, Brazilian Portuguese, and Spanish on both pages; an accessible persistent language selector, localized formatting and structured API messages, and validated local-advisor locale instructions. BRL and calculations remain unchanged.
- A translation contribution/review workflow, pinned runtime update procedure, and real-model locale evaluation. Browser verification remains pending; live Gemma evaluation found a Spanish recommendation-language failure and prose-quality concerns. See `docs/I18N_REVIEW.md`.
- Contribution guide, support guidance, code of conduct, and security-reporting policy.
- Architecture documentation, a scoped roadmap, and a maintainer guide.
- Bug-report and feature-proposal forms and a pull request template.
- A shared offline check command and GitHub Actions configuration for Ubuntu and Windows across Python 3.11, 3.13, and 3.14.
- Monthly Dependabot checks for pinned GitHub Actions and editor conventions.
- A consolidated evaluation guide for offline checks, browser verification, and live-model review.

### Changed

- English is the initial interface language and fallback; Portuguese is second in the selector. Browser-language detection is available through Automatic (browser).
- Moved backend code into `src/wattwise/`, with separate calculation, planning, server, CLI, and advisor modules. Start the app with `python scripts/run.py serve` and the calculator with `python scripts/run.py estimate`.
- Grouped tests by language, placed the optional BDGD tool under `scripts/research/`, and moved its dependency file to `requirements/bdgd.txt`.
- Reorganized the README around product capabilities, a quick start, and contribution entry points.
- Preserved detailed setup, examples, and model configuration in `docs/USAGE.md`.
- Live-model scripts now write generated reports to ignored `artifacts/evaluations/` instead of tracked documentation.

### Removed

- Unused PyYAML development requirement; the app and offline checks need no installed Python packages.
- Obsolete Hackday planning and assessment documents, stale generated model reports, and an unused advisor screenshot. Current architecture, priorities, and evaluation guidance remain in the maintained docs.

The existing application includes manual household energy planning, local Ollama advice, illustrative industrial inputs, saved simulations, JSON export, and a separate fictional monitoring demonstration. These are existing preview capabilities rather than new features in this change.
