"""Local Ollama status and candidate-constrained advisor requests."""

from datetime import datetime, timezone
import json
import os
import re
from urllib import error, request

from ..planning import analyze
from .skill import answer_history, experiment_for, load_skill, reply_schema, validate_reply


def ollama_model():
    model = os.environ.get("OLLAMA_MODEL", "gemma4:e2b")
    if not re.fullmatch(r"gemma4(?::[a-zA-Z0-9_.-]+)?", model) or "cloud" in model:
        raise ValueError("Use um modelo Gemma 4 local em OLLAMA_MODEL, como gemma4:e2b.")
    return model


def ollama_status():
    model = ollama_model()
    try:
        with request.urlopen("http://127.0.0.1:11434/api/tags", timeout=2) as response:
            models = json.load(response).get("models", [])
        names = [m.get("name", "") for m in models]
        return {"available": model in names or (model == "gemma4" and "gemma4:latest" in names),
                "running": True, "model": model}
    except (OSError, ValueError):
        return {"available": False, "running": False, "model": model}


def advise(config):
    report = analyze(config)
    candidates = report["opportunities"][:8]
    answers = answer_history(config)
    skill = load_skill()
    model = ollama_model()
    clarification_only = not candidates or (not config.get("context", "").strip() and not answers)
    schema = reply_schema(candidates, clarification_only)
    system = skill["body"]
    payload = {"model": model, "stream": False, "think": False, "format": schema,
               "messages": [{"role": "system", "content": system},
                            {"role": "user", "content": json.dumps({
                                "task": "ask_one_question" if clarification_only else "choose_or_clarify",
                                "site_type": report["site_type"],
                                "routine": config.get("context", ""), "answers": answers,
                                "evidence": "manual_estimate",
                                "highest_consumers": [{k: d[k] for k in ("name", "watts", "hours", "protected")}
                                    for d in sorted(report["devices"], key=lambda d: d["baseline_kwh"], reverse=True)[:4]],
                                "candidates": [{k: c[k] for k in (
                                    "id", "name", "watts", "hours", "plannedWatts", "plannedHours", "energy_reduction_kwh")}
                                    for c in candidates]}, ensure_ascii=False)}],
               "options": {"num_ctx": 4096, "num_predict": 400, "temperature": 0}}
    req = request.Request("http://127.0.0.1:11434/api/chat", data=json.dumps(payload).encode(),
                          headers={"Content-Type": "application/json"}, method="POST")
    try:
        with request.urlopen(req, timeout=90) as response:
            response_data = json.load(response)
    except error.HTTPError as exc:
        raise ValueError(f"Ollama retornou HTTP {exc.code}. Confira se o modelo local está instalado.") from None
    except (error.URLError, TimeoutError):
        raise ValueError("Gemma não respondeu. Inicie o Ollama e carregue o modelo; a simulação continua disponível.") from None
    content = response_data.get("message", {}).get("content", "")
    if response_data.get("done_reason") == "length":
        raise ValueError("Gemma atingiu o limite de resposta. Tente novamente com uma rotina mais curta.")
    try:
        answer = json.loads(content)
    except (ValueError, TypeError):
        raise ValueError("O modelo não retornou um plano válido. Tente novamente.") from None
    candidate = validate_reply(answer, candidates)
    # Missing routine must be clarified even if a model tries to recommend anyway.
    if not config.get("context", "").strip() and not answers and candidate is not None:
        raise ValueError("Conte um pouco sobre sua rotina antes de receber uma recomendação.")
    return {"provider": "ollama", "model": model, "evidence": "manual_estimate",
            "decision": answer["decision"], "experiment": experiment_for(candidate, report["site_type"]),
            "phase": "clarify" if clarification_only else "choose",
            "skill": {"name": skill["name"], "sha256": skill["sha256"]},
            "considered_candidate_ids": [c["id"] for c in candidates], "answers_considered": len(answers),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "candidate": candidate, "reason": answer["reason"],
            "next_step": answer["next_step"], "question": answer["question"]}
