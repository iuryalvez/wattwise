# Issue #11 implementation review

Review date: 2026-11-03. Base: `6cd5daf` (issue #2 reliability work). Working branch: `feat/issue-11-i18n`. This record distinguishes implementation coverage review from independent language, visual, and model-quality reviews.

## Catalog coverage and terminology

| Locale | Coverage review | Independent native-speaker review | Real-browser review |
| --- | --- | --- | --- |
| English (`en`) | Implementation review completed | Not performed | Pending |
| Brazilian Portuguese (`pt-BR`) | Extracted source wording and implementation review completed | Not performed | Pending |
| Spanish (`es`) | Implementation review completed; consistent informal singular address and terminology | Not performed | Pending |

The implementation review checked both HTML pages, dynamic planning/monitoring messages, storage recovery, notifications, dialog labels, native constraint-validation messages, API-message keys/parameters, evidence descriptions, and application-owned experiment descriptions. It compared English and Spanish wording with the Portuguese source, especially the distinction between estimates, projections, simulated readings, actual measurements, and protected usage. Placeholder and locale-specific plural coverage are checked automatically. The exact reviewed catalog fingerprints and review limitations are in `web/locales/manifest.json`; only enabled locales with reviewed coverage are selectable. This is an initial implementation review, not a claim of community or independent native-speaker approval.

The English first-visit default, Portuguese second, Spanish third, and opt-in Automatic (browser) mode implement the user's explicit amendment to issue #11's original Portuguese-first fallback policy. Existing fictional household input names, routines, and notes remain Portuguese and are treated as source data, just like user-entered content. They are not UI catalog text and are not sent to a translation service.

## Automated verification

`python -B scripts/check.py` passed on Windows with Python 3.13.15 and Node.js 24.20.0. It includes 58 Python tests, all JavaScript syntax/test scripts, and both offline CLI modes. The new coverage includes:

- Valid JSON without duplicate keys, required-message coverage, unchanged placeholders, text-only catalogs, and locale-specific plural categories.
- Static HTML text-node indexes and initial English text, local bundle freshness, pinned runtime hash/license, explicit asset routes and real loopback HTTP/CSP behavior.
- English default, saved choice, opt-in regional browser detection, unsupported values, missing-key fallback, unavailable storage, and persistence independent of household data.
- Escaped interpolation in HTML, literal text rendering, native validation localization, structured dynamic errors, BRL/number/date formatting, and plural resolution.
- Planning drafts, saved simulations, selected comparison data, recovery originals, monitoring energy/connection state, pending pairing, events and notices surviving language changes.
- Backend locale rejection before inference, trusted language instructions, unchanged candidate/evidence contracts, unchanged numeric analysis across locales, and both recommendation/clarification request wiring.
- Optional evaluator control flow with mocked replies. Those mocks are not language-compliance evidence.

The sandbox blocked temporary-directory operations and loopback sockets; the successful full check was run outside that restriction. No installed runtime packages, translation service, cloud model, or real sensors were needed.

## Real-browser limitation

Computer Use selected the existing Chrome window and opened a separate tab. Its next observation was blocked with: “could not determine the current browser URL on Windows with enough confidence to enforce policy.” Browser automation was stopped. No WattWise visual interaction or keyboard/mobile walkthrough is claimed.

Responsive wrapping and an accessible native selector were implemented, but both-page verification at narrow/desktop widths, visible focus, keyboard navigation, modal focus return, native validation popups, long translated text and screen-reader announcements remain outstanding acceptance work under issue #11, coordinated with #7. Follow the walkthrough in `TRANSLATING.md` when browser access is available. The DOM doubles and HTML-binding checks are not substitutes for this verification.

## Local model language evaluation

The optional `scripts/evaluate_advisor_locales.py` was run against real **`gemma4:e2b`** with fictional recommendation, missing-routine clarification, and no-candidate cases in each locale. The retained report is `artifacts/evaluations/advisor-locales.json` (ignored). It identifies base commit `6cd5daf07273f87dd14381d2ed990c8ef956c0ce`, a dirty checkout, skill SHA-256 `45c1b358e4c3f399536988dd1f002d0be88507a1512f189a99ccde44254b2a1d`, and individual runtime source hashes. Those hashes were checked against the final code. The retained run took 237.8 seconds of case time, ranging from 11.05 to 49.02 seconds per case.

All **9/9** responses passed backend contract/candidate validation and expected-decision checks. A separate Codex qualitative reading of the actual prose found:

| Requested locale | Cases observed entirely in requested language | Result |
| --- | --- | --- |
| English | 3/3 | English, retaining the input appliance name where used |
| Brazilian Portuguese | 3/3 | Brazilian Portuguese in the inspected fields |
| Spanish | 2/3 | Clarification/no-candidate prose was Spanish; recommendation prose was predominantly Portuguese |

**General language compliance is not established.** In the Spanish recommendation, a sentence began with `Reducir` but continued in Portuguese, and the next step/question were Portuguese. This remains outstanding issue #11 acceptance work alongside #6. The response's `locale` records the requested language and is not a language detector.

Grounding and brevity concerns also remain: some fields repeat questions, introduce an unnecessary budget constraint, exceed one sentence/twelve words, repeat spelled-out quantities despite the no-numbers instruction, or ask about other usage instead of addressing the TV-only constraint and editing its proposal. Candidate IDs and numerical results remained validated, but that does not approve the prose. Case-by-case notes are recorded in the report; this review is not independent native-speaker certification or the full #6 evaluation.

Three real runs tested the initial language suffix, native-language instructions plus localized schema descriptions, and an English version of the general skill. The last variant regressed Spanish language adherence; it was not retained. The final code retains the best observed variant: native instructions before/after the existing skill plus localized schema descriptions. Earlier reports remain ignored as `advisor-locales-initial.json`, `advisor-locales-native-instructions.json`, and `advisor-locales-english-skill.json`. No mock was used to claim these language results. A rerun can vary and needs its own prose review.

Industrial dependencies, adversarial routines, extended conversations, and general model reliability still require the broader evaluation in issue #6. Installation/distribution verification belongs to #8; this change documents every localization resource that must be packaged. No Weblate project was connected; normal translation PRs remain supported.
