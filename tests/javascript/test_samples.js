'use strict';
// Exercise sample selection, persistence, and undo without a model or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..', '..');
const family = JSON.parse(fs.readFileSync(path.join(root, 'examples/family-household.json'), 'utf8'));
const high = JSON.parse(fs.readFileSync(path.join(root, 'examples/high-consumption-household.json'), 'utf8'));
const industry = JSON.parse(fs.readFileSync(path.join(root, 'examples/industrial-packaging.json'), 'utf8'));
const original = {rate: 0.9, days: 20, context: 'Meus dados', devices: []};
function createApp(saved = JSON.stringify({config: original, history: [], sample: false})) {
  const elements = new Map(), calls = [];
  let stored = saved;
  function element() {
    return {value: '', textContent: '', hidden: false, disabled: false, dataset: {}, children: [],
      classList: {toggle() {}, add() {}, remove() {}}, querySelectorAll: () => [],
      replaceChildren(...children) { this.children = children; }, append(child) { this.children.push(child); }};
  }
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  get('sample-scenario').value = 'family';
  const app = {get, calls, fail: false, missingSample: false, stored: () => stored};
  const context = {
    document: {getElementById: get, querySelectorAll: () => [], createTextNode: text => text, createElement: element},
    localStorage: {getItem: () => stored, setItem: (_, value) => { stored = value; }},
    Intl, AbortController, structuredClone, setTimeout: () => 1, clearTimeout() {},
    fetch: async url => {
      calls.push(url);
      if (app.fail) throw new Error('Unavailable');
      if (app.missingSample && (url === '/api/sample/high-consumption' || url === '/api/sample/industrial')) {
        return {ok: false, status: 404, json: async () => ({error: 'Página não encontrada.'})};
      }
      let data;
      if (url === '/api/status') data = {available: false, running: false};
      else if (url === '/api/analyze') data = {devices: [], opportunities: [], total: {baseline_kwh: 0, baseline_cost_brl: 0}};
      else if (url === '/api/sample') data = family;
      else if (url === '/api/sample/high-consumption') data = high;
      else if (url === '/api/sample/industrial') data = industry;
      else throw new Error(`Unexpected request: ${url}`);
      return {ok: true, json: async () => structuredClone(data)};
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'web/app.js'), 'utf8'), context);
  return app;
}
(async () => {
  const app = createApp(), get = app.get;
  get('sample-scenario').value = 'high-consumption';
  await get('load-demo').onclick();
  assert(app.calls.includes('/api/sample/high-consumption'));
  assert.equal(JSON.parse(app.stored()).config.scenario, high.scenario);
  assert.equal(JSON.parse(app.stored()).config.devices.length, 18);
  assert.equal(JSON.parse(app.stored()).sample, true);
  assert(get('data-label').textContent.includes('Alto consumo'));
  assert.equal(get('load-demo').disabled, false);
  const reloaded = createApp(app.stored());
  assert.equal(reloaded.get('sample-scenario').value, 'high-consumption');
  assert(reloaded.get('data-label').textContent.includes('Alto consumo'));
  get('toast').children.find(child => typeof child === 'object' && child.onclick).onclick();
  assert.deepEqual(JSON.parse(app.stored()).config.devices, original.devices);
  assert.equal(JSON.parse(app.stored()).config.context, original.context);
  assert.equal(JSON.parse(app.stored()).sample, false);
  assert.equal(get('data-label').textContent, 'Estimativa manual');
  get('sample-scenario').value = 'family';
  await get('load-demo').onclick();
  assert.equal(JSON.parse(app.stored()).config.scenario, family.scenario);
  const beforeFailure = app.stored();
  app.fail = true;
  get('sample-scenario').value = 'high-consumption';
  await get('load-demo').onclick();
  assert.equal(app.stored(), beforeFailure, 'Failed loads preserve the existing household');
  assert.equal(get('load-demo').disabled, false, 'Loading can be retried after a failure');
  app.fail = false;
  app.missingSample = true;
  await get('load-demo').onclick();
  assert.equal(app.stored(), beforeFailure, 'An older server must not replace the household');
  assert(get('toast').children[0].includes('Reinicie o WattWise'), 'Missing sample routes explain the required server restart');
  assert.equal(get('load-demo').disabled, false);
  app.missingSample = false;
  await get('load-demo').onclick();
  assert.equal(JSON.parse(app.stored()).config.scenario, high.scenario, 'Loading recovers after the server is updated');
  get('sample-scenario').value = 'industrial';
  await get('load-demo').onclick();
  assert(app.calls.includes('/api/sample/industrial'));
  assert.equal(JSON.parse(app.stored()).config.siteType, 'industrial');
  assert.equal(JSON.parse(app.stored()).config.devices.length, 11);
  assert(get('data-label').textContent.includes('Indústria'));
  assert.equal(get('site-name').textContent, 'Minha fábrica');
  assert(get('advisor-description').textContent.includes('produção'));
  const industrialReload = createApp(app.stored());
  assert.equal(industrialReload.get('sample-scenario').value, 'industrial');
  assert.equal(industrialReload.get('site-name').textContent, 'Minha fábrica');
  get('toast').children.find(child => typeof child === 'object' && child.onclick).onclick();
  assert.equal(JSON.parse(app.stored()).config.scenario, high.scenario);
  assert.equal(get('site-name').textContent, 'Minha casa', 'Undo restores household wording');
  assert(get('advisor-description').textContent.includes('casa'));
  app.missingSample = true;
  const beforeIndustrialFailure = app.stored();
  get('sample-scenario').value = 'industrial';
  await get('load-demo').onclick();
  assert.equal(app.stored(), beforeIndustrialFailure);
  assert(get('toast').children[0].includes('Reinicie o WattWise'));
  console.log('Sample checks passed: selection, persistence, undo, failed loads, and old-server restart guidance.');
})().catch(error => { console.error(error); process.exitCode = 1; });
