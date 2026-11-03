"""Validate a planning profile and calculate eligible single changes."""

import re

from .energy import number, reduction


def analyze(config):
    if not isinstance(config, dict):
        raise ValueError("Envie os dados da sua casa.")
    site_type = config.get("siteType", "household")
    if site_type not in ("household", "industrial"):
        raise ValueError("Escolha um perfil doméstico ou industrial.")
    rate = number(config.get("rate"), "Preço por kWh")
    days = number(config.get("days"), "Dias", positive=True)
    if rate > 1000:
        raise ValueError("Informe um preço por kWh de até R$ 1.000.")
    if days > 366:
        raise ValueError("Escolha um período de até 366 dias.")
    devices = config.get("devices")
    if not isinstance(devices, list) or not 1 <= len(devices) <= 50:
        raise ValueError("Cadastre entre 1 e 50 aparelhos ou modos de uso.")
    rows, ids = [], set()
    for device in devices:
        if not isinstance(device, dict):
            raise ValueError("Aparelho inválido.")
        identity, name = device.get("id"), device.get("name")
        if not isinstance(identity, str) or not re.fullmatch(r"[\w-]{1,80}", identity) or identity in ids:
            raise ValueError("Cada aparelho precisa de um identificador único.")
        if not isinstance(name, str) or not name.strip() or len(name) > 100:
            raise ValueError("Informe um nome de até 100 caracteres.")
        ids.add(identity)
        watts, hours = number(device.get("watts"), "Potência"), number(device.get("hours"), "Horas por dia")
        planned_watts = number(device.get("plannedWatts"), "Potência proposta")
        planned_hours = number(device.get("plannedHours"), "Horas propostas")
        if max(watts, planned_watts) > 100000:
            raise ValueError("Informe uma potência de até 100.000 W por aparelho.")
        if max(hours, planned_hours) > 24:
            raise ValueError("As horas de uso devem estar entre 0 e 24 por dia.")
        protected = device.get("protected", False)
        if not isinstance(protected, bool):
            raise ValueError("O campo de uso essencial deve ser verdadeiro ou falso.")
        if protected and (watts != planned_watts or hours != planned_hours):
            raise ValueError(f"O uso de {name} está protegido. Mantenha os valores atuais na proposta.")
        before, after = watts * hours * days / 1000, planned_watts * planned_hours * days / 1000
        rows.append({"id": identity, "name": name.strip(), "watts": watts, "hours": hours,
                     "plannedWatts": planned_watts, "plannedHours": planned_hours, "protected": protected,
                     **reduction(before, after, rate), "baseline_cost_brl": round(before * rate, 2)})
    before, after = sum(r["baseline_kwh"] for r in rows), sum(r["proposed_kwh"] for r in rows)
    opportunities = []
    for row in sorted(rows, key=lambda r: r["energy_reduction_kwh"], reverse=True):
        if row["energy_reduction_kwh"] > 0 and not row["protected"]:
            opportunities.append({**row, "household_after_kwh": round(before - row["energy_reduction_kwh"], 6),
                                  "household_after_cost_brl": round((before - row["energy_reduction_kwh"]) * rate, 2)})
    context = config.get("context", "")
    if not isinstance(context, str) or len(context) > 2000:
        raise ValueError("Descreva sua rotina em até 2.000 caracteres.")
    return {"evidence": "manual_estimate", "site_type": site_type, "rate": rate, "days": days,
            "devices": rows, "opportunities": opportunities,
            "total": {**reduction(before, after, rate), "baseline_cost_brl": round(before * rate, 2)}}
