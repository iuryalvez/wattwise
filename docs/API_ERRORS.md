# API errors and saved-state recovery

The loopback API preserves the Brazilian Portuguese `error` string for existing clients. Expected failures also include a stable `code` and, when relevant, a `field` path. Application exceptions now include an additive `message_key` and optional scalar `params` for local browser translation. Messages may improve over time; use codes/keys rather than matching message text. Envelope errors can be translated directly by code without a `message_key`. Unknown errors use a useful local generic message rather than displaying arbitrary upstream text.

```json
{
  "error": "Horas por dia: informe um valor de até 24.",
  "code": "invalid_input",
  "field": "devices[0].hours",
  "message_key": "errors.maximum",
  "params": {"max": 24}
}
```

Field paths use zero-based array indexes. Profile fields include `config`, `rate`, `days`, `siteType`, `devices`, and `context`; device fields use `devices[index].field`. Follow-up errors use `advisorAnswers`, `advisorAnswers[index]`, or its `.question`/`.answer` field. Both POST endpoints validate supplied follow-up answers before contacting Ollama. Configuration failures can identify `OLLAMA_MODEL`.

Optional `locale` is validated against the enabled locale manifest (`en`, `pt-BR`, `es`); absent means English, and unsupported/non-string values return `400 invalid_input`, field `locale`, key `errors.locale`. The browser sends the resolved locale with advisor requests, separately from stored household data. Advisor responses add `locale` without changing the decision schema, evidence IDs or candidate validation. This records the **requested** language, not detected or guaranteed model-language compliance; read the generated text and evaluation report. The browser formats parameter numbers and field labels locally, accepts only known `errors.*` catalog keys, and passes only the permitted scalar interpolation parameters to i18next. Existing API clients can continue using `error`, `code`, and `field`.

| Code | POST HTTP status | Meaning / recovery |
| --- | --- | --- |
| `invalid_input` | 400 | Correct the identified profile or follow-up field. |
| `invalid_json` | 400 | Send valid UTF-8 JSON. |
| `invalid_request` | 400 | Correct the `Content-Length` header. |
| `invalid_origin` | 403 | Use the matching loopback Host and Origin. |
| `not_found` | 404 | Unknown route. |
| `payload_too_large` | 413 | Send a nonempty body of at most 65,536 bytes. |
| `unsupported_media_type` | 415 | Send `application/json`. |
| `invalid_model_config` | 503 | Set a supported local Gemma 4 tag and restart WattWise. |
| `model_unavailable` | 503 | Configured model is absent, or Ollama returns HTTP 404; check the model and Ollama installation. |
| `ollama_unavailable` | 503 | Connection refused, reset, interrupted, or another transport failure; start/reconnect Ollama and retry. |
| `ollama_timeout` | 504 | Ollama exceeded the request timeout (2 seconds for status, 90 for advice); retry or use the calculator. |
| `ollama_http_error` | 502 | Another HTTP failure from Ollama; retry/check Ollama. |
| `invalid_ollama_response` | 502 | Invalid JSON/encoding, unexpected response shape, malformed model content, or a decision outside the calculated candidates. Retry. |
| `ollama_response_truncated` | 502 | Model reached its output limit; shorten the routine or retry. |
| `advisor_skill_unavailable` | 503 | Advisor instruction file is missing or invalid; restore it. |

`GET /api/status` retains HTTP **200** for a completed diagnostic check. A ready result includes `available: true`, `running: true`, and `model`. An unsuccessful check includes `available: false`, `model`, `error`, `code`, and optional `field`. `running` is true when Ollama responded (including an invalid response or absent model), and false when the connection/configuration could not be checked successfully. It is a diagnostic hint, not a separate health guarantee. The table's advisor HTTP status does not apply to this GET endpoint.

Advisor failures do not change calculator arithmetic or inputs. `/api/analyze` and the browser's **Usar maior potencial, sem IA** action do not need Ollama, a valid model tag, or an advisor instruction file. Results remain manual estimates; protected usage and single-change comparisons retain their existing rules.

## Browser recovery

On startup, the planning page validates the profile, devices, simulation history, and follow-up answers before rendering. Usable records and metadata remain available. Invalid fields/records and excess entries are listed in a persistent recovery notice. Invalid rate/period fields use visible defaults requiring review. A protected device with a conflicting proposal retains its current usage. Invalid records are excluded from the working copy; their original values are retained in the raw source.

Startup does **not** rewrite `wattwise-mvp-v1`, including when removing the obsolete `voltage` field from the working profile. When recovery was needed, **Baixar dados originais** downloads the exact original text (even invalid JSON). Before the first subsequent save, WattWise stores and reads back that original under a new `wattwise-mvp-v1-recovery-<timestamp>` key. Only after confirming that backup does it replace the active key. Existing backups are not overwritten. The notice displays the backup key; backups remain browser-local and can also be inspected through browser storage tools. They are not restorable snapshots or supported imports; that workflow belongs to issue #4.

If reading or writing storage fails, the page explains that data is only available in the current session. If creating/verifying the original backup fails, the active key stays untouched. Editing, analysis, single-change comparison, saving history in memory, and report export remain available. Export a selected simulation or download the original before closing the page. Browser data clearing can remove both active data and backups; there is no server copy or synchronization.

## Regression verification

Run `python -B scripts/check.py` (Python 3.11+, Node.js 24). `tests/python/test_reliability.py` covers both endpoint handlers with mocked Ollama failures, client validation, and malformed responses. `tests/javascript/test_recovery.js` covers partial recovery, original preservation, backup failures, blocked storage, and the calculator fallback using the shared browser double. These are offline tests; they do not establish live model quality or replace a real-browser check.
