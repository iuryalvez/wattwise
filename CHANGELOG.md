# Changelog

User-facing changes and contributor infrastructure will be recorded here. There is no published stable release series yet; entries under Unreleased describe work awaiting a release.

## Unreleased

### Added

- Contribution guide, support guidance, code of conduct, and security-reporting policy.
- Architecture documentation, a scoped roadmap, and a maintainer guide.
- Bug-report and feature-proposal forms and a pull request template.
- A shared offline check command and GitHub Actions configuration for Ubuntu and Windows across Python 3.11, 3.13, and 3.14.
- Monthly Dependabot checks for pinned GitHub Actions and editor conventions.

### Changed

- Reorganized the README around product capabilities, a quick start, and contribution entry points.
- Preserved detailed setup, examples, and model configuration in `docs/USAGE.md`.

### Removed

- Unused PyYAML development requirement; the app and offline checks need no installed Python packages.

The existing application includes manual household energy planning, local Ollama advice, illustrative industrial inputs, saved simulations, JSON export, and a separate fictional monitoring demonstration. These are existing preview capabilities rather than new features in this change.
