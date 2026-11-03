# Security policy

## Supported code

WattWise is a development preview without a published stable release series. Security fixes currently target `main`; update to the latest reviewed code when a fix is available. Historical commits and demo artifacts do not receive separate patches.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/rafaelsilvabr/wattwise/security/advisories/new) when it is enabled. If the reporting form is unavailable, open an issue titled "Private security reporting requested" with no technical details and ask [@rafaelsilvabr](https://github.com/rafaelsilvabr) to arrange a private reporting channel. Do not post exploit instructions, credentials, personal data, or vulnerable household data in a public issue.

Include the affected commit, environment, reproduction steps, impact, and a minimal example using fictional data in the private report. Maintainers will investigate and coordinate a fix and disclosure with the reporter. There is no guaranteed response or fix deadline.

## Deployment and data boundaries

The application uses Python's standard-library HTTP server and binds to `127.0.0.1`. Its supported deployment is a local computer. Public hosting, reverse-proxy deployment, authentication, and multi-user isolation have not been implemented or reviewed.

The server checks Host and supplied Origin headers, maps a fixed set of static files, and bounds JSON request bodies. Preserve these protections when changing routes. Treat local browser data, household context, model output, and imported data as untrusted inputs.

The web advisor uses local Ollama. The separate CLI can send a calculated summary to a hosted API when the user explicitly selects `--gemma`. Exported JSON can contain household routines and follow-up answers. Avoid sharing it without reviewing its contents.

The [maintainer guide](docs/MAINTAINING.md#repository-settings) records the GitHub settings needed to support private reporting. A policy file alone does not enable that setting.
