# Large-consumer data from ANEEL's BDGD

The optional script below turns ANEEL's public *Base de Dados Geográfica da Distribuidora* (BDGD) into aggregates about medium-voltage customers (Grupo A): industries, water utilities, hospitals, public buildings and large retailers. It supports market research; it is separate from the household app, which does not read its output. Energy volume alone does not establish addressable customers, willingness to pay, or achievable savings.

| Script | What it produces |
|---|---|
| `scripts/bdgd_grandes_consumidores.py` | Active medium-voltage units above an annual consumption threshold, grouped by CNAE division and municipality: `por_cnae.csv`, `por_municipio.csv`, `grafico_cnae.svg`, `grafico_municipio.svg`, `resumo.md` |

Charts use the WattWise palette at 1600×900. PowerPoint and Keynote import SVG directly; for Google Slides, open the SVG in a browser and take a screenshot.

## 1. Download the BDGD

The database is **not** stored in this repository (see [Why the data is not committed](#why-the-data-is-not-committed)).

1. Open ANEEL's open-data geoportal: <https://dadosabertos-aneel.opendata.arcgis.com> (also listed at <https://dadosabertos.aneel.gov.br>, search "BDGD").
2. Search for `BDGD` plus the distributor that serves the region, for example `Equatorial Goiás`, and pick the most recent base date.
3. Download the `.zip` (hundreds of MB) and unzip it outside the repository. You need the folder ending in `.gdb`, for example `Equatorial_GO_6072_2025-12-31_V11_20260821-0952.gdb`.

## 2. Install the reader

The app itself is standard library only. Reading a `.gdb` needs `pyogrio`, whose wheel bundles GDAL. Use a virtual environment; Debian and Ubuntu block `pip install` into the system Python.

```bash
python3 -m venv ~/.venvs/bdgd
~/.venvs/bdgd/bin/pip install -r requirements-bdgd.txt
```

On Windows: `py -m venv %USERPROFILE%\.venvs\bdgd` and then `%USERPROFILE%\.venvs\bdgd\Scripts\pip install -r requirements-bdgd.txt`.

Without pyogrio, the script also accepts a CSV export of the layer made with GDAL: `ogr2ogr -f CSV ucmt.csv BDGD.gdb UCMT_tab`.

## 3. Run

From the repository root:

```bash
~/.venvs/bdgd/bin/python scripts/bdgd_grandes_consumidores.py PATH/TO/BDGD.gdb \
  --distribuidora "Equatorial Goiás" --nomes-municipios --out ../saida-bdgd

```

Useful options:

| Option | Default | Meaning |
|---|---|---|
| `--min-mwh` | `600` | Minimum **reported** annual consumption in MWh (600 MWh/year = 50 MWh/month on average). Use `0` for all active medium-voltage units. The optional estimate never changes this selection. |
| `--classes` | all | `CLAS_SUB` prefixes, for example `IN` (industrial), `CO` (commercial), `PP` (public authority), `RU` (rural). |
| `--estimate-zero-months` | off | Optional scenario: treat zero months as gaps and fill them with the mean of positive months when at least 6 are positive. Keep reported consumption separately. |
| `--nomes-municipios` | off | Fetches municipality names from the IBGE API; without it, charts show IBGE codes. |
| `--municipios-csv` | none | Offline alternative: a `code,name` CSV. |
| `--layer` | `UCMT_tab` or `UCMT` | Layer name when a BDGD version uses another one. |

Tests use synthetic data and need no download: `python -m unittest discover -s tests -p "test_bdgd_grandes_consumidores.py" -v`.

## How to read the results

The BDGD is anonymous: no names, CPF or CNPJ. Every output is aggregated by sector or municipality.

By default, zero months are preserved. They can represent genuine zero consumption or seasonal operation; a zero alone does not prove a reporting gap. Selection, CSV ranking and the slide's hypothetical savings calculation use reported consumption. Optional scenario charts rank the estimates for that same selected cohort.

Only use `--estimate-zero-months` to explore an explicit assumption after checking the distributor's monthly coverage, seasonal activity, and available source documentation. A concentration of zeros may motivate investigation; it does not establish the cause. The scenario uses a unit's mean positive month to fill zero months only when at least 6 months are positive. Otherwise it retains the reported sum. This is an estimate, not a correction of ANEEL's data. A unit below the reported threshold is excluded even if its estimate exceeds the threshold.

CSV columns distinguish `mwh_ano_informado` from `mwh_ano_estimado`. The estimate is blank unless requested. `criterio_selecao=consumo_informado` identifies the threshold basis. Both totals cover the same selected units. Scenario charts label their bars as estimates and show the reported and estimated totals with the assumption in the caption. Default charts show reported consumption. The Markdown summary retains both totals when a scenario is requested.

Seasonality analysis, contracted-demand diagnostics and demand-charge calculations are not implemented by this script.

Money values depend on an assumed tariff. Present savings as scenarios (for example 5% and 10%), with the tariff stated as an estimate, never as a promised result.

### Historical committed estimates

The files under `docs/data/bdgd-equatorial-go-2025-12-31/` retain a **legacy estimated scenario**, not a run of the current default. The prior script selected units using imputed consumption: it reported 9,772 medium-voltage units, 61 inactive, and 1,615 selected units totaling an estimated 4,181,636 MWh/year. The reported sum for that same legacy cohort was 3,661,722 MWh/year. Of those units, 1,090 had at least one zero month; the prior reporting-gap interpretation is unverified. The top-three share of 49% is a share of the estimated consumption.

Those CSVs use `criterio_selecao=estimativa_legada` and put the preserved values only in `mwh_ano_estimado`. Their reported group totals are blank because they cannot be reconstructed from the committed aggregates. The summary retains the known overall reported total. Re-download the source BDGD and rerun the script to obtain current reported-threshold counts and group totals; do not reuse the legacy count as a count meeting the reported threshold. The current optional scenario also uses reported-threshold selection, so it does not reproduce that legacy cohort.

## Why the data is not committed

- **Size.** A distributor's BDGD is hundreds of MB to several GB, split across many files inside the `.gdb` folder. GitHub rejects files over 100 MB and every clone would carry the full history of each yearly update.
- **Source of truth.** ANEEL republishes the BDGD every year and sometimes corrects past versions. Linking to the official download keeps results traceable to a specific base date.
- **Scope.** Contributors working on the household app should not need a large download.

Small aggregated outputs (the CSVs, SVGs and Markdown summaries) are anonymous and only a few KB each, so they can be committed under `docs/data/` with the distributor and base date in the folder name, for example `docs/data/bdgd-equatorial-go-2025-12-31/`. Do not commit unit-level extracts. Credit the source as: *Fonte: ANEEL, Base de Dados Geográfica da Distribuidora (BDGD)*.
