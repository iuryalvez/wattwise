'use strict';
const $ = (id) => document.getElementById(id);
const I = globalThis.WattWiseI18n, t = I.text, h = I.html;
const money = I.money, num = I.number;
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY = 'wattwise-mvp-v1';
const SAMPLE_OPTIONS = {
  family: {path: '/api/sample', scenario: 'family-of-three-v1', labelKey: 'familia_3_pessoas'},
  'high-consumption': {path: '/api/sample/high-consumption', scenario: 'high-consumption-five-person-v1', labelKey: 'alto_consumo_5_pessoas'},
  industrial: {path: '/api/sample/industrial', scenario: 'industrial-packaging-v1', labelKey: 'industria_embalagens'}
};
let config = {rate: 1.05, days: 30, context: '', devices: []};
let history = [], report = null, chosen = null, version = 0, editing = null, sample = false, followupQuestion = '';
let toastTimer, analysisTimer, analysisController, activePlan = null, activePlanReport = null, lastToast = null;
let storageMessage = 'pronto_para_salvar_neste_navegador', modelStatus = null, formFailure = null, advisorFailure = null;

// Recovery keeps the raw input untouched until a verified backup exists.
let recoveryOriginal = null, recoveryBackup = null;
const recoveryMessages = [];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bounded = (value, max, positive = false) => typeof value === 'number' && Number.isFinite(value)
  && value >= 0 && value <= max && (!positive || value > 0);
const text = (value, max) => typeof value === 'string' && !!value.trim() && value.length <= max;
function rejected(field, key, params = {}, fieldKey = null) { recoveryMessages.push({field, key, params, fieldKey}); }
function storageStatus(key) { storageMessage = key; $('storage-status').textContent = t(key); }
function recoverStored(stored) {
  if (!record(stored)) { rejected('', 'formato_invalido_iniciamos_um_perfil_vazio', {}, 'dados_salvos'); return; }
  if (record(stored.config)) {
    const saved = stored.config;
    config = {...saved, devices: [], advisorAnswers: []};
    for (const [key, fallback, max, positive] of [['rate', 1.05, 1000, false], ['days', 30, 366, true]]) {
      if (!bounded(saved[key], max, positive)) {
        config[key] = fallback; rejected(key, 'recovery_default', {value: fallback});
      }
    }
    if (saved.context === undefined) config.context = '';
    else if (typeof saved.context !== 'string' || saved.context.length > 2000) {
      config.context = ''; rejected('context', 'rotina_invalida_preencha_novamente');
    }
    if (saved.siteType === undefined) config.siteType = 'household';
    else if (!['household', 'industrial'].includes(saved.siteType)) {
      config.siteType = 'household'; rejected('siteType', 'perfil_invalido_confira_o_tipo_de_local');
    }
    const ids = new Set();
    if (!Array.isArray(saved.devices)) rejected('devices', 'lista_de_aparelhos_invalida');
    else saved.devices.forEach((device, index) => {
      const field = `devices[${index}]`;
      if (!record(device)) { rejected(field, 'aparelho_invalido_registro_separado'); return; }
      if (!text(device.id, 80) || !/^[\p{L}\p{N}_-]+$/u.test(device.id) || ids.has(device.id)) {
        rejected(field + '.id', 'identificador_invalido_ou_duplicado_registro_separado'); return;
      }
      if (!text(device.name, 100)) { rejected(field + '.name', 'nome_invalido_registro_separado'); return; }
      for (const [key, max] of [['watts', 100000], ['plannedWatts', 100000], ['hours', 24], ['plannedHours', 24]]) {
        if (!bounded(device[key], max)) { rejected(field + '.' + key, 'valor_invalido_registro_separado'); return; }
      }
      if (device.protected !== undefined && typeof device.protected !== 'boolean') {
        rejected(field + '.protected', 'protecao_invalida_registro_separado'); return;
      }
      if (config.devices.length >= 50) { rejected(field, 'limite_de_50_aparelhos_registro_separado'); return; }
      const recovered = {...device, protected: device.protected ?? false};
      if (recovered.protected && (device.watts !== device.plannedWatts || device.hours !== device.plannedHours)) {
        recovered.plannedWatts = device.watts; recovered.plannedHours = device.hours;
        rejected(field + '.protected', 'proposta_incompativel_mantivemos_o_uso_essencial_atual');
      }
      if (device.note !== undefined && typeof device.note !== 'string') {
        delete recovered.note; rejected(field + '.note', 'nota_invalida_aparelho_mantido');
      }
      config.devices.push(recovered); ids.add(device.id);
    });
    if (saved.advisorAnswers !== undefined) {
      if (!Array.isArray(saved.advisorAnswers)) rejected('advisorAnswers', 'lista_de_respostas_invalida');
      else saved.advisorAnswers.forEach((item, index) => {
        if (!record(item) || !text(item.question, 180) || !text(item.answer, 300)) {
          rejected(`advisorAnswers[${index}]`, 'pergunta_ou_resposta_invalida_registro_separado');
        } else if (config.advisorAnswers.length >= 4) {
          rejected(`advisorAnswers[${index}]`, 'limite_de_quatro_respostas_registro_separado');
        } else config.advisorAnswers.push(item);
      });
    }
    // Obsolete field; do not write a migration during startup.
    delete config.voltage;
  } else rejected('config', 'perfil_invalido_iniciamos_um_perfil_vazio');
  if (!Array.isArray(stored.history)) rejected('history', 'historico_invalido');
  else stored.history.forEach((item, index) => {
    const candidate = item?.plan?.candidate;
    if (!record(item) || !text(item.date, 80) || !Number.isFinite(Date.parse(item.date))
      || !bounded(item.days, 366, true) || (item.sample !== undefined && typeof item.sample !== 'boolean')
      || !record(candidate) || !text(candidate.name, 100)
      || !bounded(candidate.modeled_variable_cost_reduction_brl, Number.MAX_VALUE)
      || (item.plan.evidence !== undefined && item.plan.evidence !== 'manual_estimate')) {
      rejected(`history[${index}]`, 'simulacao_invalida_registro_separado');
    } else if (history.length >= 10) rejected(`history[${index}]`, 'limite_de_dez_simulacoes_registro_separado');
    else history.push(item);
  });
  sample = stored.sample === true;
  if (stored.sample !== undefined && typeof stored.sample !== 'boolean') {
    rejected('sample', 'origem_ficticia_invalida_confira_a_origem_dos_dados');
  }
}
function showRecovery() {
  if (!recoveryMessages.length) return;
  $('storage-recovery').hidden = false;
  $('recovery-summary').textContent = recoveryOriginal !== null
    ? t('recuperamos_os_dados_utilizaveis_o_original_foi_preservado')
    : t('o_armazenamento_local_esta_indisponivel_voce_pode_calcular');
  $('recovery-details').innerHTML = recoveryMessages.map(message => `<li>${esc(message.fieldKey ? t(message.fieldKey) : message.field)}: ${h(message.key, {...message.params, ...(message.key === 'recovery_default' ? {value: num(message.params.value)} : {})})}</li>`).join('');
  $('download-recovery').hidden = recoveryOriginal === null;
}
try {
  const raw = localStorage.getItem(KEY);
  if (raw !== null) {
    try { recoverStored(JSON.parse(raw)); }
    catch { rejected('', 'json_invalido_iniciamos_um_perfil_vazio', {}, 'dados_salvos'); }
    if (recoveryMessages.length) recoveryOriginal = raw;
    storageStatus(recoveryMessages.length ? 'dados_recuperados_confira_o_aviso' : 'salvo_neste_navegador');
  } else storageStatus('pronto_para_salvar_neste_navegador');
} catch {
  rejected('', 'nao_foi_possivel_ler_os_dados_salvos', {}, 'storage');
  storageStatus('armazenamento_local_indisponivel');
}
showRecovery();
function persist() {
  try {
    if (recoveryOriginal !== null && recoveryBackup === null) {
      let suffix = Date.now(), backup;
      do { backup = `${KEY}-recovery-${suffix++}`; } while (localStorage.getItem(backup) !== null);
      localStorage.setItem(backup, recoveryOriginal);
      if (localStorage.getItem(backup) !== recoveryOriginal) throw new Error('Backup não confirmado');
      recoveryBackup = backup;
      $('recovery-backup').textContent = t('backup', {key: backup});
    }
    localStorage.setItem(KEY, JSON.stringify({config, history, sample}));
    storageStatus('salvo_neste_navegador');
  } catch {
    storageStatus('nao_foi_possivel_salvar_dados_apenas_nesta_sessao');
    if (!recoveryMessages.some(message => message.key === 'nao_foi_possivel_salvar_mantenha_esta_pagina_aberta')) {
      rejected('', 'nao_foi_possivel_salvar_mantenha_esta_pagina_aberta', {}, 'storage');
    }
    showRecovery();
  }
}
function download(content, filename) {
  const url = URL.createObjectURL(new Blob([content], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('download-recovery').onclick = () => {
  if (recoveryOriginal !== null) download(recoveryOriginal, 'wattwise-dados-originais.json');
};
function toast(key, params = {}, action) {
  lastToast = {key, params, action};
  renderToast();
  clearTimeout(toastTimer);
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; lastToast = null; }, 7000);
}
function renderToast() {
  if (!lastToast) return;
  const {key, params, action} = lastToast;
  const message = t(key, {...params, ...(params.labelKey ? {label: t(params.labelKey)} : {})});
  $('toast').replaceChildren(document.createTextNode(message));
  if (action) { const button = document.createElement('button'); button.textContent = t('undo'); button.onclick = action; $('toast').append(button); }
}
async function api(path, body, signal) {
  const response = await fetch(path, body === undefined ? {signal} : {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(I.error(data));
    error.details = data; error.status = response.status; error.code = data.code; error.field = data.field;
    throw error;
  }
  return data;
}
function syncFields(updateInputs = true) {
  const industrial = config.siteType === 'industrial';
  $('site-name').textContent = industrial ? t('minha_fabrica') : t('minha_casa');
  $('sidebar-context').textContent = industrial ? t('sua_operacao_mais_eficiente') : t('sua_casa_mais_consciente');
  $('devices-title').textContent = industrial ? t('o_que_consome_na_sua_fabrica') : t('o_que_consome_na_sua_casa');
  $('advisor-description').textContent = industrial
    ? t('gemma_considera_sua_operacao_esclarece_duvidas_e_orienta')
    : t('gemma_considera_sua_rotina_esclarece_duvidas_e_orienta');
  if (updateInputs) {
    $('rate').value = config.rate; $('days').value = config.days;
    $('context').value = config.context;
  }
  const loadedSample = Object.entries(SAMPLE_OPTIONS).find(([, option]) => option.scenario === config.scenario);
  $('data-label').textContent = sample ? t('sample_evidence', {label: loadedSample ? t(loadedSample[1].labelKey) + ' · ' : ''}) : t('estimativa_manual');
  if (updateInputs && sample && loadedSample) $('sample-scenario').value = loadedSample[0];
  const count = (config.advisorAnswers || []).length;
  $('advisor-memory').textContent = count ? t('answers_count', {count}) : t('sua_rotina_orienta_a_escolha');
  $('clear-answers').hidden = !count;
}
function changed(preserveAnswers = false) {
  if (!preserveAnswers) config.advisorAnswers = [];
  version++; chosen = null; activePlan = null; activePlanReport = null; report = null; formFailure = null; advisorFailure = null;
  $('advisor-followup').hidden = true; followupQuestion = '';
  $('chosen-plan').hidden = true; $('plan-placeholder').hidden = false;
  $('comparison-section').hidden = true; $('ai-error').hidden = true;
  persist(); syncFields(); renderDevices(); renderMetrics();
  clearTimeout(analysisTimer); analysisTimer = setTimeout(refresh, 120);
}
function renderDevices() {
  $('empty-devices').hidden = config.devices.length > 0;
  const rows = report?.devices || [];
  const maximum = Math.max(1, ...rows.map(r => r.baseline_kwh));
  $('devices').innerHTML = config.devices.map((d, i) => {
    const row = rows.find(r => r.id === d.id);
    return `<article class="device-row"><div class="device-icon" aria-hidden="true">${['⌘','◴','▣','☼'][i % 4]}</div><div><div class="device-name">${esc(d.name)}${d.protected ? `<span class="protected">${h('preserve')}</span>` : ''}</div><div class="device-meta">${num(d.watts)} W · ${num(d.hours, 2)} ${h('per_day')}${row ? ` · ${num(row.baseline_kwh, 2)} kWh` : ''}</div>${d.note ? `<details class="device-meta"><summary>${h('assumptions')}</summary>${esc(d.note)}</details>` : ''}<div class="device-bar" aria-hidden="true"><span style="width:${row ? Math.max(0, row.baseline_kwh / maximum * 100) : 0}%"></span></div></div><div class="device-amount">${row ? money(row.baseline_cost_brl) : '—'}<button class="text-button" data-edit="${esc(d.id)}" aria-label="${h('edit_name', {name: d.name})}">${h('edit')}</button></div></article>`;
  }).join('');
  $('devices').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openDevice(b.dataset.edit));
}
function renderMetrics() {
  $('cost').textContent = report ? money(report.total.baseline_cost_brl) : '—';
  $('consumption').innerHTML = report ? `${num(report.total.baseline_kwh, 2)} <small>kWh</small>` : '—';
  $('cost-caption').textContent = t('period_cost', {count: config.days, days: num(config.days)});
  const best = report?.opportunities[0];
  $('potential').textContent = best ? money(best.modeled_variable_cost_reduction_brl) : '—';
  $('potential-caption').textContent = best ? t('potential_period', {count: config.days, energy: num(best.energy_reduction_kwh, 2), days: num(config.days)}) : t('defina_uma_mudanca_para_comparar');
}
async function refresh() {
  clearTimeout(analysisTimer);
  analysisController?.abort(); analysisController = new AbortController();
  const current = version;
  $('form-error').hidden = true; formFailure = null;
  if (!config.devices.length) { report = null; renderDevices(); renderMetrics(); return; }
  try {
    const result = await api('/api/analyze', config, analysisController.signal);
    if (version !== current) return;
    report = result; renderDevices(); renderMetrics();
  } catch (error) {
    if (error.name === 'AbortError' || version !== current) return;
    report = null; renderMetrics();
    formFailure = error.details || {}; $('form-error').textContent = I.error(formFailure); $('form-error').hidden = false;
  }
}
function openDevice(id = null) {
  editing = id;
  const d = config.devices.find(d => d.id === id);
  $('dialog-title').textContent = d ? t('editar_aparelho') : t('novo_aparelho');
  $('device-name').value = d?.name || '';
  $('device-watts').value = d?.watts ?? '';
  $('device-hours').value = d?.hours ?? '';
  $('device-planned-watts').value = d?.plannedWatts ?? '';
  $('device-planned-hours').value = d?.plannedHours ?? '';
  $('device-protected').checked = d?.protected || false;
  $('delete-device').hidden = !d;
  $('device-error').hidden = true;
  syncProtected(); $('device-dialog').showModal();
}
function syncProtected() {
  const protect = $('device-protected').checked;
  for (const [base, planned] of [['device-watts','device-planned-watts'], ['device-hours','device-planned-hours']]) {
    $(planned).disabled = protect;
    if (protect) $(planned).value = $(base).value;
  }
}
$('device-protected').onchange = syncProtected;
for (const [base, planned] of [['device-watts','device-planned-watts'], ['device-hours','device-planned-hours']]) {
  $(base).oninput = () => { if (!editing && !$(planned).dataset.edited || $('device-protected').checked) $(planned).value = $(base).value; syncProtected(); };
  $(planned).oninput = () => { $(planned).dataset.edited = 'true'; };
}
$('device-form').onsubmit = (event) => {
  event.preventDefault();
  const d = {id: editing || crypto.randomUUID(), name: $('device-name').value.trim(),
    watts: Number($('device-watts').value), hours: Number($('device-hours').value),
    plannedWatts: Number($('device-planned-watts').value), plannedHours: Number($('device-planned-hours').value),
    protected: $('device-protected').checked};
  if (!d.name) { $('device-error').textContent = t('informe_o_nome_do_aparelho'); $('device-error').hidden = false; return; }
  if (editing) config.devices = config.devices.map(old => old.id === editing ? d : old);
  else config.devices.push(d);
  $('device-dialog').close(); changed(); toast('aparelho_salvo_estimativa_atualizada');
};
$('delete-device').onclick = () => {
  const previous = structuredClone(config);
  config.devices = config.devices.filter(d => d.id !== editing);
  $('device-dialog').close(); changed();
  toast('aparelho_excluido', {}, () => { config = previous; changed(); toast('aparelho_restaurado'); });
};
$('close-dialog').onclick = () => $('device-dialog').close();
for (const id of ['add-device','empty-add']) $(id).onclick = () => {
  delete $('device-planned-watts').dataset.edited; delete $('device-planned-hours').dataset.edited; openDevice();
};
for (const [id, key] of [['rate','rate'], ['days','days']]) {
  $(id).onchange = () => {
    if (!$(id).checkValidity() || $(id).value === '') { $(id).reportValidity(); return; }
    config[key] = Number($(id).value); changed();
  };
}
$('context').onchange = () => { config.context = $('context').value; changed(); };
$('load-demo').onclick = async () => {
  const previous = structuredClone(config), oldSample = sample;
  const option = SAMPLE_OPTIONS[$('sample-scenario').value];
  if (!option || $('load-demo').disabled) return;
  $('load-demo').disabled = true;
  try {
    config = await api(option.path); sample = true; changed();
    toast('sample_loaded', {labelKey: option.labelKey}, () => { config = previous; sample = oldSample; changed(); toast('seus_dados_foram_restaurados'); });
  } catch (error) {
    toast(error.status === 404
      ? 'este_exemplo_precisa_da_versao_atual_do_servidor'
      : 'nao_foi_possivel_carregar_o_exemplo_confira_se');
  }
  finally { $('load-demo').disabled = false; }
};
function renderStatus() {
  if (!modelStatus) { $('model-status').textContent = t('verificando_gemma_local'); return; }
  const data = modelStatus;
  $('model-status').textContent = data.error || data.code ? I.error(data) : (data.available ? t('model_ready', {model: data.model}) : data.running ? t('model_missing', {model: data.model}) : t('ollama_nao_conectado_modo_manual_disponivel'));
}
async function status() {
  modelStatus = null;
  $('model-status').textContent = t('verificando_gemma_local');
  try {
    const data = await api('/api/status');
    $('model-dot').classList.toggle('ready', data.available);
    modelStatus = data; renderStatus();
  } catch { modelStatus = {code: 'unknown'}; renderStatus(); $('model-dot').classList.remove('ready'); }
}
$('check-model').onclick = status;
function pickPlan(plan, renderOnly = false) {
  activePlan = plan;
  if (!renderOnly) activePlanReport = report;
  if (!renderOnly) { $('ai-error').hidden = true; advisorFailure = null; }
  $('plan-placeholder').hidden = true; $('chosen-plan').hidden = false;
  followupQuestion = plan.provider === 'ollama' ? plan.question : '';
  $('advisor-followup').hidden = !followupQuestion || (config.advisorAnswers || []).length >= 4;
  $('advisor-question').textContent = followupQuestion;
  if (!renderOnly) $('advisor-answer').value = '';
  if (plan.decision === 'clarify') {
    chosen = null; $('comparison-section').hidden = true;
    $('chosen-plan').innerHTML = `<article class="selected-plan"><div class="plan-provider">${h('coach_provider')}</div><h3>${h('before_change')}</h3><p>${plan.provider === 'calculator' ? h('esta_e_a_proposta_com_maior_reducao_estimada') : esc(plan.reason)}</p><p class="next-step">${plan.provider === 'calculator' ? h('compare_usage', {watts: num(plan.candidate.watts), hours: num(plan.candidate.hours, 2), plannedWatts: num(plan.candidate.plannedWatts), plannedHours: num(plan.candidate.plannedHours, 2)}) : esc(plan.next_step)}</p>${$('advisor-followup').hidden ? `<p class="question">${plan.provider === 'calculator' ? h('essa_mudanca_e_possivel_sem_prejudicar_uma_atividade') : esc(plan.question)} ${h('update_routine')}</p>` : ''}</article>`;
    return;
  }
  chosen = plan;
  const c = plan.candidate;
  $('chosen-plan').innerHTML = `<article class="selected-plan"><div class="plan-provider">${plan.provider === 'ollama' ? h('local_model', {model: plan.model}) : h('ordenacao_por_potencial_sem_ia')}</div><h3>${esc(c.name)}</h3><p>${plan.provider === 'calculator' ? h('esta_e_a_proposta_com_maior_reducao_estimada') : esc(plan.reason)}</p><p class="next-step">${plan.provider === 'calculator' ? h('compare_usage', {watts: num(plan.candidate.watts), hours: num(plan.candidate.hours, 2), plannedWatts: num(plan.candidate.plannedWatts), plannedHours: num(plan.candidate.plannedHours, 2)}) : esc(plan.next_step)}</p>${plan.experiment ? `<p><strong>${h('experiment_duration', {count: plan.experiment.duration_days, days: num(plan.experiment.duration_days)})}</strong><br>${h(config.siteType === 'industrial' ? 'experiment.industrial' : 'experiment.household')}</p>` : ''}${plan.question && $('advisor-followup').hidden ? `<p class="question">${plan.provider === 'calculator' ? h('essa_mudanca_e_possivel_sem_prejudicar_uma_atividade') : esc(plan.question)}</p>` : ''}</article>`;
  const baseline = activePlanReport.total.baseline_cost_brl;
  const after = c.household_after_cost_brl;
  const max = Math.max(1, baseline, after);
  $('comparison-chart').innerHTML = `<div class="chart-line"><div class="chart-label"><span>${h('current_usage')}</span><strong>${money(baseline)}</strong></div><div class="chart-bar"><span style="width:${baseline / max * 100}%"></span></div></div><div class="chart-line after"><div class="chart-label"><span>${h('changed_usage')}</span><strong>${money(after)}</strong></div><div class="chart-bar"><span style="width:${after / max * 100}%"></span></div></div>`;
  $('chosen-saving').textContent = money(c.modeled_variable_cost_reduction_brl);
  $('chosen-caption').textContent = t('saving_caption', {count: config.days, energy: num(c.energy_reduction_kwh, 2), days: num(config.days)});
  $('comparison-section').hidden = false;
}
$('use-demo-plan').onclick = async () => {
  await refresh();
  if (!report?.opportunities.length) { toast('edite_um_aparelho_e_proponha_um_uso_com'); return; }
  const c = report.opportunities[0];
  pickPlan({provider: 'calculator', candidate: c, reason: t('esta_e_a_proposta_com_maior_reducao_estimada'),
    next_step: t('compare_usage', {watts: num(c.watts), hours: num(c.hours, 2), plannedWatts: num(c.plannedWatts), plannedHours: num(c.plannedHours, 2)}),
    question: t('essa_mudanca_e_possivel_sem_prejudicar_uma_atividade')});
};
async function askAdvisor() {
  await refresh();
  if (!report) { toast('cadastre_um_aparelho_e_confira_os_valores_antes'); return; }
  const current = version, button = $('ask-ai');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 100000);
  button.disabled = true; button.textContent = t('gemma_esta_considerando_sua_rotina'); $('ai-error').hidden = true;
  try {
    const plan = await api('/api/advise', {...config, locale: I.locale}, controller.signal);
    if (version !== current) { toast('os_dados_mudaram_gere_um_novo_plano_com'); return; }
    pickPlan(plan); toast(plan.decision === 'clarify' ? 'gemma_precisa_de_uma_informacao_para_orientar_sua' : 'plano_personalizado_pelo_gemma_local');
  } catch (error) {
    if (version !== current) return;
    advisorFailure = error.name === 'AbortError' ? {code: 'ollama_timeout'} : error.details || {};
    $('ai-error').textContent = I.error(advisorFailure);
    $('ai-error').hidden = false; $('model-setup').open = true;
  } finally {
    clearTimeout(timeout); button.disabled = false; button.textContent = t('encontrar_uma_mudanca_com_gemma');
  }
}
$('ask-ai').onclick = askAdvisor;
$('advisor-followup').onsubmit = async (event) => {
  event.preventDefault();
  const answer = $('advisor-answer').value.trim();
  if (!answer || !followupQuestion || $('ask-ai').disabled) return;
  const previous = config.advisorAnswers || [];
  if (previous.length >= 4) { toast('atualize_sua_rotina_e_recomece_a_conversa_para'); return; }
  config.advisorAnswers = [...previous, {question: followupQuestion, answer}];
  changed(true); await askAdvisor();
};
$('clear-answers').onclick = () => { changed(); toast('conversa_reiniciada_sua_rotina_e_seus_aparelhos_foram'); };
function renderHistory() {
  $('history-count').textContent = t('history_count', {count: history.length});
  $('history-list').innerHTML = history.length ? history.map((entry, i) => `<div class="history-row"><div><strong>${esc(entry.plan.candidate.name)}</strong><small>${h('history_summary', {count: entry.days, date: I.date(entry.date), days: num(entry.days), source: entry.sample ? t('com_dados_ficticios') : t('manual')})}</small></div><div class="history-saving">${money(entry.plan.candidate.modeled_variable_cost_reduction_brl)}<small>${h('estimated')}</small></div><button class="text-button" data-delete-history="${i}" aria-label="${h('delete_simulation', {name: entry.plan.candidate.name})}">×</button></div>`).join('') : `<p class="history-empty">${h('history_empty')}</p>`;
  $('history-list').querySelectorAll('[data-delete-history]').forEach(b => b.onclick = () => {
    const previous = structuredClone(history); history.splice(Number(b.dataset.deleteHistory), 1); persist(); renderHistory();
    toast('simulacao_excluida', {}, () => { history = previous; persist(); renderHistory(); });
  });
}
$('save-experiment').onclick = () => {
  if (!chosen) return;
  history.unshift({date: new Date().toISOString(), days: config.days, sample, plan: structuredClone(chosen)});
  history = history.slice(0, 10); persist(); renderHistory(); toast('simulacao_salva_o_resultado_continua_sendo_uma_projecao');
};
$('export-report').onclick = () => {
  if (!chosen || !report) return;
  const blob = new Blob([JSON.stringify({product: 'WattWise', evidence: 'manual_estimate', sample,
    created_at: new Date().toISOString(), config, report, selected_plan: chosen}, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'wattwise-simulacao.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.querySelectorAll('.nav-link').forEach(link => link.onclick = () => {
  document.querySelectorAll('.nav-link').forEach(item => item.classList.remove('active')); link.classList.add('active');
});
I.onChange(() => {
  syncFields(false); renderDevices(); renderMetrics(); renderHistory(); showRecovery();
  storageStatus(storageMessage); renderStatus(); renderToast();
  if (recoveryBackup) $('recovery-backup').textContent = t('backup', {key: recoveryBackup});
  $('dialog-title').textContent = t(editing ? 'editar_aparelho' : 'novo_aparelho');
  if (!$('device-error').hidden) $('device-error').textContent = t('informe_o_nome_do_aparelho');
  if (formFailure) $('form-error').textContent = I.error(formFailure);
  if (advisorFailure) $('ai-error').textContent = I.error(advisorFailure);
  $('ask-ai').textContent = t($('ask-ai').disabled ? 'gemma_esta_considerando_sua_rotina' : 'encontrar_uma_mudanca_com_gemma');
  if (activePlan) pickPlan(activePlan, true);
});
syncFields(); renderDevices(); renderMetrics(); renderHistory(); refresh(); status();
