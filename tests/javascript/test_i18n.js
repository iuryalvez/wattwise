'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createApp, family} = require('./app_harness');
const engine = require('../../web/vendor/i18next-25.6.0.min.js');
const root = path.join(__dirname, '../..');
const catalogs = Object.fromEntries(['en','pt-BR','es'].map(locale => [locale,
  JSON.parse(fs.readFileSync(path.join(root,'web/locales',`${locale}.json`),'utf8'))]));
const candidate = {id:'tv',name:'Minha TV <img src=x onerror=alert(1)>',watts:100,hours:4,plannedWatts:100,plannedHours:3,
  energy_reduction_kwh:3,modeled_variable_cost_reduction_brl:3.15,household_after_cost_brl:96.85};
const report = {devices:[],opportunities:[candidate],total:{baseline_kwh:100,baseline_cost_brl:100}};

(async () => {
  const app = createApp(null,{locale:null,languages:['pt-BR'],report});
  assert.equal(app.read('I.locale'),'en','English is the initial language even with a Portuguese browser');
  assert.equal(app.read('I.resolve("auto")'),'pt-BR');
  assert.equal(app.read('I.browserLocale(["fr-FR", "es-MX", "en-US"])'),'es');
  assert.equal(app.read('I.browserLocale(["fr", null, 42])'),'en');
  for (const [input,result] of [['en-US','en'],['es-AR','es'],['pt-PT','pt-BR'],['PT-br','pt-BR'],['enx',null],['en<script>',null]]) {
    assert.equal(app.read(`I.normalize(${JSON.stringify(input)})`),result);
  }
  app.select('pt-BR');
  assert.equal(app.storage.get('wattwise-locale-v1'),'pt-BR');
  const reloaded = createApp(null,{locale:app.storage.get('wattwise-locale-v1'),languages:['en']});
  assert.equal(reloaded.read('I.locale'),'pt-BR','Saved choice overrides browser language');
  app.select('auto');assert.equal(app.read('I.locale'),'pt-BR');
  app.select('unsupported');assert.equal(app.read('I.locale'),'en');
  const pending = createApp(null,{locale:'es',pendingLocales:['es'],languages:['es-MX','pt-BR']});
  assert.deepEqual(pending.read('I.supported'),['en','pt-BR']);
  assert.equal(pending.read('I.locale'),'en');pending.select('es');assert.equal(pending.read('I.locale'),'en');
  pending.select('auto');assert.equal(pending.read('I.locale'),'pt-BR','Automatic detection cannot select a locale awaiting review');
  const blocked = createApp(null,{locale:null,failRead:true,failWrite:true});
  assert.equal(blocked.select('es'),false);assert.equal(blocked.read('I.locale'),'es');
  assert(blocked.get('language-notice').textContent.includes('solo en esta sesión'));
  const invalidInput={max:'24',validity:{rangeOverflow:true},setCustomValidity(message){this.validationMessage=message;}};
  app.select('es');app.documentListeners.invalid({target:invalidInput});
  assert.equal(invalidInput.validationMessage,'Introduce un valor de hasta 24.');
  app.select('pt-BR');app.documentListeners.invalid({target:invalidInput});
  assert.equal(invalidInput.validationMessage,'Informe um valor de até 24.');
  invalidInput.validity={customError:true};app.documentListeners.input({target:invalidInput});
  assert.equal(invalidInput.validationMessage,'','Editing clears stale native custom validation');

  const translator = engine.createInstance();
  const partial = structuredClone(catalogs.es);delete partial.language;
  await translator.init({lng:'es',fallbackLng:['en','pt-BR'],keySeparator:false,
    resources:{en:{translation:catalogs.en},es:{translation:partial},'pt-BR':{translation:catalogs['pt-BR']}}});
  assert.equal(translator.t('language'),'Language','Missing keys fall back to local English');
  assert(translator.t('edit_name',{name:'<img onerror="boom">'}).includes('&lt;img'));
  app.select('en');
  assert(app.read('I.html("edit_name", {name:"<script>"})').includes('&lt;script&gt;'));
  assert.equal(app.read('I.text("edit_name", {name:"<script>"})'),'Edit <script>','Text sinks preserve literal user text');
  app.read("globalThis.WattWiseCurrency.apply('BRL',5)");
  for (const locale of Object.keys(catalogs)) {
    await translator.changeLanguage(locale);
    const rules = new Intl.PluralRules(locale);
    for (const count of [0,1,2,5,1000000]) {
      assert.equal(translator.t('history_count',{count}),catalogs[locale][`history_count_${rules.select(count)}`].replace('{{count}}',String(count)));
    }
    app.select(locale);
    assert.equal(app.read('money(1234.56)'),new Intl.NumberFormat(locale,{style:'currency',currency:'BRL',currencyDisplay:'code'}).format(1234.56));
    assert.equal(app.read('num(1234.56, 2)'),new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(1234.56));
    assert.equal(app.read('I.date("2026-11-03T12:00:00Z")'),new Intl.DateTimeFormat(locale).format(new Date('2026-11-03T12:00:00Z')));
    assert(!app.read('I.error({code:"not_a_code", error:"untrusted upstream text"})').includes('untrusted'));
    const message = app.read('I.error({code:"invalid_input", message_key:"errors.maximum", field:"devices[0].hours", params:{max:24, lng:"pt-BR", interpolation:{escapeValue:false}}})');
    assert(message.includes('24'));assert(!message.includes('{{'));assert(!message.includes('devices[0]'));
  }

  app.get('sample-scenario').value='family';await app.get('load-demo').onclick();
  await app.get('use-demo-plan').onclick();app.get('save-experiment').onclick();
  const original = app.stored(), config = app.read('config'), chosen = app.read('chosen');
  app.get('context').value='Texto ainda não salvo <tag>';
  app.get('advisor-answer').value='Minha resposta em português';
  app.get('device-name').value='Meu nome em edição';
  for (const locale of ['en','pt-BR','es']) {
    app.select(locale);
    assert.equal(app.stored(),original,'Language selection never writes household storage');
    assert.deepEqual(app.read('config'),config);assert.deepEqual(app.read('chosen'),chosen);
    assert.equal(app.get('context').value,'Texto ainda não salvo <tag>');
    assert.equal(app.get('advisor-answer').value,'Minha resposta em português');
    assert.equal(app.get('device-name').value,'Meu nome em edição');
    assert.equal(app.get('history-count').textContent,catalogs[locale].history_count_one.replace('{{count}}','1'));
    assert(app.get('chosen-plan').innerHTML.includes('&lt;img'));
    assert(!app.get('chosen-plan').innerHTML.includes('<img'));
    assert(app.get('comparison-chart').innerHTML.includes(catalogs[locale].current_usage));
  }
  app.fail=true;await app.get('use-demo-plan').onclick();
  app.select('en');
  assert.equal(app.read('chosen.candidate.id'),candidate.id,'A failed refresh does not lose the selected comparison during translation');
  assert(app.get('comparison-chart').innerHTML.includes('Current usage'));
  const recovery = createApp('{bad');recovery.select('es');
  assert(recovery.get('recovery-details').innerHTML.includes('JSON inválido'));
  assert.equal(recovery.stored(),'{bad');
  const failure = createApp(JSON.stringify({config:family,history:[]}),{apiError:{code:'invalid_input',message_key:'errors.maximum',field:'days',params:{max:366}}});
  await failure.get('use-demo-plan').onclick();failure.select('es');
  assert(failure.get('form-error').textContent.includes('366'));assert(failure.get('form-error').textContent.includes('Período en días'));
  console.log('i18n: locale resolution, safe interpolation, plurals, formatting, dynamic errors, and data-preserving language changes passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
