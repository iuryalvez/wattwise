# Use case: a small packaging factory

This fictional industrial example demonstrates the same manual estimate and single-change comparison used by the household examples. A packaging factory operates **24 eight-hour production days in a 30-day calendar period**. Production, extraction, process cooling, working-area lighting, office work, and continuous network/security loads are protected.

All powers, operating conditions, approvals, and the **R$1.05/kWh** variable energy rate are synthetic assumptions. They are not readings, equipment specifications, a current industrial tariff, or verified production results. The example contains no real customer information.

## Representing the production calendar

The calculator accepts average hours per calendar day. For this example:

- Production: `24 days × 8 hours ÷ 30 calendar days = 6.4 h/day`.
- Compressor idle time outside each production shift: `24 × 16 ÷ 30 = 12.8 h/day`.
- Four hours per production day: `24 × 4 ÷ 30 = 3.2 h/day`.
- Network/security: `24 h/day` across all 30 calendar days.

These are accounting equivalents, not literal daily shift schedules. Six days have no production in this scenario. Continuous network/security consumption still covers those days. Changing the calendar or production-day count requires updating the equivalent hours; changing only the period scales the same assumed utilization.

## Loads and proposals

| Equipment or operating mode | Assumed electrical input | Equivalent h/calendar day | kWh / 30 days | Proposed change |
| --- | ---: | ---: | ---: | --- |
| Packaging line during production | 45,000 W | 6.4 | 8,640.00 | Protected |
| Service compressor during production | 22,000 W | 6.4 | 4,224.00 | Protected |
| Same compressor, idle outside shifts | 6,000 W | 12.8 | 2,304.00 | Apply the already approved shutdown schedule; zero idle hours |
| Process extraction | 7,000 W | 6.4 | 1,344.00 | Protected |
| Separate process-cooling circuit | 10,000 W | 6.4 | 1,920.00 | Protected |
| Production-area lighting | 3,000 W | 6.4 | 576.00 | Protected |
| Nonessential lighting in an empty warehouse | 3,000 W | 12.8 | 1,152.00 | Four rather than sixteen hours per production day; 3.2 equivalent h/day |
| Conveyors, idle outside production | 2,000 W | 3.2 | 192.00 | One rather than four idle hours per production day; 0.8 equivalent h/day |
| Office cooling | 5,000 W | 6.4 | 960.00 | Six rather than eight hours per production day if comfortable; 4.8 equivalent h/day |
| Office equipment | 800 W | 6.4 | 153.60 | Protected |
| Network and security systems | 250 W | 24 | 180.00 | Protected |
| **Total** | | | **21,645.60** | **R$22,727.88 modeled variable cost** |

The production line includes conveyors during active production; their separate idle entry represents a different time window. The compressor's active and idle modes are also separate windows. Process extraction and cooling are separate electrical loads, excluded from the packaging-line power. All watts represent assumed electrical input rather than nominal motor output. The scenario assumes process extraction and cooling are only required during production; it does not assess requirements for a real factory.

## One-change result

The largest candidate removes the **2,304 kWh** idle-compressor assumption while retaining its **4,224 kWh** production load and all other baseline uses. The hypothetical result is:

| Metric | Estimate |
| --- | ---: |
| Baseline variable energy cost | R$22,727.88 |
| Projected single-change reduction | R$2,419.20 |
| Reduction in modeled site variable cost | 10.64% |
| Site energy with this change | 19,341.60 kWh |
| Site variable energy cost with this change | R$20,308.68 |

This fixture explicitly assumes an existing shutdown schedule approved by the responsible technical operator and a compressor serving production alone, with no control or safety dependency. The application does not approve a procedure, instruct someone to operate equipment, or control machinery. Unknown operating dependencies should lead the advisor to ask for clarification. There are no pressure, installation, or production-speed changes in the proposals. Warehouse lighting excludes emergency and circulation lighting; those functions stay available.

Other candidates remain separate experiments. Their reductions are not added to the single-change comparison. The seven-day follow-up asks about production, quality, and safety, while the numerical result remains a 30-day projection. No industrial savings or production outcomes have been measured.

The constant variable rate does not reconstruct an industrial bill: demand charges, contracted demand, reactive-energy charges, time-of-use rates, taxes, and other bill items are not calculated. A lower modeled kWh cost does not establish an identical reduction in the complete bill. The monitoring page continues to show its independent household simulation, not this factory's telemetry.

## Load it

Start or restart `python scripts/run.py serve`, refresh the overview, choose **Indústria · embalagens** in **Escolha um exemplo fictício**, and select **Carregar exemplo**. The profile and advisor description switch to factory language. **Usar maior potencial, sem IA** shows the deterministic comparison. Local Gemma can select an eligible candidate or ask a question; tests use mocked industrial responses, and no live industrial model result is claimed. Undo restores the previous profile and wording, and reloading retains the selected industrial example.

Fixture: [industrial-packaging.json](../examples/industrial-packaging.json). Endpoint: `GET /api/sample/industrial`. It uses the web-app input schema; the workstation-only CLI retains its separate schedule schema.

Run `python -m unittest discover -s tests/python -t . -v` and `node tests/javascript/test_samples.js` to check calendar normalization, totals, essential-load protection, advisor context, loading, reload, and undo.
