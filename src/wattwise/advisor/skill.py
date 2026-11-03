"""Load the actual project skill and validate its observable decision contract."""

import hashlib
from ..paths import SKILL_PATH
from ..errors import InputError


def load_skill():
    try:
        raw = SKILL_PATH.read_text(encoding="utf-8")
    except OSError:
        raise ValueError("A skill de energia não está disponível no projeto.") from None
    parts = raw.split("---", 2)
    if len(parts) != 3 or parts[0].strip() or "name: household-energy-coach" not in parts[1] or not parts[2].strip():
        raise ValueError("A skill de energia tem um formato inválido.")
    return {"name": "household-energy-coach", "sha256": hashlib.sha256(raw.encode()).hexdigest(),
            "body": parts[2].strip()}


def answer_history(config):
    answers = config.get("advisorAnswers", [])
    if not isinstance(answers, list) or len(answers) > 4:
        raise InputError("Use até quatro respostas de acompanhamento; atualize a rotina para recomeçar.", "advisorAnswers")
    for index, item in enumerate(answers):
        field = f"advisorAnswers[{index}]"
        if not isinstance(item, dict):
            raise InputError("Resposta de acompanhamento inválida.", field)
        for key, limit in [("question", 180), ("answer", 300)]:
            if not isinstance(item.get(key), str) or not item[key].strip() or len(item[key]) > limit:
                label = "a pergunta" if key == "question" else "a resposta"
                raise InputError(f"Preencha {label} com até {limit} caracteres no acompanhamento.", field + "." + key)
    return answers


def reply_schema(candidates, clarification_only=False):
    return {"type": "object", "properties": {
        "decision": {"type": "string", "enum": ["clarify"] if clarification_only else ["recommend", "clarify"]},
        "candidate_id": {"type": "string", "enum": ["none"] if clarification_only else ["none", *[c["id"] for c in candidates]]},
        "reason": {"type": "string", "maxLength": 200},
        "next_step": {"type": "string", "maxLength": 200},
        "question": {"type": "string", "maxLength": 180}},
        "required": ["decision", "candidate_id", "reason", "next_step", "question"],
        "additionalProperties": False}


def validate_reply(answer, candidates):
    if not isinstance(answer, dict):
        raise ValueError("A resposta da skill está incompleta.")
    for key, limit in [("decision", 20), ("candidate_id", 80), ("reason", 200), ("next_step", 200), ("question", 180)]:
        if not isinstance(answer.get(key), str) or not answer[key].strip() or len(answer[key]) > limit:
            raise ValueError("A resposta da skill está incompleta.")
    if answer["decision"] == "clarify" and answer["candidate_id"] == "none":
        return None
    if answer["decision"] == "recommend":
        candidate = next((c for c in candidates if c["id"] == answer["candidate_id"]), None)
        if candidate is not None:
            return candidate
    raise ValueError("A skill retornou uma decisão fora das opções permitidas.")


def experiment_for(candidate, site_type="household"):
    if candidate is None:
        return None
    return {"duration_days": 7, "evidence": "manual_estimate",
            "appliance_id": candidate["id"],
            "baseline": {"watts": candidate["watts"], "hours_per_day": candidate["hours"]},
            "proposal": {"watts": candidate["plannedWatts"], "hours_per_day": candidate["plannedHours"]},
            "check": (
                "Acompanhe uma semana da operação pelo procedimento já aprovado, preservando produção, qualidade e segurança. Sem medidor, registre adesão; a economia continua sendo uma projeção."
                if site_type == "industrial" else
                "Observe se a rotina e o conforto foram preservados por uma semana. Sem medidor, registre adesão; a economia continua sendo uma projeção.")}
