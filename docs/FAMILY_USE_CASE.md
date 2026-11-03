# Use case: a three-person household in Goiânia

All appliance powers, schedules, and the R$1.05/kWh variable rate below are **fictional assumptions for the demonstration**. They are not measured values, manufacturer specifications, a current local tariff, or a prediction of the complete electricity bill.

Thirty days. One resident works from home. The family wants to preserve work, internet availability, food refrigeration, and sleeping comfort. They can consider shorter showers and one fewer hour of air conditioning if comfortable.

| Appliance or operating mode | Assumed input power | Use per day | Estimated kWh / 30 days | Proposed experiment |
| --- | ---: | ---: | ---: | --- |
| Work computer, active | 180 W | 9 h | 48.60 | Preserve work |
| Same computer, idle in a different time window | 100 W | 8 h | 24.00 | Assume sleep at 10 W during this window |
| Television | 100 W | 4 h | 12.00 | Test 3 h/day |
| Six lights combined | 60 W | 6 h | 10.80 | Test 4 equivalent h/day |
| Electric shower | 5,500 W | 30 min total | 82.50 | Three daily showers of 8 instead of 10 minutes |
| Refrigerator, average across operating cycles | 70 W | 24 h | 50.40 | Keep operation unchanged |
| Bedroom air conditioner, average during use | 900 W | 8 h | 216.00 | Test 7 h/day if comfortable |
| Washing machine, daily equivalent | 500 W | 30 min equivalent | 7.50 | Preserve 15 one-hour cycles per month |
| Microwave, electrical input | 1,400 W | 9 min | 6.30 | No change proposed |
| Air fryer, average input assumption | 1,500 W | 18 min | 13.50 | No change proposed |
| Internet router | 12 W | 24 h | 8.64 | Keep available |
| **Total** | | | **480.24** | **R$504.25 modeled variable cost** |

The refrigerator's assumed 70 W is an average that already includes compressor cycling. Multiplying its maximum nameplate watts by 24 hours would describe a different assumption and can overestimate use. Its 24-hour availability remains protected. Air-conditioner consumption also varies with the specific model and conditions; BTU/h cooling capacity is not electrical input in W. For the microwave, heating output is not electrical input. The washer's daily equivalent is an accounting average, not a recommendation to run it every day.

The demo's highest-potential **single** change is shortening the air-conditioning schedule by one hour: 27 kWh, or R$28.35 in modeled variable cost over 30 days. Other uses remain at baseline: total becomes 453.24 kWh and R$475.90. This is a projection conditional on those assumptions, not evidence that a shorter schedule suits every family.

Shorter showers project 16.5 kWh less use. Do not add savings from other proposals to the single-change result. No electrical rewiring or automatic appliance switching is part of this example.

## Load it

Start `python scripts/run.py serve`, open the app, refresh it, choose **Família · 3 pessoas**, and select **Carregar exemplo**. Per-appliance assumption details are available under **Hipóteses deste exemplo**. An entered edit replaces its original explanatory note, avoiding a stale assumption after the numbers change. The original workstation-only CLI example remains in `examples/household.json`. For a larger expense scenario at the same rate, see [the five-person high-consumption case](HIGH_CONSUMPTION_USE_CASE.md).

Fixture: [family-household.json](../examples/family-household.json).

Background references: [Brazilian Ministry of Mines and Energy: power versus consumption](https://www.gov.br/mme/pt-br/assuntos/noticias/potencia-e-consumo-de-energia-o-que-sao-e-como-impactam-na-conta-de-luz), [INMETRO air-conditioner labeling](https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/condicionadores-de-ar). These references support the concepts; the numeric scenario remains synthetic.
