# Roadmap

WattWise aims to help people understand energy use, choose a feasible change, and follow up on its outcome. This roadmap describes intended work, not shipped features or delivery promises. Discuss substantial changes in an issue before implementation.

## Current scope

The implemented journey is household planning with manual estimates, an optional local advisor, single-change comparisons, browser-local simulation history, and JSON export. The industrial fixture is illustrative. The separate monitoring page uses fictional telemetry.

Automatic appliance control, public multi-user hosting, payments, and complete utility-bill reconstruction are outside the current contribution scope. New integrations need an explicit proposal for data handling, validation, and maintenance.

## Priorities

| Order | Outcome | Definition of done |
| --- | --- | --- |
| 1 | Dependable planning | Model/configuration failures return useful responses; malformed saved data cannot break the page; errors identify the relevant input |
| 2 | Easier first-use experience | A user can enter current usage before defining a proposal, understand the units, and confirm a practical alternative |
| 3 | Feasible advisor choices | Explicit constraints filter candidates before model selection; explanations are evaluated for unsupported claims; candidate limits are visible and justified |
| 4 | Reusable simulations | Versioned snapshots include the input profile, tariff, assumptions, and selected change; users can reopen or import a simulation |
| 5 | A complete experiment journey | Users can start an experiment, record adherence and experience, and keep, adjust, or reject the change; projections remain labeled |
| 6 | One measured-data path | An agreed CSV or device adapter validates units, timestamps, coverage, and comparable windows before showing a measured difference |

## Starting tasks

These are contribution ideas, not assigned issues. Check existing issues and open or link one before starting so work is coordinated. Maintainers can apply `good first issue` after confirming that scope and reproduction steps are complete.

| Task | Starting point | Acceptance criteria |
| --- | --- | --- |
| Handle invalid model configuration in status | `app.py`: `ollama_status`, `Handler.do_GET` | An invalid `OLLAMA_MODEL` yields a documented JSON response without an uncaught request failure; the calculator remains usable; add a regression check |
| Handle clarification in the live smoke script | `scripts/verify_ollama.py` | A valid clarification does not dereference a missing candidate; the report distinguishes clarification from recommendation and validates each contract |
| Preserve device assumptions when editing | `web/app.js`: device-form submission | Editing an example retains its note and unrelated metadata; changes to modeled fields still invalidate the plan; add a focused frontend regression check |
| Recover from malformed local history | `web/app.js`: storage load and `renderHistory` | Invalid record shapes cannot crash startup; valid records remain available and a recovery message explains discarded data |
| Finish industrial interface wording | `web/index.html`, `web/app.js` | Dialog and clarification text follow the active site type; household wording stays coherent; verify both profiles in a browser |
| Improve keyboard and mobile navigation | `web/*.html`, `web/*.css` | Navigation remains understandable at narrow widths and accessible without a pointer; describe the browser and keyboard checks in the PR |

The first two tasks are small backend/script entry points. Browser storage and accessibility tasks benefit from familiarity with the existing frontend test doubles and manual browser review.

## Evaluation work

Broaden the current small model evaluation to cover industrial constraints, no-candidate responses, unsupported numeric claims, adversarial routine text, malformed replies, and preferences that favor a lower-ranked candidate. Report both structural validity and qualitative usefulness. Keep recorded model tags and skill hashes attached to results.

## How priorities change

Use the feature-proposal template to explain who benefits, what changes for that user, and how success will be checked. The maintainer reviews proposals and records scope decisions in the issue or PR. Household and industrial requirements should be discussed explicitly rather than treating the industrial example as a completed industrial product.
