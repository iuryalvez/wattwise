# Translating WattWise

The planning and monitoring pages use committed i18next JSON catalogs in `web/locales/`. English (`en`) is the initial language and fallback, Brazilian Portuguese (`pt-BR`) is second in the selector, and Spanish (`es`) is third. Contributor documentation, CLI output, BDGD research, and translating fictional household inputs are outside this milestone.

## Language behavior

The user's requested rollout makes **English the first-visit default**, including in browsers configured for Portuguese. This intentionally updates issue #11's original Portuguese default. A valid saved `wattwise-locale-v1` choice takes precedence. Selecting **Automatic (browser)** uses the first supported entry in `navigator.languages`, or `navigator.language` when needed, then English. Regional English and Spanish variants map to `en` and `es`; Portuguese variants map to `pt-BR`. Unsupported or malformed saved choices resolve to English. Missing messages fall back to English, then Portuguese. No detection or translation service is used.

The preference is separate from household and sensor storage. If storage is blocked, the selected language works in memory and the live status explains that it cannot survive navigation/reload. Switching languages updates document `lang`, title, description, accessible labels, visible UI, notifications, recovery details, simulation history presentation, and pending dialogs. It preserves draft form values, appliance names, notes, routines, follow-up answers, selected plans, saved simulations, sensor connections, and simulated energy. Example input text remains in its original Portuguese just like user-entered text.

`Intl.NumberFormat`, `Intl.DateTimeFormat`, and i18next's `Intl.PluralRules` integration format presentation. Currency remains **BRL**; no conversion takes place. Watts, hours, kWh, rates, duration, evidence IDs, and deterministic calculations remain unchanged. Date storage and exports keep ISO timestamps. There is no machine translation of household text. Existing model responses remain in their original language; a new advisor request uses the currently selected supported locale.

## Ordinary translation pull requests

No translation platform account or Node package installation is required.

1. Read both pages and the glossary below. Edit `web/locales/en.json`, `pt-BR.json`, or `es.json` as UTF-8 JSON. Keep existing keys stable, even when the wording changes. Several existing keys describe their original Portuguese text; these are identifiers, not instructions to copy Portuguese into other languages.
2. Preserve interpolation names such as `{{name}}`, `{{days}}`, and `{{energy}}`. Translate complete messages where possible. Do not add HTML, i18next nesting, or unescaped `{{- ...}}` interpolation. Preserve meaningful leading/trailing spaces on labels adjacent to icons or inline elements.
3. Keep all locale-specific plural forms: English uses `_one` and `_other`; Portuguese and Spanish also require `_many`. The selection uses the numeric `count` option. `days` is separately formatted for display. Test zero, one, two, and one million rather than assuming every language has two forms.
4. Run `python -B scripts/build_locales.py`. Commit the updated JSON and generated `web/locales.js`. Catalogs are the editable source; the bundle loads synchronously before the application, preventing initialization races or an extra catalog fetch. It is generated locally without third-party packages.
5. Run `python -B scripts/check.py`. CI verifies JSON validity and duplicate keys, required messages, placeholders, plural categories, static text bindings, bundle freshness, runtime integrity, locale selection, dynamic messages, formatting, and preservation of data.
6. In the PR, list the locale, changed keys, reviewer and review scope, checks, and browser observations. Review the translated text against the Portuguese reference and English catalog. Ask a fluent contributor to review idiomatic wording when available. Plain GitHub PRs remain supported permanently.

Review safety and meaning, not just spelling. A projected reduction must never become a measured or guaranteed saving. Do not change units, currency, numeric assumptions, protected-usage rules, candidate identifiers, or evidence values. The reviewer records the catalog hash and coverage status in `web/locales/manifest.json`; an enabled locale must have reviewed coverage for the exact catalog version. Initial implementation review is explicitly distinguished from independent native-speaker review and real-browser review.

After reviewing edits, calculate the catalog's SHA-256 over its UTF-8 text with LF newlines (not platform-specific file bytes). For example: `python -B -c "import hashlib,pathlib; print(hashlib.sha256(pathlib.Path('web/locales/es.json').read_text(encoding='utf-8').encode('utf-8')).hexdigest())"`. Record the hash, date, method, and whether independent/native/browser review actually occurred in the manifest, then regenerate the bundle. Do not mark an unperformed review as complete. CI fails if an enabled catalog has changed since its recorded coverage review; a maintainer can update this metadata during PR review.

## Adding messages and languages

For a new message, choose a stable descriptive key and add it to each enabled catalog. Use `WattWiseI18n.text(key, params)` for text sinks (`textContent`, `nodeValue`) and `WattWiseI18n.html(key, params)` inside application-owned HTML templates. The HTML helper escapes the entire message after interpolation; never insert catalog values as markup. i18next itself retains escaped interpolation by default. Never pass API objects directly as i18next options; the error formatter accepts only known error keys and scalar parameters.

Static HTML binds original text nodes with `data-i18n-text="0:key"`. Multiple bindings use `|`; indexes refer to `childNodes`, including element and whitespace nodes. This preserves existing elements, event handlers, labels, SVG text, and layout without replacing `innerHTML`. Update bindings when changing markup; the HTML binding test verifies indexes and initial English text. Attributes use `data-i18n-aria-label`, `data-i18n-placeholder`, `data-i18n-title`, or `data-i18n-content`. Keep the English initial markup usable while scripts load.

For an additional locale, copy the English JSON, complete translations and the locale's CLDR plural forms, and add a **disabled/pending** entry to `manifest.json` with a native name and trusted advisor language name. Register its explicit catalog route in `server.py` and add the selector option. Update locale normalization and tests for its language variants. Add its trusted advisor language instruction and JSON-schema field descriptions in `src/wattwise/i18n.py`; review them as runtime instructions. Generate the bundle and review all required keys before enabling it. Review `en`/`pt-BR` fallback and confirm that backend and frontend allowlists agree. Do not enable a partial catalog just because missing keys have a fallback. The manifest is shared by the bundle generator and backend locale validation.

## Glossary

| Meaning | pt-BR | en | es |
| --- | --- | --- | --- |
| Input-based result | estimativa manual | manual estimate | estimación manual |
| Software-generated readings | simulado | simulated | simulado |
| Future modeled result | projeção | projection | proyección |
| Protected essential activity | preservar uso | preserve usage | preservar uso |
| Difference in modeled variable cost | redução de custo variável | variable cost reduction | reducción del coste variable |

`manual_estimate` and `simulated` are evidence identifiers and must never be translated. BRL is the configured currency in every locale. Spanish currently uses consistent informal singular address (`tú`), with terms such as `aparato`, `coste`, and `ordenador`; a regional Spanish locale can be proposed separately.

## Runtime choice and update procedure

WattWise uses **i18next 25.6.0**, MIT licensed, from `web/vendor/i18next-25.6.0.min.js`; its license is adjacent. Its [fallback](https://www.i18next.com/principles/fallback), [plural](https://www.i18next.com/translation-function/plurals), interpolation, and plain browser APIs fit this framework-free application. Fluent offers richer message composition but would add a different message format and migration workflow; i18next JSON fits direct translation PRs here. No language-detection plugin is needed.

To reproduce the current vendor files, run `python -B scripts/update_i18next.py`. **Only this update command requires internet.** It downloads the pinned npm archive, verifies its SHA-512 integrity, reads only the exact browser build and license members, and prints SHA-256 hashes. It neither installs npm packages nor executes downloaded code. The pin and archive integrity are in the script. Normal application setup, translation work, CI, and use do not download anything.

To upgrade, review the official release notes, obtain the intended version's npm `dist.integrity` (`npm view i18next@VERSION dist.integrity`), update both constants in the script, rerun it, and update the script URLs in both HTML files and the explicit route in `server.py`. Review the license and update the runtime hash assertion in `test_i18n.py`. Remove only the superseded vendor file. Run the full checks and the two-page browser walkthrough before merging. Commit the vendor files; never replace them with a CDN URL. Keep the existing same-origin CSP.

Future distributions under issue #8 must include the **entire `web/` tree**, including JSON catalogs, `manifest.json`, `locales.js`, `i18n.js`, the vendored runtime and license, plus the advisor skill. Catalog routes use an explicit allowlist rather than arbitrary filesystem paths. Packaging is not implemented by this change.

## Optional Weblate

[Weblate supports i18next JSON](https://docs.weblate.org/en/latest/formats/i18next.html) and [Git integration](https://docs.weblate.org/en/latest/vcs.html), so it can later edit only `web/locales/*.json` and return translation changes through reviewed PRs. Exclude `manifest.json` and the generated bundle from translation components. Before connecting a hosted or self-hosted project, decide ownership, reviewer access, backups, licensing attribution, and how CI regeneration and review metadata are handled. No service is connected or required by this implementation. Do not upload household inputs, saved simulations, or advisor conversations; Weblate would receive only public UI catalog text. Ordinary PRs must remain available alongside any future service.

## Browser and local-model review

Coordinate the repeatable browser journey with issue #7. In each locale, use keyboard Tab/Shift+Tab and arrow keys in the native language selector; verify visible focus, updated accessible names, skip navigation, dialogs with Escape and focus return, save/reload and cross-page persistence. Repeat both pages at 360 px and desktop widths, including Spanish descriptions, long appliance names, pending pairing, paused monitoring, recovery warnings, and unavailable advisor. Check wrapping, horizontal overflow, readable floor-plan labels, and live announcements. Repeat with blocked browser storage. The browser doubles in CI do not establish these properties visually.

With local Ollama ready, run `python -B scripts/evaluate_advisor_locales.py` (or repeat `--locale en --locale pt-BR`). It calls only local Ollama with fictional data and writes an ignored report under `artifacts/evaluations/`. It records commit, dirty-checkout state, model, skill/runtime source hashes, per-case timing, returned prose, and structural/expected-decision results. Read `reason`, `next_step`, and `question` for actual language, idiomatic wording, household constraints, unsupported numbers, measured-savings claims, and useful clarifications. Record a language and grounding review for every case; successful JSON or a mocked response is **not** language compliance. Add industrial/adversarial/follow-up cases as part of the broader issue #6 evaluation.

Current verification status is recorded in [the implementation review](I18N_REVIEW.md). The real `gemma4:e2b` evaluation found a Spanish recommendation-language failure and prose-quality concerns. These limitations and the pending browser review must stay visible in release notes and PR descriptions.
