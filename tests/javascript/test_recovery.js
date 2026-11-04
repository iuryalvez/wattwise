'use strict';
const assert = require('node:assert/strict');
const {createApp, family} = require('./app_harness');
const KEY = 'wattwise-mvp-v1';
const savedHistory = {date: '2026-01-01T12:00:00Z', days: 30, sample: true,
  plan: {provider: 'calculator', candidate: {name: 'TV', modeled_variable_cost_reduction_brl: 3.15}}};
const serialize = (config = family, history = [savedHistory]) => JSON.stringify({config, history, sample: true});
const editRate = app => {
  app.get('open-settings').onclick();app.get('rate').value='0.95';app.get('exchange-brl').value='5';
  app.get('settings-form').onsubmit({preventDefault(){}});
};

(async () => {
  const corrupt = serialize({...family, voltage: 220,
    devices: [null, family.devices[0], {...family.devices[1], hours: 25}, family.devices[2], family.devices[0]],
    advisorAnswers: [null, {question: 'Qual uso?', answer: 'A TV'}, {question: 'Q', answer: ''}]},
  [null, {}, savedHistory, {...savedHistory, date: null}, {...savedHistory, plan: {candidate: null}}]);
  const app = createApp(corrupt);
  assert.equal(app.read('config.devices.length'), 2);
  assert.equal(app.read('history.length'), 1);
  assert.equal(app.read('config.devices[0].protected'), true);
  assert.equal(app.read('config.devices[1].id'), 'tv');
  assert.equal(app.read('config.advisorAnswers.length'), 1);
  assert.equal(app.read('config.context'), family.context);
  assert.equal(app.stored(), corrupt, 'Startup, including migration, must not overwrite the original');
  assert.deepEqual(app.writes, []);
  assert.equal(app.get('storage-recovery').hidden, false);
  assert(app.get('recovery-details').innerHTML.includes('devices[2].hours'));
  assert(app.get('recovery-details').innerHTML.includes('history[0]'));
  assert.equal(app.get('download-recovery').hidden, false);
  app.get('download-recovery').onclick();
  assert.equal(await app.downloads[0].text(), corrupt, 'Download contains the exact original');
  editRate(app);
  const backups = [...app.storage.keys()].filter(key => key.startsWith(`${KEY}-recovery-`));
  assert.equal(backups.length, 1);
  assert.equal(app.storage.get(backups[0]), corrupt, 'Exact original survives the first edit');
  const householdWrites=app.writes.filter(key=>key.startsWith(KEY));
  assert.equal(householdWrites[0], backups[0], 'Backup must precede replacement');
  assert.equal(householdWrites[1],KEY);
  assert.equal(JSON.parse(app.stored()).config.devices.length, 2);
  const reload = createApp(app.stored());
  assert.equal(reload.read('history.length'), 1);
  assert.equal(reload.read('config.devices.length'), 2);
  assert.equal(reload.get('storage-recovery').hidden, true);
  assert.equal(reload.read('recoveryMessages.length'), 0);

  for (const raw of ['{broken', 'null', '[]', '{"config":null,"history":[]}', serialize(family, 'broken')]) {
    const broken = createApp(raw);
    assert.equal(broken.stored(), raw);
    assert.equal(broken.get('storage-recovery').hidden, false);
    editRate(broken);
    assert([...broken.storage.values()].includes(raw));
  }
  const badFields = createApp(serialize({...family, rate: 'cheap', days: false, context: [], siteType: {},
    devices: [{...family.devices[0], plannedHours: 1}, {...family.devices[1], protected: 'yes'}], advisorAnswers: {}}));
  assert.equal(badFields.read('config.rate'), 1.05);
  assert.equal(badFields.read('config.days'), 30);
  assert.equal(badFields.read('config.devices.length'), 1);
  assert.equal(badFields.read('config.devices[0].plannedHours'), family.devices[0].hours);
  assert.equal(badFields.read('config.devices[0].protected'), true);
  assert.equal(badFields.read('config.advisorAnswers.length'), 0);
  const tooMany = createApp(serialize({...family, advisorAnswers: Array(6).fill({question: 'Q', answer: 'A'})}, Array(12).fill(savedHistory)));
  assert.equal(tooMany.read('config.advisorAnswers.length'), 4);
  assert.equal(tooMany.read('history.length'), 10);
  const escaped = createApp(serialize({...family, devices: [{...family.devices[0], name: '<img onerror="oops">'}]}));
  assert(!escaped.get('devices').innerHTML.includes('<img'));

  const cannotBackup = createApp(corrupt, {failBackup: true});
  editRate(cannotBackup);
  assert.equal(cannotBackup.stored(), corrupt, 'Failed backup must prevent primary replacement');
  assert.equal(cannotBackup.read('config.rate'), 0.95, 'Edits remain usable in memory');
  assert(cannotBackup.get('storage-status').textContent.includes('apenas nesta sessão'));
  cannotBackup.failBackup = false;
  editRate(cannotBackup);
  assert.equal(JSON.parse(cannotBackup.stored()).config.rate, 0.95, 'Saving can be retried');

  const candidate = {id: 'tv', name: 'TV', watts: 100, hours: 4, plannedWatts: 100, plannedHours: 3,
    energy_reduction_kwh: 3, modeled_variable_cost_reduction_brl: 3.15, household_after_cost_brl: 100};
  for (const options of [{failRead: true}, {failWrite: true}]) {
    const offline = createApp(serialize(), {...options,
      report: {devices: [], opportunities: [candidate], total: {baseline_kwh: 100, baseline_cost_brl: 103.15}}});
    offline.get('sample-scenario').value = 'family';
    await offline.get('load-demo').onclick();
    await offline.get('use-demo-plan').onclick();
    assert.equal(offline.read('chosen.provider'), 'calculator');
    assert.equal(offline.read('chosen.candidate.id'), 'tv');
    assert.equal(offline.get('comparison-section').hidden, false);
    offline.get('save-experiment').onclick();
    assert(offline.read('history.length') > 0, 'History can still be used in memory');
  }
  const validation = createApp(serialize(), {apiError: {error: 'Horas por dia: informe um valor de até 24.', code: 'invalid_input', field: 'devices[0].hours', message_key: 'errors.maximum', params: {max: 24}}});
  await validation.get('use-demo-plan').onclick();
  assert.equal(validation.get('form-error').textContent, 'Aparelho 1 · Horas por dia: informe um valor de até 24.');
  assert.equal(validation.get('form-error').hidden, false);
  const status = createApp(null, {status: {available: false, error: 'Configure OLLAMA_MODEL.', code: 'invalid_model_config'}});
  await status.get('check-model').onclick();
  assert(status.get('model-status').textContent.includes('Gemma 4 local'));
  console.log('Recovery checks passed: partial records, original backups, blocked storage, and calculator fallback.');
})().catch(error => { console.error(error); process.exitCode = 1; });
