# Large-consumer data from ANEEL's BDGD

Two scripts turn ANEEL's public *Base de Dados Geográfica da Distribuidora* (BDGD) into slide-ready numbers about medium-voltage customers (Grupo A): industries, water utilities, hospitals, public buildings and large retailers. They support the market-size part of the pitch; they are not part of the household app and the app does not read their output.

| Script | What it produces |
|---|---|
| `scripts/bdgd_grandes_consumidores.py` | Active medium-voltage units above an annual consumption threshold, grouped by CNAE division and municipality: `por_cnae.csv`, `por_municipio.csv`, `grafico_cnae.svg`, `grafico_municipio.svg`, `resumo.md` |
| `scripts/bdgd_oportunidades.py` | Monthly seasonality by sector (`sazonalidade.csv`, `grafico_sazonalidade.svg`) and a contracted-vs-measured demand check with a data diagnostic (`demanda_por_cnae.csv`, `grafico_demanda.svg`, `oportunidades.md`) |

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

Without pyogrio, the scripts also accept a CSV export of the layer made with GDAL: `ogr2ogr -f CSV ucmt.csv BDGD.gdb UCMT_tab`.

## 3. Run

From the repository root:

```bash
~/.venvs/bdgd/bin/python scripts/bdgd_grandes_consumidores.py PATH/TO/BDGD.gdb \
  --distribuidora "Equatorial Goiás" --nomes-municipios --out ../saida-bdgd

```

Useful options:

| Option | Default | Meaning |
|---|---|---|
| `--min-mwh` | `600` | Minimum annual consumption in MWh (600 MWh/year = 50 MWh/month on average, roughly a R$35k monthly bill at R$0.70/kWh). Use `0` for all medium-voltage units. |
| `--classes` | all | `CLAS_SUB` prefixes, for example `IN` (industrial), `CO` (commercial), `PP` (public authority), `RU` (rural). Only in `bdgd_grandes_consumidores.py`. |
| `--nomes-municipios` | off | Fetches municipality names from the IBGE API; without it, charts show IBGE codes. |
| `--municipios-csv` | none | Offline alternative: a `code,name` CSV. |
| `--tarifa-demanda` | `40` | R$/kW·month used to value demand findings; a placeholder, check the distributor's tariff. |
| `--layer` | `UCMT_tab` or `UCMT` | Layer name when a BDGD version uses another one. |

Tests use synthetic data and need no download: `python -m unittest tests.test_bdgd_grandes_consumidores tests.test_bdgd_oportunidades -v`.

## How to read the results

The BDGD is anonymous: no names, CPF or CNPJ. Every output is aggregated by sector or municipality.

Known data-quality issues, found on the Equatorial Goiás base dated 2025-12-31:

- **Empty months.** 1,090 of the 1,615 large units had at least one month at zero, concentrated in June and May. This is a reporting gap, not a shutdown. The scripts fill an empty month with the mean of that unit's reported months when at least 6 are present, and `resumo.md` prints the unadjusted total next to the adjusted one. Seasonality uses only units with all 12 months reported.
- **Contracted demand.** In that base, `DEM_CONT` equalled the 12-month peak of `DEM_01..DEM_12` for nearly every unit, so oversized contracts cannot be detected from public data. `oportunidades.md` includes a diagnostic section; when it shows this pattern, do not use the demand figures. Measured demand is on the customer's own energy bill.

Money values depend on an assumed tariff. Present savings as scenarios (for example 5% and 10%), with the tariff stated as an estimate, never as a promised result.

Reference run (Equatorial Goiás, base date 2025-12-31, `--min-mwh 600`): 9,772 medium-voltage units, 61 inactive; 1,615 active units at or above 600 MWh/year, consuming an estimated 4,181,636 MWh/year (3,661,722 MWh before filling empty months). Food, water/sanitation and agriculture account for 49% of that consumption.

## Why the data is not committed

- **Size.** A distributor's BDGD is hundreds of MB to several GB, split across many files inside the `.gdb` folder. GitHub rejects files over 100 MB and every clone would carry the full history of each yearly update.
- **Source of truth.** ANEEL republishes the BDGD every year and sometimes corrects past versions. Linking to the official download keeps results traceable to a specific base date.
- **Scope.** Contributors working on the household app should not need a large download.

Small aggregated outputs (the CSVs, SVGs and Markdown summaries) are anonymous and only a few KB each, so they can be committed under `docs/data/` with the distributor and base date in the folder name, for example `docs/data/bdgd-equatorial-go-2025-12-31/`. Do not commit unit-level extracts. Credit the source as: *Fonte: ANEEL, Base de Dados Geográfica da Distribuidora (BDGD)*.
