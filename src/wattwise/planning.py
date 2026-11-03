"""Validate a planning profile and calculate eligible single changes."""

import re

from .energy import number, reduction
from .errors import InputError


def input_number(value, label, field, *, positive=False):
    try:
        return number(value, label, positive=positive)
    except (ValueError, OverflowError):
        requirement = "maior que zero" if positive else "maior ou igual a zero"
        raise InputError(f"{label}: informe um número finito {requirement}.", field) from None


def analyze(config):
    if not isinstance(config, dict):
        raise InputError("Envie os dados da sua casa.", "config")
    site_type = config.get("siteType", "household")
    if site_type not in ("household", "industrial"):
        raise InputError("Escolha um perfil doméstico ou industrial.", "siteType")
    rate = input_number(config.get("rate"), "Preço por kWh", "rate")
    days = input_number(config.get("days"), "Dias", "days", positive=True)
    if rate > 1000:
        raise InputError("Informe um preço por kWh de até R$ 1.000.", "rate")
    if days > 366:
        raise InputError("Escolha um período de até 366 dias.", "days")
    devices = config.get("devices")
    if not isinstance(devices, list) or not 1 <= len(devices) <= 50:
        raise InputError("Cadastre entre 1 e 50 aparelhos ou modos de uso.", "devices")
    rows, ids = [], set()
    for index, device in enumerate(devices):
        field = f"devices[{index}]"
        if not isinstance(device, dict):
            raise InputError("Aparelho inválido.", field)
        identity, name = device.get("id"), device.get("name")
        if not isinstance(identity, str) or not re.fullmatch(r"[\w-]{1,80}", identity) or identity in ids:
            raise InputError("Cada aparelho precisa de um identificador único.", field + ".id")
        if not isinstance(name, str) or not name.strip() or len(name) > 100:
            raise InputError("Informe um nome de até 100 caracteres.", field + ".name")
        ids.add(identity)
        values = {}
        for key, label, limit in [("watts", "Potência", 100000), ("hours", "Horas por dia", 24),
                                  ("plannedWatts", "Potência proposta", 100000), ("plannedHours", "Horas propostas", 24)]:
            values[key] = input_number(device.get(key), label, field + "." + key)
            if values[key] > limit:
                raise InputError(f"{label}: informe um valor de até {limit:,}.".replace(",", "."), field + "." + key)
        watts, hours = values["watts"], values["hours"]
        planned_watts, planned_hours = values["plannedWatts"], values["plannedHours"]
        protected = device.get("protected", False)
        if not isinstance(protected, bool):
            raise InputError("O campo de uso essencial deve ser verdadeiro ou falso.", field + ".protected")
        if protected and (watts != planned_watts or hours != planned_hours):
            raise InputError(f"O uso de {name} está protegido. Mantenha os valores atuais na proposta.", field + ".protected")
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
        raise InputError("Descreva sua rotina em até 2.000 caracteres.", "context")
    return {"evidence": "manual_estimate", "site_type": site_type, "rate": rate, "days": days,
            "devices": rows, "opportunities": opportunities,
            "total": {**reduction(before, after, rate), "baseline_cost_brl": round(before * rate, 2)}}
