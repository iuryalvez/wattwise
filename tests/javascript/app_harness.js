'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..', '..');
const family = JSON.parse(fs.readFileSync(path.join(root, 'examples/family-household.json'), 'utf8'));
const high = JSON.parse(fs.readFileSync(path.join(root, 'examples/high-consumption-household.json'), 'utf8'));
const industry = JSON.parse(fs.readFileSync(path.join(root, 'examples/industrial-packaging.json'), 'utf8'));
const original = {rate: 0.9, days: 20, context: 'Meus dados', devices: []};
function createApp(saved = JSON.stringify({config: original, history: [], sample: false}), options = {}) {
  const elements = new Map(), calls = [], downloads = [], documentListeners = {};
  const storage = new Map();
  if (options.locale !== null) storage.set('wattwise-locale-v1', options.locale || 'pt-BR');
  if (saved !== null) storage.set('wattwise-mvp-v1', saved);
  const writes = [];
  function element() {
    return {value: '', textContent: '', hidden: false, disabled: false, dataset: {}, children: [],
      classList: {toggle() {}, add() {}, remove() {}}, querySelectorAll: () => [],
      checkValidity: () => true, reportValidity() {}, showModal() {}, close() {}, click() {},
      replaceChildren(...children) { this.children = children; }, append(child) { this.children.push(child); }};
  }
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  get('sample-scenario').value = 'family';
  get('storage-recovery').hidden = true;
  const app = {get, calls, storage, writes, downloads, documentListeners, ...options, fail: false, missingSample: false,
    stored: () => storage.get('wattwise-mvp-v1') ?? null};
  const context = {
    document: {documentElement: {}, getElementById: get, querySelectorAll: () => [], createTextNode: text => text, createElement: element,
      addEventListener: (event, listener) => { documentListeners[event] = listener; }},
    navigator: {languages: options.languages || ['pt-BR']},
    localStorage: {
      getItem: key => { if (app.failRead) throw new Error('Blocked'); return storage.get(key) ?? null; },
      setItem: (key, value) => {
        if (app.failWrite || (app.failBackup && key !== 'wattwise-mvp-v1')) throw new Error('Quota');
        writes.push(key); storage.set(key, value);
      }
    },
    Intl, AbortController, structuredClone, Blob,
    URL: {createObjectURL: blob => { downloads.push(blob); return 'blob:qa'; }, revokeObjectURL() {}}, setTimeout: () => 1, clearTimeout() {},
    fetch: async url => {
      calls.push(url);
      if (app.fail) throw new Error('Unavailable');
      if (app.apiError && url === '/api/analyze') return {ok: false, status: 400, json: async () => app.apiError};
      if (app.missingSample && (url === '/api/sample/high-consumption' || url === '/api/sample/industrial')) {
        return {ok: false, status: 404, json: async () => ({error: 'Página não encontrada.'})};
      }
      let data;
      if (url === '/api/status') data = app.status || {available: false, running: false};
      else if (url === '/api/analyze') data = app.report || {devices: [], opportunities: [], total: {baseline_kwh: 0, baseline_cost_brl: 0}};
      else if (url === '/api/sample') data = family;
      else if (url === '/api/sample/high-consumption') data = high;
      else if (url === '/api/sample/industrial') data = industry;
      else throw new Error(`Unexpected request: ${url}`);
      return {ok: true, json: async () => structuredClone(data)};
    }
  };
  vm.createContext(context);
  for (const file of ['vendor/i18next-25.6.0.min.js', 'locales.js', 'i18n.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'web', file), 'utf8'), context);
    if (file === 'locales.js') {
      for (const locale of options.pendingLocales || []) vm.runInContext(`WattWiseLocaleManifest.locales[${JSON.stringify(locale)}].review.status = 'pending'`, context);
    }
  }
  vm.runInContext(fs.readFileSync(path.join(root, 'web/app.js'), 'utf8'), context);
  app.read = expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
  app.select = locale => vm.runInContext(`WattWiseI18n.select(${JSON.stringify(locale)})`, context);
  return app;
}

module.exports = {createApp, family, high, industry, original};
