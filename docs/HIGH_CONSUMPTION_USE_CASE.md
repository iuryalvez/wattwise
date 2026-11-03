# Use case: a five-person household with higher energy spending

This fictional household has two residents working from home, three air conditioners, electric cooking, a dryer, and an electric car needed for commuting. It wants to reduce discretionary use while preserving work, food refrigeration, children's sleeping comfort, meals, internet access, and necessary travel.

Every power, schedule, and the R$1.05/kWh variable rate is an **illustrative assumption**, not a measured reading, manufacturer specification, current utility tariff, or prediction of the complete electricity bill. The 30-day period and rate match the original family example; the larger expense comes from higher modeled consumption.

## Baseline and proposed experiments

| Appliance or operating mode | Assumed average input | Daily use or equivalent | kWh / 30 days | Proposal |
| --- | ---: | ---: | ---: | --- |
| Two work computers, active | 360 W combined | 9 h | 97.20 | Preserve work |
| Same computers, separate idle window | 140 W combined | 8 h | 33.60 | Sleep at 20 W combined during this window |
| Living-room television | 180 W | 6 h | 32.40 | Test 5 h/day |
| Household lighting | 180 W combined | 7 h | 37.80 | Test 5 equivalent hours, preserving safe circulation |
| Electric showers, total household use | 7,500 W | 60 min | 225.00 | Five 9-minute showers instead of five 12-minute showers |
| Refrigerator, mean across cycles | 90 W | 24 h | 64.80 | Protected |
| Freezer, mean across cycles | 55 W | 24 h | 39.60 | Protected |
| Main-bedroom air conditioner | 1,200 W during use | 10 h | 360.00 | Test 8 h/day if sleeping comfort allows |
| Children's bedroom air conditioner | 900 W during use | 10 h | 270.00 | Protected |
| Living-room air conditioner | 1,500 W during use | 8 h | 360.00 | Test 2 h/day at peak heat; assume comfortable natural ventilation during the other hours |
| Dryer | 2,500 W during cycles | 1 equivalent h | 75.00 | Air-dry half of nonurgent loads; 0.5 equivalent h/day remains |
| Electric-car charging at the wall | 3,600 W | 2 h | 216.00 | Protected commuting |
| Electric oven | 2,000 W during use | 1 h | 60.00 | Preserve meals |
| Electric cooktop, combined active zones | 1,800 W | 1.5 h | 81.00 | Preserve meals |
| Dishwasher | 1,500 W during cycles | 0.5 equivalent h | 22.50 | Preserve use |
| Washing machine | 600 W during cycles | 0.75 equivalent h | 13.50 | Preserve use |
| Microwave, electrical input | 1,400 W | 12 min | 8.40 | Preserve use |
| Router and home network | 20 W combined | 24 h | 14.40 | Protected |
| **Total** | | | **2,011.20** | **R$2,111.76 modeled variable cost** |

The two computer rows cover different daily windows: nine active hours and eight idle hours, rather than simultaneous duplicate consumption. Refrigeration averages already include compressor cycling. Air-conditioning figures are hypothetical electrical input while operating, rather than cooling capacity in BTU/h. Shower hours add all five residents' use; the power is not multiplied by five again.

The stronger living-room proposal assumes this fictional home is comfortable with natural ventilation outside two daily hours of peak heat. It reduces the cooling schedule from eight to two hours without changing its assumed power. The family must confirm that condition before trying it; the example does not establish that ventilation can replace cooling in every home. Bedroom cooling remains separate, and the children's bedroom stays protected.

The dryer assumption represents 30 monthly cycles of one hour; its proposal retains 15 cycles and air-dries the remaining nonurgent loads. It does not assume each drying cycle can simply be cut in half. Dishwasher use represents 15 one-hour cycles per month. Washer use represents 30 cycles of 45 minutes. Laundry entries account for washing and drying separately. EV charging represents energy taken at the wall, including input losses; battery energy is not added again. No installation changes or automatic device control are proposed.

## One change at a time

| Comparison | Original family | High-consumption household |
| --- | ---: | ---: |
| Baseline consumption / 30 days | 480.24 kWh | 2,011.20 kWh |
| Modeled variable cost at R$1.05/kWh | R$504.25 | R$2,111.76 |
| Largest single proposed change | Bedroom cooling: one fewer hour | Living-room cooling: six fewer hours |
| Projected energy reduction | 27.00 kWh | 270.00 kWh |
| Projected variable cost reduction | R$28.35 | R$283.50 |
| Reduction in household modeled variable cost | 5.62% | 13.42% |
| Household consumption with that one change | 453.24 kWh | 1,741.20 kWh |
| Household variable cost with that one change | R$475.90 | R$1,828.26 |

For the new case, the calculator ranks the living-room change first. Gemma may choose another eligible proposal or ask a question based on the household's constraints. Its behavior is checked with mocked responses in tests; no live model result for this new fixture is claimed. Essential loads remain unchanged and cannot be selected as reduction candidates. Savings from the other proposals are not added to the displayed single-change result.

The updated single-change projection is three times the earlier R$94.50 proposal. The baseline expense and rate are unchanged; the increase comes entirely from the larger, explicitly conditional schedule change.

The suggested experiment lasts seven days to observe practicality and comfort; the table remains a 30-day projection. Neither observing adherence nor increasing the fictional expense verifies real savings. Taxes, fixed charges, minimum billing, time-of-use pricing, and household-specific tariffs are not modeled.

## Load and verify

Start `python scripts/run.py serve`, refresh the overview, select **Alto consumo · 5 pessoas** under **Escolha um exemplo fictício**, and select **Carregar exemplo**. Use **Usar maior potencial, sem IA** to inspect the deterministic comparison, or consult local Gemma when available. **Desfazer** restores the prior profile. Reloading the browser retains the loaded case; selecting the original family and loading it remains available. The monitoring page keeps its independent simulated sensors.

After updating the fixture, restart the server and load this example again. Refreshing the browser alone keeps the older household values already saved in local storage.

Fixture: [high-consumption-household.json](../examples/high-consumption-household.json). The app serves it at `GET /api/sample/high-consumption`; the original `GET /api/sample` is unchanged.

Verification: `python -m unittest discover -s tests/python -t . -v` covers totals, protected loads, the one-change calculation, sample routes, and advisor validation. `node tests/javascript/test_samples.js` covers picker behavior, persistence, reload, undo, and failed-load recovery.
