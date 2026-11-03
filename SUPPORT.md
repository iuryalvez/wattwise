# Support

WattWise is a community-maintained development preview. Support happens through [GitHub issues](https://github.com/rafaelsilvabr/wattwise/issues); response times are not guaranteed. English and Portuguese are welcome.

## Before opening an issue

Check the [usage guide](docs/USAGE.md) and search existing issues. Start from the repository root with `python app.py`, then open http://127.0.0.1:8765/.

| Symptom | First check |
| --- | --- |
| The port is already in use | Stop the previous server or run `python app.py --port 8766` |
| A new example returns 404 after an update | Restart the Python server and refresh the page |
| The profile disappeared | Use the same browser, address, and port; local storage is specific to that origin |
| Gemma is unavailable | Start Ollama, install the configured local model, and refresh the connection status |
| The model takes too long | Try the calculator action; model performance depends on your hardware |
| A change is unavailable | Check whether the usage is protected and whether the proposal reduces consumption |
| Checks cannot find Node | Install Node.js 24 and restart your terminal; Node is only needed for development checks |

## Bugs and proposals

Use the [bug report](https://github.com/rafaelsilvabr/wattwise/issues/new?template=bug_report.yml) for something that does not work. Include reproduction steps, expected and actual behavior, your commit or release, Python version, operating system, and browser. Include Node or model details when relevant.

Use the [feature proposal](https://github.com/rafaelsilvabr/wattwise/issues/new?template=feature_request.yml) to describe a user problem and a small useful outcome. For other questions, open a regular issue with a clear title.

Use fictional examples or redact household routines, device identifiers, credentials, and personal information from screenshots, logs, and exported JSON. For security vulnerabilities, follow the [security policy](SECURITY.md).
