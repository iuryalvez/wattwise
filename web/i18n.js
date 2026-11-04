'use strict';
// No network detection plugin, translation service, or household-data processing.
(() => {
  const manifest = globalThis.WattWiseLocaleManifest;
  const DEFAULT = manifest.default, KEY = 'wattwise-locale-v1';
  const supported = Object.entries(manifest.locales).filter(([, info]) => info.enabled && info.review.status === 'coverage-reviewed').map(([locale]) => locale);
  const engine = globalThis.i18next.createInstance();
  function normalize(value) {
    if (typeof value !== 'string') return null;
    const language = value.toLowerCase();
    if (/^en(?:-[a-z0-9]+)*$/.test(language)) return 'en';
    if (/^pt(?:-[a-z0-9]+)*$/.test(language)) return 'pt-BR';
    if (/^es(?:-[a-z0-9]+)*$/.test(language)) return 'es';
    return null;
  }
  function browserLocale(languages = globalThis.navigator?.languages?.length ? globalThis.navigator.languages : [globalThis.navigator?.language]) {
    for (const value of languages) { const locale = normalize(value); if (supported.includes(locale)) return locale; }
    return DEFAULT;
  }
  function resolve(choice) {
    return choice === 'auto' ? browserLocale() : supported.includes(choice) ? choice : DEFAULT;
  }
  let choice = DEFAULT;
  try { const saved = localStorage.getItem(KEY); if (saved === 'auto' || supported.includes(saved)) choice = saved; } catch { /* Session remains usable. */ }
  engine.init({lng: resolve(choice), fallbackLng: [DEFAULT, 'pt-BR'], supportedLngs: supported,
    load: 'currentOnly', resources: globalThis.WattWiseCatalogs, initImmediate: false,
    keySeparator: false, returnNull: false, interpolation: {escapeValue: true}});
  // HTML sinks escape the complete returned text; textContent and nodeValue are safe text sinks.
  const text = (key, params = {}) => engine.t(key, {...params, interpolation: {escapeValue: false}});
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const html = (key, params) => escape(text(key, params));
  const number = (value, digits = 1, minimum = 0) => new Intl.NumberFormat(engine.language,
    {maximumFractionDigits: digits, minimumFractionDigits: minimum}).format(value);
  const money = value => new Intl.NumberFormat(engine.language, {style:'currency', currency:'BRL'}).format(value);
  const date = (value, options) => new Intl.DateTimeFormat(engine.language, options).format(new Date(value));
  const listeners = new Set();
  function validateInput(input) {
    if (typeof input?.setCustomValidity !== 'function') return;
    input.setCustomValidity('');
    const validity = input.validity;
    if (!validity || validity.valid) return;
    let key = 'validation.invalid', params = {};
    if (validity.valueMissing) key = 'validation.required';
    else if (validity.badInput || validity.typeMismatch) key = 'validation.number';
    else if (validity.rangeUnderflow) { key = 'validation.min'; params = {min: number(Number(input.min), 5)}; }
    else if (validity.rangeOverflow) { key = 'validation.max'; params = {max: number(Number(input.max), 5)}; }
    else if (validity.stepMismatch) { key = 'validation.step'; params = {step: number(Number(input.step), 5)}; }
    else if (validity.tooLong) { key = 'validation.length'; params = {max: number(input.maxLength, 0)}; }
    input.setCustomValidity(text(key, params));
  }
  function apply(root = document) {
    document.documentElement.lang = engine.language;
    root.querySelectorAll('[data-i18n-text]').forEach(element => {
      for (const binding of element.dataset.i18nText.split('|')) {
        const colon = binding.indexOf(':'), index = Number(binding.slice(0, colon)), key = binding.slice(colon + 1);
        const node = element.childNodes[index];
        if (node?.nodeType === 3) node.nodeValue = text(key);
      }
    });
    for (const attr of ['aria-label', 'placeholder', 'title', 'content']) {
      root.querySelectorAll(`[data-i18n-${attr}]`).forEach(element => element.setAttribute(attr, text(element.getAttribute(`data-i18n-${attr}`))));
    }
    root.querySelectorAll('input, textarea, select').forEach(input => { if (input.validity?.customError) validateInput(input); });
  }
  function select(value) {
    choice = value === 'auto' || supported.includes(value) ? value : DEFAULT;
    engine.changeLanguage(resolve(choice));
    let persisted = true;
    try { localStorage.setItem(KEY, choice); } catch { persisted = false; }
    apply();
    const selector = document.getElementById('language-select');
    if (selector) selector.value = choice;
    for (const listener of listeners) listener();
    const notice = document.getElementById('language-notice');
    if (notice) {
      notice.textContent = text(persisted ? 'language_changed' : 'language_session');
      notice.classList.toggle('sr-only', persisted);
    }
    return persisted;
  }
  function error(data) {
    if (!data || typeof data !== 'object') data = {};
    // Only known local keys can be selected by an API response. Do not interpolate arbitrary options.
    const key = typeof data.message_key === 'string' && data.message_key.startsWith('errors.') && engine.exists(data.message_key)
      ? data.message_key : engine.exists(`errors.${data.code}`) ? `errors.${data.code}` : 'errors.unknown';
    const field = typeof data.field === 'string' && data.field ? data.field : 'config', leaf = field.split('.').at(-1);
    let label = engine.exists(`fields.${leaf}`) ? text(`fields.${leaf}`) : field;
    const device = /^devices\[(\d+)\]\./.exec(field);
    if (device) label = text('fields.device', {index: number(Number(device[1]) + 1, 0), label});
    const params = {field: label};
    for (const name of ['min', 'max', 'name']) {
      const value = data.params?.[name];
      if (typeof value === 'number' && Number.isFinite(value)) params[name] = number(value, 2);
      else if (typeof value === 'string') params[name] = value;
    }
    return text(key, params);
  }
  globalThis.WattWiseI18n = {text, html, escape, number, money, date, error, normalize, browserLocale, resolve,
    select, apply, supported, get locale() {return engine.language;}, get choice() {return choice;},
    onChange: listener => listeners.add(listener)};
  apply();
  document.addEventListener?.('invalid', event => validateInput(event.target), true);
  document.addEventListener?.('input', event => { if (event.target.validity?.customError) event.target.setCustomValidity(''); }, true);
  const selector = document.getElementById('language-select');
  if (selector) {
    selector.querySelectorAll('option').forEach(option => { if (option.value !== 'auto') option.disabled = option.hidden = !supported.includes(option.value); });
    selector.value = choice; selector.onchange = () => select(selector.value);
  }
})();
