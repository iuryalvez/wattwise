"""Summarize high-consumption medium-voltage units from an ANEEL BDGD download.

Reads the UCMT layer (medium-voltage consumer units, Grupo A) of a BDGD
geodatabase or a CSV export of it, keeps active units whose annual energy is
at or above a threshold, groups them by CNAE division and by municipality, and
writes slide-ready outputs: CSV summaries, two SVG bar charts and a Markdown
summary. The BDGD is anonymous (no names or CNPJ); outputs stay aggregated.

Reading a .gdb needs pyogrio or fiona (pip install pyogrio), or the GDAL
command line tool ogr2ogr. A CSV export needs only the standard library:
    ogr2ogr -f CSV ucmt.csv BDGD.gdb UCMT_tab

Usage:
    python scripts/bdgd_grandes_consumidores.py BDGD.gdb
    python scripts/bdgd_grandes_consumidores.py ucmt.csv --min-mwh 1200 --out saida-bdgd
    python scripts/bdgd_grandes_consumidores.py BDGD.gdb --nomes-municipios   # fetch names from IBGE
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from collections import defaultdict
from html import escape
from pathlib import Path

LAYER_CANDIDATES = ("UCMT_tab", "UCMT")
ENERGY_RE = re.compile(r"^ENE(?:_[PF])?_(\d{2})$")
NEEDED_FIELDS = {"COD_ID", "CNAE", "MUN", "SIT_ATIV", "CLAS_SUB", "GRU_TEN"}
IBGE_URL ="https://servicodados.ibge.gov.br/api/v1/localidades/municipios"

# CNAE 2.0 divisions (first two digits) in Portuguese, for chart labels.
CNAE_DIVISIONS = {
    "01": "Agricultura e pecuária", "02": "Produção florestal", "03": "Pesca e aquicultura",
    "05": "Extração de carvão", "06": "Extração de petróleo e gás", "07": "Extração de minerais metálicos",
    "08": "Extração de minerais não metálicos", "09": "Apoio à extração de minerais",
    "10": "Alimentos", "11": "Bebidas", "12": "Fumo", "13": "Têxteis", "14": "Vestuário",
    "15": "Couro e calçados", "16": "Madeira", "17": "Papel e celulose", "18": "Impressão e gravações",
    "19": "Coque e derivados de petróleo", "20": "Produtos químicos", "21": "Farmacêuticos",
    "22": "Borracha e plástico", "23": "Minerais não metálicos (cimento, vidro, cerâmica)",
    "24": "Metalurgia", "25": "Produtos de metal", "26": "Eletrônicos e informática",
    "27": "Máquinas e materiais elétricos", "28": "Máquinas e equipamentos", "29": "Veículos automotores",
    "30": "Outros equipamentos de transporte", "31": "Móveis", "32": "Produtos diversos",
    "33": "Manutenção e instalação de máquinas", "35": "Eletricidade e gás", "36": "Captação e tratamento de água",
    "37": "Esgoto", "38": "Resíduos", "39": "Descontaminação", "41": "Construção de edifícios",
    "42": "Obras de infraestrutura", "43": "Serviços de construção", "45": "Comércio de veículos",
    "46": "Comércio atacadista", "47": "Comércio varejista (supermercados, lojas)", "49": "Transporte terrestre",
    "50": "Transporte aquaviário", "51": "Transporte aéreo", "52": "Armazenamento e logística",
    "53": "Correios", "55": "Hotéis", "56": "Restaurantes", "58": "Edição", "59": "Cinema, vídeo e TV",
    "60": "Rádio e televisão", "61": "Telecomunicações", "62": "Tecnologia da informação",
    "63": "Serviços de informação (data centers)", "64": "Serviços financeiros", "65": "Seguros",
    "66": "Auxiliares financeiros", "68": "Atividades imobiliárias (shoppings, condomínios)",
    "69": "Jurídico e contabilidade", "70": "Consultoria e sedes de empresas", "71": "Arquitetura e engenharia",
    "72": "Pesquisa e desenvolvimento", "73": "Publicidade", "74": "Outras atividades profissionais",
    "75": "Veterinária", "77": "Aluguéis", "78": "Seleção de pessoal", "79": "Agências de viagem",
    "80": "Vigilância e segurança", "81": "Serviços para edifícios", "82": "Serviços de escritório",
    "84": "Administração pública", "85": "Educação", "86": "Saúde (hospitais)", "87": "Assistência social com alojamento",
    "88": "Assistência social sem alojamento", "90": "Artes e espetáculos", "91": "Patrimônio cultural",
    "92": "Jogos de azar", "93": "Esporte e lazer", "94": "Organizações associativas", "95": "Reparação de equipamentos",
    "96": "Outros serviços pessoais", "97": "Serviços domésticos", "99": "Organismos internacionais",
}

PALETTE = {"bg": "#F6F7F3", "ink": "#203C33", "muted": "#63715C", "bar": "#174D40",
           "bar_soft": "#CBD9B4", "line": "#E7EBE4", "accent": "#D98D53"}


# ---------------------------------------------------------------- reading

def read_rows(path: Path, layer: str | None) -> list[dict]:
    if path.suffix.lower() == ".csv":
        return read_csv(path)
    if path.suffix.lower() == ".zip":
        raise SystemExit("Descompacte o .zip primeiro e passe a pasta .gdb.")
    return read_gdb(path, layer)


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig", errors="replace") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;")
        return [dict(row) for row in csv.DictReader(handle, dialect=dialect)]


def pick_layer(available: list[str], requested: str | None) -> str:
    if requested:
        if requested not in available:
            raise SystemExit(f"Camada {requested!r} não existe. Camadas: {', '.join(available)}")
        return requested
    by_upper = {name.upper(): name for name in available}
    for candidate in LAYER_CANDIDATES:
        if candidate.upper() in by_upper:
            return by_upper[candidate.upper()]
    raise SystemExit("Não achei a camada UCMT. Use --layer. Camadas: " + ", ".join(available))


def read_gdb(path: Path, layer: str | None) -> list[dict]:
    try:
        import pyogrio  # type: ignore
        import pyogrio.raw  # type: ignore
    except ImportError:
        pyogrio = None
    if pyogrio is not None:
        name = pick_layer([str(entry[0]) for entry in pyogrio.list_layers(str(path))], layer)
        fields = [str(item) for item in pyogrio.read_info(str(path), layer=name)["fields"]]
        wanted = [
            item for item in fields
            if item.upper() in NEEDED_FIELDS or ENERGY_RE.match(item.upper()) or item.upper().startswith("DEM")
        ]
        print(f"Lendo camada {name} com pyogrio ({len(wanted)} colunas)...", file=sys.stderr)
        # raw.read needs only numpy; read_dataframe would also require geopandas.
        meta, _, _, columns = pyogrio.raw.read(str(path), layer=name, columns=wanted, read_geometry=False)
        names = [str(item) for item in meta["fields"]]
        return [dict(zip(names, values)) for values in zip(*(column.tolist() for column in columns))]
    try:
        import fiona  # type: ignore
    except ImportError:
        fiona = None
    if fiona is not None:
        name = pick_layer(list(fiona.listlayers(str(path))), layer)
        print(f"Lendo camada {name} com fiona...", file=sys.stderr)
        with fiona.open(str(path), layer=name) as source:
            return [dict(feature["properties"]) for feature in source]
    if shutil.which("ogr2ogr") and shutil.which("ogrinfo"):
        listing = subprocess.run(["ogrinfo", "-ro", "-q", str(path)], capture_output=True, text=True, check=True)
        names = re.findall(r"^\s*\d+:\s*(\S+)", listing.stdout, flags=re.M)
        name = pick_layer(names, layer)
        print(f"Exportando camada {name} com ogr2ogr...", file=sys.stderr)
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "ucmt.csv"
            subprocess.run(["ogr2ogr", "-f", "CSV", str(target), str(path), name], check=True)
            return read_csv(target)
    raise SystemExit(
        "Para ler .gdb instale o pyogrio (pip install pyogrio) ou o GDAL (ogr2ogr). "
        "Outra opção: exporte a camada para CSV e passe o .csv."
    )


# ---------------------------------------------------------------- processing

def to_float(value) -> float:
    if value is None:
        return 0.0
    text = str(value).strip().replace(",", ".")
    try:
        number = float(text)
    except ValueError:
        return 0.0
    return number if number == number else 0.0  # drop NaN


def field(row: dict, name: str):
    for key, value in row.items():
        if key.upper() == name:
            return value
    return None


def annual_kwh(row: dict) -> float:
    return sum(to_float(value) for key, value in row.items() if ENERGY_RE.match(key.upper()))


def monthly_kwh(row: dict) -> list[float]:
    months = [0.0] * 12
    for key, value in row.items():
        match = ENERGY_RE.match(key.upper())
        if match and 1 <= int(match.group(1)) <= 12:
            months[int(match.group(1)) - 1] += to_float(value)
    return months


MIN_FILLED_MONTHS = 6


def estimated_annual_kwh(row: dict) -> tuple[float, int]:
    """Optional scenario treating zero months as gaps, not a correction of the data.

    Returns (estimate, number of zero months). A zero may be genuine seasonal
    consumption. Only an explicit caller opts into this assumption; with fewer
    than MIN_FILLED_MONTHS positive months the reported sum is kept.
    """
    months = monthly_kwh(row)
    filled = [value for value in months if value > 0]
    missing = sum(value == 0 for value in months)
    if missing == 0 or len(filled) < MIN_FILLED_MONTHS:
        return sum(months), missing
    return sum(months) + missing * sum(filled) / len(filled), missing


def cnae_division(value) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) < 2 or digits.startswith("00"):
        return "--"
    if len(digits) == 6:
        digits = "0" + digits  # 7-digit CNAE subclass stored as a number, e.g. 111301 -> 0111301
    return digits[:2]


def division_label(code: str) -> str:
    if code == "--":
        return "Sem CNAE informado"
    return f"{code} · {CNAE_DIVISIONS.get(code, 'Divisão ' + code)}"


def summarize(rows: list[dict], min_mwh: float, classes: list[str] | None,
              estimate_zero_months: bool = False) -> dict:
    if rows and not any(ENERGY_RE.match(key.upper()) for key in rows[0]):
        raise SystemExit("A camada não tem colunas ENE_01..ENE_12. Confira se é a UCMT da BDGD.")
    kept = []
    skipped_inactive = 0
    for row in rows:
        status = str(field(row, "SIT_ATIV") or "AT").strip().upper()
        if status and status != "AT":
            skipped_inactive += 1
            continue
        clas = str(field(row, "CLAS_SUB") or "").strip().upper()
        if classes and not any(clas.startswith(prefix) for prefix in classes):
            continue
        raw_mwh = annual_kwh(row) / 1000
        # Cohort membership always uses reported consumption, even in a scenario.
        if raw_mwh < min_mwh:
            continue
        estimated_mwh = estimated_annual_kwh(row)[0] / 1000 if estimate_zero_months else None
        kept.append({
            "cnae": cnae_division(field(row, "CNAE")),
            "mun": str(field(row, "MUN") or "").strip().split(".")[0] or "--",
            "clas": clas or "--",
            "mwh": raw_mwh,
            "raw_mwh": raw_mwh,
            "estimated_mwh": estimated_mwh,
            "zero_months": sum(value == 0 for value in monthly_kwh(row)),
        })
    by_cnae: dict[str, list[float]] = defaultdict(list)
    by_mun: dict[str, list[float]] = defaultdict(list)
    by_cnae_estimated: dict[str, list[float]] = defaultdict(list)
    by_mun_estimated: dict[str, list[float]] = defaultdict(list)
    for unit in kept:
        by_cnae[unit["cnae"]].append(unit["mwh"])
        by_mun[unit["mun"]].append(unit["mwh"])
        if estimate_zero_months:
            by_cnae_estimated[unit["cnae"]].append(unit["estimated_mwh"])
            by_mun_estimated[unit["mun"]].append(unit["estimated_mwh"])
    return {
        "total_rows": len(rows),
        "inactive": skipped_inactive,
        "kept": kept,
        "by_cnae": by_cnae,
        "by_mun": by_mun,
        "by_cnae_estimated": by_cnae_estimated,
        "by_mun_estimated": by_mun_estimated,
    }


def municipality_names(codes: set[str], fetch: bool, mapping_csv: Path | None) -> dict[str, str]:
    names: dict[str, str] = {}
    if mapping_csv:
        with mapping_csv.open(newline="", encoding="utf-8-sig") as handle:
            for row in csv.reader(handle):
                if len(row) >= 2:
                    names[row[0].strip()] = row[1].strip()
    if fetch and codes - names.keys():
        try:
            with urllib.request.urlopen(IBGE_URL, timeout=30) as response:
                body = response.read()
            if body[:2] == b"\x1f\x8b":  # the IBGE API sends gzip even when not asked
                body = gzip.decompress(body)
            for item in json.loads(body.decode("utf-8")):
                uf = (((item.get("microrregiao") or {}).get("mesorregiao") or {}).get("UF") or {}).get("sigla", "")
                names.setdefault(str(item["id"]), f"{item['nome']}/{uf}" if uf else item["nome"])
        except (OSError, ValueError) as error:
            print(f"Aviso: não consegui buscar nomes no IBGE ({error}); usando códigos.", file=sys.stderr)
    return names


# ---------------------------------------------------------------- output

def ranking(groups: dict[str, list[float]], label,
            estimated_groups: dict[str, list[float]] | None = None) -> list[dict]:
    items = [
        {"codigo": code, "nome": label(code), "unidades": len(values),
         "criterio_selecao": "consumo_informado",
         "mwh_ano_informado": round(sum(values), 1),
         "mwh_ano_estimado": round(sum(estimated_groups[code]), 1) if estimated_groups is not None else None}
        for code, values in groups.items()
    ]
    return sorted(items, key=lambda item: item["mwh_ano_informado"], reverse=True)


def write_csv(path: Path, items: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["codigo", "nome", "unidades", "criterio_selecao",
                                                   "mwh_ano_informado", "mwh_ano_estimado"])
        writer.writeheader()
        writer.writerows(items)


def fmt(number: float) -> str:
    return f"{number:,.0f}".replace(",", ".")


def default_bar_label(item: dict) -> str:
    return f'{fmt(item["mwh_ano_informado"])} MWh · {item["unidades"]} un.'


def bar_chart_svg(items: list[dict], title: str, subtitle: str, top: int, value_key: str = "mwh_ano_informado",
                  bar_label=default_bar_label,
                  footer: str = "Fonte: ANEEL, BDGD (UCMT). Consumo informado dos últimos 12 meses; não são economias medidas.",
                  note: str = "") -> str:
    items = items[:top]
    width, height = 1600, 900
    left, right, top_y = 560, 300, 200
    row_h = (height - top_y - 70) / max(len(items), 1)
    max_value = max((item[value_key] for item in items), default=1) or 1
    font = "Inter, 'Segoe UI', Arial, sans-serif"
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" font-family="{font}">',
        f'<rect width="{width}" height="{height}" fill="{PALETTE["bg"]}"/>',
        f'<text x="80" y="84" font-size="15" font-weight="700" letter-spacing="2" fill="{PALETTE["muted"]}">WATTWISE · DADOS ABERTOS ANEEL (BDGD)</text>',
        f'<text x="80" y="134" font-size="40" font-weight="550" letter-spacing="-1.2" fill="{PALETTE["ink"]}">{escape(title)}</text>',
        f'<text x="80" y="172" font-size="20" fill="{PALETTE["muted"]}">{escape(subtitle)}</text>',
    ]
    for index, item in enumerate(items):
        y = top_y + index * row_h
        bar_w = (width - left - right) * item[value_key] / max_value
        color = PALETTE["bar"] if index < 3 else PALETTE["bar_soft"]
        label = item["nome"] if len(item["nome"]) <= 44 else item["nome"][:43] + "…"
        mid = y + row_h / 2
        parts.append(f'<text x="{left - 20}" y="{mid + 7:.1f}" font-size="20" text-anchor="end" fill="{PALETTE["ink"]}">{escape(label)}</text>')
        parts.append(f'<rect x="{left}" y="{y + row_h * 0.18:.1f}" width="{max(bar_w, 2):.1f}" height="{row_h * 0.64:.1f}" rx="4" fill="{color}"/>')
        parts.append(
            f'<text x="{left + bar_w + 12:.1f}" y="{mid + 7:.1f}" font-size="18" fill="{PALETTE["muted"]}">'
            f'{escape(bar_label(item))}</text>'
        )
    if note:
        parts.append(f'<text x="80" y="{height - 52}" font-size="15" fill="{PALETTE["muted"]}">{escape(note)}</text>')
    parts.append(f'<text x="80" y="{height - 30}" font-size="15" fill="{PALETTE["muted"]}">{escape(footer)}</text>')
    parts.append("</svg>")
    return "\n".join(parts)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Resume grandes consumidores de média tensão (UCMT) da BDGD da ANEEL.")
    parser.add_argument("entrada", type=Path, help="pasta .gdb da BDGD ou CSV exportado da camada UCMT")
    parser.add_argument("--layer", help="nome da camada (padrão: UCMT_tab ou UCMT)")
    parser.add_argument("--min-mwh", type=float, default=600.0, help="consumo anual mínimo em MWh (padrão 600 = 50 MWh/mês)")
    parser.add_argument("--classes", help="prefixos de CLAS_SUB separados por vírgula, ex.: IN,CO,PP")
    parser.add_argument("--estimate-zero-months", action="store_true",
                        help="cenário opcional: estima meses zerados pela média dos positivos (mínimo 6); o filtro usa consumo informado")
    parser.add_argument("--top", type=int, default=12, help="itens por gráfico (padrão 12)")
    parser.add_argument("--distribuidora", default="", help="nome da distribuidora para os títulos")
    parser.add_argument("--nomes-municipios", action="store_true", help="busca nomes dos municípios na API do IBGE")
    parser.add_argument("--municipios-csv", type=Path, help="CSV codigo,nome para nomear municípios sem internet")
    parser.add_argument("--out", type=Path, default=Path("saida-bdgd"), help="pasta de saída")
    args = parser.parse_args(argv)

    if not args.entrada.exists():
        raise SystemExit(f"Arquivo não encontrado: {args.entrada}")
    classes = [item.strip().upper() for item in args.classes.split(",")] if args.classes else None
    rows = read_rows(args.entrada, args.layer)
    result = summarize(rows, args.min_mwh, classes, args.estimate_zero_months)
    if not result["kept"]:
        raise SystemExit(f"Nenhuma unidade ativa com {args.min_mwh:g} MWh/ano ou mais. Tente um --min-mwh menor.")

    names = municipality_names(set(result["by_mun"]), args.nomes_municipios, args.municipios_csv)
    cnae_rank = ranking(result["by_cnae"], division_label,
                        result["by_cnae_estimated"] if args.estimate_zero_months else None)
    mun_rank = ranking(result["by_mun"], lambda code: names.get(code, f"Município {code}"),
                       result["by_mun_estimated"] if args.estimate_zero_months else None)

    args.out.mkdir(parents=True, exist_ok=True)
    write_csv(args.out / "por_cnae.csv", cnae_rank)
    write_csv(args.out / "por_municipio.csv", mun_rank)
    raw_total = sum(unit["raw_mwh"] for unit in result["kept"])
    estimated_total = sum(unit["estimated_mwh"] for unit in result["kept"]) if args.estimate_zero_months else None
    zero_units = sum(1 for unit in result["kept"] if unit["zero_months"])
    count = len(result["kept"])
    where = f" · {args.distribuidora}" if args.distribuidora else ""
    subtitle = f"{count} unidades com consumo informado ≥ {fmt(args.min_mwh)} MWh/ano{where}"
    value_key = "mwh_ano_estimado" if args.estimate_zero_months else "mwh_ano_informado"
    basis = "Estimativa de consumo" if args.estimate_zero_months else "Consumo informado"
    note = f"Total informado: {fmt(raw_total)} MWh/ano. Zeros preservados; sem preenchimento."
    if args.estimate_zero_months:
        note = (f"Informado: {fmt(raw_total)} MWh/ano · Estimativa: {fmt(estimated_total)} MWh/ano. "
                "Hipótese: zeros como lacunas; média dos meses positivos (mín. 6).")

    def chart_label(item):
        suffix = " MWh est." if args.estimate_zero_months else " MWh"
        return f'{fmt(item[value_key])}{suffix} · {item["unidades"]} un.'

    chart_options = {"value_key": value_key, "bar_label": chart_label, "note": note}
    if args.estimate_zero_months:
        chart_options["footer"] = "Fonte: ANEEL, BDGD (UCMT). Cenário hipotético de consumo; não são dados corrigidos nem economias medidas."
    (args.out / "grafico_cnae.svg").write_text(
        bar_chart_svg(sorted(cnae_rank, key=lambda item: item[value_key], reverse=True),
                      f"{basis}, por setor", subtitle, args.top, **chart_options), encoding="utf-8")
    (args.out / "grafico_municipio.svg").write_text(
        bar_chart_svg(sorted(mun_rank, key=lambda item: item[value_key], reverse=True),
                      f"{basis}, por município", subtitle, args.top, **chart_options), encoding="utf-8")

    top3 = cnae_rank[:3]
    share = sum(item["mwh_ano_informado"] for item in top3) / raw_total * 100 if raw_total else 0
    estimate_lines = []
    if args.estimate_zero_months:
        estimate_lines = [
            f"- Estimativa opcional para as mesmas unidades: **{fmt(estimated_total)} MWh/ano**.",
            "- Hipótese do cenário: tratar meses zerados como lacunas e preenchê-los pela média dos meses positivos, "
            "com pelo menos 6 meses positivos; nas demais unidades, manter a soma informada. "
            "Isso não demonstra falha de reporte nem corrige os dados da ANEEL.",
        ]
    lines = [
        f"# Grandes consumidores de média tensão{where}",
        "",
        f"- Unidades lidas na UCMT: {result['total_rows']} (inativas ignoradas: {result['inactive']})",
        f"- Unidades ativas com consumo informado de {fmt(args.min_mwh)} MWh/ano ou mais: **{count}**",
        f"- Consumo informado somado dessas unidades: **{fmt(raw_total)} MWh/ano** (zeros preservados).",
        f"- Unidades com algum mês zerado na BDGD: {zero_units} de {count}. Zero não comprova ausência de dados.",
        *estimate_lines,
        f"- Os 3 setores no topo somam {share:.0f}% do consumo informado: " + "; ".join(item["nome"] for item in top3),
        "",
        "Frase para o slide: "
        f"\"{count} unidades de média tensão têm consumo informado de {fmt(raw_total)} MWh por ano; "
        f"uma redução hipotética de 10% equivaleria a {fmt(raw_total * 0.1)} MWh, sem comprovação de economia.\"",
        "",
        "Arquivos: por_cnae.csv, por_municipio.csv, grafico_cnae.svg, grafico_municipio.svg.",
        "Fonte: ANEEL, Base de Dados Geográfica da Distribuidora (BDGD), camada UCMT. Dados anônimos e agregados.",
    ]
    (args.out / "resumo.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"\nSaídas em {args.out.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
