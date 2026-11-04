# Display currencies and settings

The planning page supports **USD**, **BRL** and **EUR** independently of interface language. **USD is the initial display default and the exchange-rate base**; a valid saved display preference takes precedence. New browsers start with editable, bundled ECB reference rates dated **3 November 2026**: **5.49342517 BRL per USD** and **0.89453439 EUR per USD**. The energy price is **always entered in BRL/kWh**. Backend calculations, API fields and stored numeric results remain BRL. CLI output remains BRL. Monitoring displays energy units without currency conversion.

## Settings

Open **Settings** (⚙) in the top bar. On the planning page, **Consumption settings** contains **Energy price (BRL)** and **Period** in days; these controls no longer appear in the main overview. The price accepts 0–1000 BRL/kWh in 0.01 increments and the period accepts whole days from 1 to 366. Saving changed planning parameters persists them and invalidates the prior plan for recalculation. Cancel, close and Escape discard drafts. Language changes preserve unsaved drafts. The monitoring menu contains exchange-rate settings only.

Under **Exchange rates**, configure:

- **BRL per 1 USD**: the number of Brazilian reais equivalent to one US dollar.
- **EUR per 1 USD**: the number of euros equivalent to one US dollar.

Rates must be finite numbers between `0.00000001` and `1000000`. BRL/USD is required when converting canonical BRL amounts to USD or EUR; EUR/USD is additionally required for EUR. No USD-rate parameter exists: USD is the reference, with an identity rate of one. An unused EUR rate can be blank; displaying original BRL amounts requires no conversion or rate. Missing required rates produce a visible configuration notice and monetary placeholders “—”; no rate is invented or fetched.

All planning and rate parameters are validated before any are applied. **Save settings** applies valid drafts, while Cancel or Escape changes nothing. A configured display currency applies directly from the header beside Language. Selecting an unconfigured currency opens Settings and focuses its rate field; the prior display currency stays selected until saving. Changing only rates/currency preserves the selected plan, drafts and original numerical report and makes no API/model/network request. Storage failures leave changes usable for the session and show a notice.

For fictional parameters `1 USD = 5 BRL` and `1 USD = 0.9 EUR`, BRL 100 displays as USD 20 or EUR 18:

```text
USD amount = BRL amount / BRL per USD
EUR amount = BRL amount / BRL per USD × EUR per USD
BRL amount = original BRL amount
```

These are arithmetic examples, not market quotes. Manual rates are user assumptions and are not automatically refreshed. Settings shows the rate direction and last-change time. Switching currencies or saving identical rates preserves timestamps. Dates and numbers follow the selected language; displayed currency amounts include ISO codes. Watts, hours, kWh, periods, tariffs, candidate/evidence identifiers and protected usage never change through currency or language selection.

### Researched reference for manual configuration

The [European Central Bank reference rates for 3 November 2026](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html), consulted on that date, quote `1 EUR = 1.1179 USD` and `1 EUR = 6.1411 BRL`. Converting these euro-based references to the app's USD base gives:

| Settings parameter | Reference value | Derivation |
| --- | ---: | --- |
| BRL per 1 USD | 5.49342517 | 6.1411 / 1.1179 |
| EUR per 1 USD | 0.89453439 | 1 / 1.1179 |

These dated reference values are the bundled initial defaults when no currency preference exists. They exclude transaction spreads and fees and are not live quotes. Settings identifies the reference date and allows manual edits. Existing preferences, including intentionally missing parameters, are never replaced by the bundled values. The application makes no exchange-rate request.

To update the bundled reference, check the official source, record the new quote date and both source EUR quotes, calculate the USD cross rates and round to eight decimals. Update `REFERENCE` in `web/currency.js`, this documentation and the reference-rate tests together. Preserve stored references and manual overrides. Do not replace the dated snapshot with a runtime network call.

## Persistence and exports

`wattwise-display-currency-v2` stores `{version:2,currency,rates:{BRL:{value,updatedAt},EUR:{value,updatedAt}}}` separately from household and language preferences. Reference entries additionally contain `source: "ecb_reference"`, an ISO `referenceDate` and `updatedAt: null`; an actual manual edit replaces these with a manual timestamp. Saving identical reference values preserves their provenance. Previously saved reference dates/rates survive later bundle updates. Corrupt preferences fall back to USD and retain usable rates where possible, without startup writes or silently replacing invalid data with defaults. If browser storage is unavailable, the bundled reference remains available in memory for the session.

Older `wattwise-display-currency-v1` settings expressed USD/EUR units per BRL. When no v2 entry exists, valid old parameters are converted in memory: `BRL/USD = 1 / old USD/BRL`, and `EUR/USD = old EUR/BRL / old USD/BRL`. The old entry is preserved unchanged; v2 is written only after an explicit settings/currency action. Rates that cannot be derived or validated require reconfiguration. The EUR cross-rate timestamp reflects the more recent source parameter. Existing simulations and their metadata are never rewritten by conversion or migration.

New saved simulations and JSON exports add a `display_currency` snapshot, for example:

```json
{
  "base_currency": "USD",
  "currency": "EUR",
  "units_per_usd": 0.9,
  "rate_source": "manual",
  "rate_updated_at": "2026-11-03T12:00:00.000Z",
  "source_currency": "BRL",
  "source_units_per_usd": 5,
  "source_rate_updated_at": "2026-11-03T12:00:00.000Z"
}
```

For display USD, `units_per_usd` is `1`, source is `identity` and its timestamp is `null`. Snapshots additionally report `source_rate_source`, `rate_reference_date`, `source_rate_reference_date` and `reference_source_url` to distinguish ECB references from manual edits. A reference has a date, not a fabricated manual-edit timestamp. Missing manual parameters have `null` rates/timestamps. Original `*_brl` numeric fields remain BRL. History uses the current display conversion while historical snapshots retain their original schema and rates.

## Verification

`tests/javascript/test_currency.js` covers USD default/base, USD-to-BRL/EUR rate direction, inverse/cross conversion, locale independence, precision, overflow, persistence, corrupt settings, unavailable storage, v1 migration, unchanged report/inputs/history, no conversion network calls and exported provenance. Settings cases cover validation before applying any drafts, native numeric bounds, cancel/close, missing-rate focus return, language changes, unchanged timestamps, planning persistence and invalidation. Recovery tests retain the backup-before-replacement guarantee when planning settings are saved. Shared checks validate catalog coverage, review fingerprints, local routes and generated assets.

Independent native-speaker translation review and the full application/model browser journey remain separate from this configuration flow; see [i18n review status](I18N_REVIEW.md).

The real browser configuration flow was verified with the fictional family profile: saving `5` BRL/USD and `0.9` EUR/USD displayed BRL 504.25 as USD 100.85 while energy stayed 480.24 kWh. The price and period were absent from the main overview and present in Settings. Escape discarded drafts of BRL 2/kWh and 7 days. Saving BRL 1.2/kWh and 14 days recalculated the estimate to 224.11 kWh and USD 53.79; reloading preserved these settings, and selecting EUR displayed EUR 48.41. Native validation rejected day 367. The Spanish dialog was checked at 360 × 800 with no horizontal overflow and keyboard access to Save in its scrollable content. The monitoring Settings menu loaded the same USD-based rate values and saved successfully.

After applying the bundled ECB references, a fresh browser origin displayed the same fictional family profile as USD 91.79 or EUR 82.11, with 480.24 kWh unchanged. Settings opened with Enter and showed both prefilled rates plus the 3 November 2026 reference disclosure. Saving unchanged values and reloading preserved the reference entries. The Spanish reference notice and settings dialog were checked at 360 × 800 without horizontal overflow. The offline suite was run against an export of the exact staged tree, excluding concurrent layout work.

Review also exercised native validation recovery: entering day 367 produced a custom validation error; Cancel restored day 30 and cleared that error. Reopening Settings and saving unchanged values then succeeded and returned focus to the Settings button. Automated coverage verifies that opening and canceling restore both field values and custom validity.
