import csv
from contextlib import redirect_stdout
from io import StringIO
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "research"))

import bdgd_grandes_consumidores as bdgd  # noqa: E402


def unit(cod, cnae, mun, monthly_kwh, sit="AT", clas="IN"):
    row = {"COD_ID": cod, "CNAE": cnae, "MUN": mun, "SIT_ATIV": sit, "CLAS_SUB": clas}
    for month in range(1, 13):
        row[f"ENE_{month:02d}"] = str(monthly_kwh)
    return row


class BdgdTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        rows = [
            unit("1", "2330301", "3550308", 100_000),          # cimento, SP: 1200 MWh
            unit("2", "2330301", "3550308", 60_000),           # cimento, SP: 720 MWh
            unit("3", "1011201", "3509502", 80_000),           # alimentos, Campinas: 960 MWh
            unit("4", "8411600", "3509502", 10_000, clas="PP1"),  # abaixo do limite
            unit("5", "2441501", "3550308", 200_000, sit="DS"),   # inativa
            unit("6", "111301", "3509502", 55_000, clas="RU"),    # CNAE sem zero à esquerda
        ]
        self.csv = self.dir / "ucmt.csv"
        with self.csv.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]), delimiter=";")
            writer.writeheader()
            writer.writerows(rows)

    def tearDown(self):
        self.tmp.cleanup()

    def test_filters_and_groups(self):
        result = bdgd.summarize(bdgd.read_csv(self.csv), 600, None)
        self.assertEqual(result["inactive"], 1)
        self.assertEqual(len(result["kept"]), 4)
        self.assertAlmostEqual(sum(result["by_cnae"]["23"]), 1920)
        self.assertIn("01", result["by_cnae"])

    def test_class_filter(self):
        result = bdgd.summarize(bdgd.read_csv(self.csv), 600, ["IN"])
        self.assertEqual({u["cnae"] for u in result["kept"]}, {"23", "10"})

    def test_explicit_estimate_uses_positive_mean_and_keeps_sparse_data(self):
        row = unit("1", "2330301", "3550308", 50_000)
        row["ENE_06"] = "0"
        row["ENE_05"] = "0"
        self.assertEqual(bdgd.estimated_annual_kwh(row), (600_000, 2))
        sparse = unit("2", "2330301", "3550308", 0)
        sparse["ENE_01"] = "1000"
        self.assertEqual(bdgd.estimated_annual_kwh(sparse), (1000, 11))

    def test_seasonal_zeros_are_preserved_and_do_not_cross_threshold(self):
        row = unit("seasonal", "1011201", "3550308", 50_000)
        for month in range(7, 13):
            row[f"ENE_{month:02d}"] = "0"
        self.assertEqual(bdgd.summarize([row], 600, None)["kept"], [])
        result = bdgd.summarize([row], 300, None)
        self.assertEqual(result["by_cnae"]["10"], [300])
        self.assertEqual(result["kept"][0]["zero_months"], 6)
        self.assertIsNone(result["kept"][0]["estimated_mwh"])

    def test_optional_estimate_never_changes_reported_cohort(self):
        below = unit("below", "1011201", "3550308", 50_000)
        eligible = unit("eligible", "2330301", "3550308", 100_000)
        for row in (below, eligible):
            for month in range(7, 13):
                row[f"ENE_{month:02d}"] = "0"
        reported = bdgd.summarize([below, eligible], 600, None)
        scenario = bdgd.summarize([below, eligible], 600, None, estimate_zero_months=True)
        self.assertEqual(scenario["by_cnae"], reported["by_cnae"])
        self.assertEqual(scenario["by_cnae"]["23"], [600])
        self.assertEqual(scenario["by_cnae_estimated"]["23"], [1200])
        self.assertEqual(len(scenario["kept"]), 1)

    def test_zero_month_outputs_separate_reported_and_estimated_consumption(self):
        row = unit("seasonal", "1011201", "3550308", 50_000)
        for month in range(7, 13):
            row[f"ENE_{month:02d}"] = "0"
        with self.csv.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(row))
            writer.writeheader()
            writer.writerow(row)
        for estimate in (False, True):
            with self.subTest(estimate=estimate):
                out = self.dir / ("scenario" if estimate else "reported")
                args = [str(self.csv), "--min-mwh", "300", "--out", str(out)]
                if estimate:
                    args.append("--estimate-zero-months")
                with redirect_stdout(StringIO()):
                    self.assertEqual(bdgd.main(args), 0)
                for filename in ("por_cnae.csv", "por_municipio.csv"):
                    with (out / filename).open(encoding="utf-8") as handle:
                        item = next(csv.DictReader(handle))
                    self.assertEqual(item["criterio_selecao"], "consumo_informado")
                    self.assertEqual(float(item["mwh_ano_informado"]), 300)
                    if estimate:
                        self.assertEqual(float(item["mwh_ano_estimado"]), 600)
                    else:
                        self.assertEqual(item["mwh_ano_estimado"], "")
                for filename in ("grafico_cnae.svg", "grafico_municipio.svg"):
                    svg = (out / filename).read_text(encoding="utf-8")
                    if estimate:
                        self.assertIn("Estimativa de consumo", svg)
                        self.assertIn("600 MWh est.", svg)
                        self.assertIn("Informado: 300 MWh/ano", svg)
                        self.assertIn("média dos meses positivos (mín. 6)", svg)
                    else:
                        self.assertIn("Consumo informado", svg)
                        self.assertIn("300 MWh", svg)
                        self.assertIn("Zeros preservados; sem preenchimento", svg)
                summary = (out / "resumo.md").read_text(encoding="utf-8")
                self.assertIn("Consumo informado somado dessas unidades: **300 MWh/ano**", summary)
                self.assertIn("redução hipotética de 10% equivaleria a 30 MWh", summary)
                self.assertEqual("Estimativa opcional" in summary, estimate)

    def test_optional_estimate_preserves_nonzero_negative_values(self):
        row = unit("adjustment", "1011201", "3550308", 50_000)
        row["ENE_01"] = "-1000"
        row["ENE_02"] = "0"
        self.assertEqual(bdgd.estimated_annual_kwh(row), (549_000, 1))

    def test_ponta_fora_ponta_columns_are_summed(self):
        row = {"ENE_P_01": "1000", "ENE_F_01": "4000", "ENE_02": "500"}
        self.assertEqual(bdgd.annual_kwh(row), 5500)

    def test_main_writes_outputs(self):
        out = self.dir / "saida"
        mapping = self.dir / "mun.csv"
        mapping.write_text("3550308,São Paulo/SP\n3509502,Campinas/SP\n", encoding="utf-8")
        self.assertEqual(bdgd.main([str(self.csv), "--out", str(out), "--municipios-csv", str(mapping)]), 0)
        for name in ("por_cnae.csv", "por_municipio.csv", "grafico_cnae.svg", "grafico_municipio.svg", "resumo.md"):
            self.assertTrue((out / name).exists(), name)
        svg = (out / "grafico_municipio.svg").read_text(encoding="utf-8")
        self.assertIn("São Paulo/SP", svg)
        with (out / "por_cnae.csv").open(encoding="utf-8") as handle:
            first = next(csv.DictReader(handle))
        self.assertTrue(first["nome"].startswith("23"))


if __name__ == "__main__":
    unittest.main()
