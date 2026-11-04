"""Trusted local advisor language instructions and application-owned descriptions."""

from functools import lru_cache
import json

from .errors import InputError
from .paths import WEB_DIR

MANIFEST = json.loads((WEB_DIR / "locales" / "manifest.json").read_text(encoding="utf-8"))
DEFAULT_LOCALE = MANIFEST["default"]
LANGUAGES = {locale: info["advisor_language"] for locale, info in MANIFEST["locales"].items()
             if info["enabled"] and info["review"]["status"] == "coverage-reviewed"}

# Trusted runtime instructions, separate from untrusted routine/answer data.
ADVISOR_LANGUAGE = {
    "en": "Respond only in English. Write reason, next_step and question entirely in English, even when household data is in Portuguese. Use one short sentence per field. Keep appliance names as entered.",
    "pt-BR": "Responda somente em português brasileiro. Escreva reason, next_step e question inteiramente em português brasileiro, mesmo quando os dados estiverem em outro idioma. Use uma frase curta por campo. Mantenha os nomes dos aparelhos como informados.",
    "es": "Responde solo en español. Escribe reason, next_step y question completamente en español, aunque los datos del hogar estén en portugués o inglés. Usa una frase breve por campo. Conserva los nombres de los aparatos tal como se han indicado.",
}
ADVISOR_FIELDS = {
    "en": ("Short reason in English.", "Short next step in English.", "One short question in English."),
    "pt-BR": ("Motivo curto em português brasileiro.", "Próximo passo curto em português brasileiro.", "Uma pergunta curta em português brasileiro."),
    "es": ("Motivo breve en español.", "Próximo paso breve en español.", "Una pregunta breve en español."),
}


def validated_locale(config):
    if not isinstance(config, dict):
        raise InputError("Envie os dados da sua casa.", "config", message_key="errors.profile")
    locale = config.get("locale", DEFAULT_LOCALE)
    if not isinstance(locale, str) or locale not in LANGUAGES:
        raise InputError("Escolha um idioma disponível.", "locale", message_key="errors.locale")
    return locale


@lru_cache(maxsize=3)
def catalog(locale):
    if locale not in LANGUAGES:
        raise ValueError("Unsupported catalog locale")
    return json.loads((WEB_DIR / "locales" / f"{locale}.json").read_text(encoding="utf-8"))


def description(key, locale=DEFAULT_LOCALE):
    return catalog(locale).get(key, catalog(DEFAULT_LOCALE)[key])
