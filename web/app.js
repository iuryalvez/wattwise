'use strict';
const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(n);
const num = (n, digits = 1) => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: digits}).format(n);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY = 'wattwise-mvp-v1';
const SAMPLE_OPTIONS = {
  family: {path: '/api/sample', scenario: 'family-of-three-v1', label: 'Família · 3 pessoas'},
  'high-consumption': {path: '/api/sample/high-consumption', scenario: 'high-consumption-five-person-v1', label: 'Alto consumo · 5 pessoas'},
  industrial: {path: '/api/sample/industrial', scenario: 'industrial-packaging-v1', label: 'Indústria · embalagens'}
};
let config = {rate: 1.05, days: 30, context: '', devices: []};
let history = [], report = null, chosen = null, version = 0, editing = null, sample = false, followupQuestion = '';
let toastTimer, analysisTimer, analysisController;

// Recovery keeps the raw input untouched until a verified backup exists.
let recoveryOriginal = null, recoveryBackup = null;
const recoveryMessages = [];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bounded = (value, max, positive = false) => typeof value === 'number' && Number.isFinite(value)
  && value >= 0 && value <= max && (!positive || value > 0);
const text = (value, max) => typeof value === 'string' && !!value.trim() && value.length <= max;
function rejected(field, reason) { recoveryMessages.push(`${field}: ${reason}`); }
function recoverStored(stored) {
  if (!record(stored)) { rejected('Dados salvos', 'formato inválido; iniciamos um perfil vazio.'); return; }
  if (record(stored.config)) {
    const saved = stored.config;
    config = {...saved, devices: [], advisorAnswers: []};
    for (const [key, fallback, max, positive] of [['rate', 1.05, 1000, false], ['days', 30, 366, true]]) {
      if (!bounded(saved[key], max, positive)) {
        config[key] = fallback; rejected(key, `valor inválido; usamos ${num(fallback)} para continuar. Confira este campo.`);
      }
    }
    if (saved.context === undefined) config.context = '';
    else if (typeof saved.context !== 'string' || saved.context.length > 2000) {
      config.context = ''; rejected('context', 'rotina inválida; preencha novamente.');
    }
    if (saved.siteType === undefined) config.siteType = 'household';
    else if (!['household', 'industrial'].includes(saved.siteType)) {
      config.siteType = 'household'; rejected('siteType', 'perfil inválido; confira o tipo de local.');
    }
    const ids = new Set();
    if (!Array.isArray(saved.devices)) rejected('devices', 'lista de aparelhos inválida.');
    else saved.devices.forEach((device, index) => {
      const field = `devices[${index}]`;
      if (!record(device)) { rejected(field, 'aparelho inválido; registro separado.'); return; }
      if (!text(device.id, 80) || !/^[\p{L}\p{N}_-]+$/u.test(device.id) || ids.has(device.id)) {
        rejected(field + '.id', 'identificador inválido ou duplicado; registro separado.'); return;
      }
      if (!text(device.name, 100)) { rejected(field + '.name', 'nome inválido; registro separado.'); return; }
      for (const [key, max] of [['watts', 100000], ['plannedWatts', 100000], ['hours', 24], ['plannedHours', 24]]) {
        if (!bounded(device[key], max)) { rejected(field + '.' + key, 'valor inválido; registro separado.'); return; }
      }
      if (device.protected !== undefined && typeof device.protected !== 'boolean') {
        rejected(field + '.protected', 'proteção inválida; registro separado.'); return;
      }
      if (config.devices.length >= 50) { rejected(field, 'limite de 50 aparelhos; registro separado.'); return; }
      const recovered = {...device, protected: device.protected ?? false};
      if (recovered.protected && (device.watts !== device.plannedWatts || device.hours !== device.plannedHours)) {
        recovered.plannedWatts = device.watts; recovered.plannedHours = device.hours;
        rejected(field + '.protected', 'proposta incompatível; mantivemos o uso essencial atual.');
      }
      if (device.note !== undefined && typeof device.note !== 'string') {
        delete recovered.note; rejected(field + '.note', 'nota inválida; aparelho mantido.');
      }
      config.devices.push(recovered); ids.add(device.id);
    });
    if (saved.advisorAnswers !== undefined) {
      if (!Array.isArray(saved.advisorAnswers)) rejected('advisorAnswers', 'lista de respostas inválida.');
      else saved.advisorAnswers.forEach((item, index) => {
        if (!record(item) || !text(item.question, 180) || !text(item.answer, 300)) {
          rejected(`advisorAnswers[${index}]`, 'pergunta ou resposta inválida; registro separado.');
        } else if (config.advisorAnswers.length >= 4) {
          rejected(`advisorAnswers[${index}]`, 'limite de quatro respostas; registro separado.');
        } else config.advisorAnswers.push(item);
      });
    }
    // Obsolete field; do not write a migration during startup.
    delete config.voltage;
  } else rejected('config', 'perfil inválido; iniciamos um perfil vazio.');
  if (!Array.isArray(stored.history)) rejected('history', 'histórico inválido.');
  else stored.history.forEach((item, index) => {
    const candidate = item?.plan?.candidate;
    if (!record(item) || !text(item.date, 80) || !Number.isFinite(Date.parse(item.date))
      || !bounded(item.days, 366, true) || (item.sample !== undefined && typeof item.sample !== 'boolean')
      || !record(candidate) || !text(candidate.name, 100)
      || !bounded(candidate.modeled_variable_cost_reduction_brl, Number.MAX_VALUE)
      || (item.plan.evidence !== undefined && item.plan.evidence !== 'manual_estimate')) {
      rejected(`history[${index}]`, 'simulação inválida; registro separado.');
    } else if (history.length >= 10) rejected(`history[${index}]`, 'limite de dez simulações; registro separado.');
    else history.push(item);
  });
  sample = stored.sample === true;
  if (stored.sample !== undefined && typeof stored.sample !== 'boolean') {
    rejected('sample', 'origem fictícia inválida; confira a origem dos dados.');
  }
}
function showRecovery() {
  if (!recoveryMessages.length) return;
  $('storage-recovery').hidden = false;
  $('recovery-summary').textContent = recoveryOriginal !== null
    ? 'Recuperamos os dados utilizáveis. O original foi preservado e pode ser baixado. Confira os itens abaixo antes de continuar.'
    : 'O armazenamento local está indisponível. Você pode calcular nesta sessão; os dados podem não continuar disponíveis após recarregar.';
  $('recovery-details').innerHTML = recoveryMessages.map(message => `<li>${esc(message)}</li>`).join('');
  $('download-recovery').hidden = recoveryOriginal === null;
}
try {
  const raw = localStorage.getItem(KEY);
  if (raw !== null) {
    try { recoverStored(JSON.parse(raw)); }
    catch { rejected('Dados salvos', 'JSON inválido; iniciamos um perfil vazio.'); }
    if (recoveryMessages.length) recoveryOriginal = raw;
    $('storage-status').textContent = recoveryMessages.length ? 'Dados recuperados · confira o aviso' : '● Salvo neste navegador';
  } else $('storage-status').textContent = 'Pronto para salvar neste navegador';
} catch {
  rejected('Armazenamento', 'não foi possível ler os dados salvos.');
  $('storage-status').textContent = 'Armazenamento local indisponível';
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
      $('recovery-backup').textContent = `Cópia original preservada neste navegador: ${backup}`;
    }
    localStorage.setItem(KEY, JSON.stringify({config, history, sample}));
    $('storage-status').textContent = '● Salvo neste navegador';
  } catch {
    $('storage-status').textContent = 'Não foi possível salvar · dados apenas nesta sessão';
    if (!recoveryMessages.includes('Armazenamento: não foi possível salvar; mantenha esta página aberta ou exporte seus dados.')) {
      rejected('Armazenamento', 'não foi possível salvar; mantenha esta página aberta ou exporte seus dados.');
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
function toast(message, action) {
  clearTimeout(toastTimer);
  $('toast').replaceChildren(document.createTextNode(message));
  if (action) { const button = document.createElement('button'); button.textContent = 'Desfazer'; button.onclick = action; $('toast').append(button); }
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 7000);
}
async function api(path, body, signal) {
  const response = await fetch(path, body === undefined ? {signal} : {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Não foi possível concluir. Tente novamente.');
    error.status = response.status; error.code = data.code; error.field = data.field;
    throw error;
  }
  return data;
}
function syncFields() {
  const industrial = config.siteType === 'industrial';
  $('site-name').textContent = industrial ? 'Minha fábrica' : 'Minha casa';
  $('sidebar-context').textContent = industrial ? 'SUA OPERAÇÃO, MAIS EFICIENTE' : 'SUA CASA, MAIS CONSCIENTE';
  $('devices-title').textContent = industrial ? 'O que consome na sua fábrica' : 'O que consome na sua casa';
  $('advisor-description').textContent = industrial
    ? 'Gemma considera sua operação, esclarece dúvidas e orienta uma experiência que preserve produção, qualidade e segurança.'
    : 'Gemma considera sua rotina, esclarece dúvidas e orienta uma experiência que preserve o que importa para sua casa.';
  $('rate').value = config.rate; $('days').value = config.days;
  $('context').value = config.context;
  const loadedSample = Object.entries(SAMPLE_OPTIONS).find(([, option]) => option.scenario === config.scenario);
  $('data-label').textContent = sample ? `${loadedSample ? loadedSample[1].label + ' · ' : ''}Exemplo fictício · estimativa manual` : 'Estimativa manual';
  if (sample && loadedSample) $('sample-scenario').value = loadedSample[0];
  const count = (config.advisorAnswers || []).length;
  $('advisor-memory').textContent = count ? `${count} resposta(s) considerada(s) · até 4 por conversa` : 'Sua rotina orienta a escolha.';
  $('clear-answers').hidden = !count;
}
function changed(preserveAnswers = false) {
  if (!preserveAnswers) config.advisorAnswers = [];
  version++; chosen = null; report = null;
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
    return `<article class="device-row"><div class="device-icon" aria-hidden="true">${['⌘','◴','▣','☼'][i % 4]}</div><div><div class="device-name">${esc(d.name)}${d.protected ? '<span class="protected">Preservar uso</span>' : ''}</div><div class="device-meta">${num(d.watts)} W · ${num(d.hours, 2)} h/dia${row ? ` · ${num(row.baseline_kwh, 2)} kWh` : ''}</div>${d.note ? `<details class="device-meta"><summary>Hipóteses deste exemplo</summary>${esc(d.note)}</details>` : ''}<div class="device-bar" aria-hidden="true"><span style="width:${row ? Math.max(0, row.baseline_kwh / maximum * 100) : 0}%"></span></div></div><div class="device-amount">${row ? money(row.baseline_cost_brl) : '—'}<button class="text-button" data-edit="${esc(d.id)}" aria-label="Editar ${esc(d.name)}">Editar ↗</button></div></article>`;
  }).join('');
  $('devices').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openDevice(b.dataset.edit));
}
function renderMetrics() {
  $('cost').textContent = report ? money(report.total.baseline_cost_brl) : '—';
  $('consumption').innerHTML = report ? `${num(report.total.baseline_kwh, 2)} <small>kWh</small>` : '—';
  $('cost-caption').textContent = `Para ${num(config.days)} dias · custo variável`;
  const best = report?.opportunities[0];
  $('potential').textContent = best ? money(best.modeled_variable_cost_reduction_brl) : '—';
  $('potential-caption').textContent = best ? `${num(best.energy_reduction_kwh, 2)} kWh · uma mudança em ${num(config.days)} dias` : 'Defina uma mudança para comparar';
}
async function refresh() {
  clearTimeout(analysisTimer);
  analysisController?.abort(); analysisController = new AbortController();
  const current = version;
  $('form-error').hidden = true;
  if (!config.devices.length) { report = null; renderDevices(); renderMetrics(); return; }
  try {
    const result = await api('/api/analyze', config, analysisController.signal);
    if (version !== current) return;
    report = result; renderDevices(); renderMetrics();
  } catch (error) {
    if (error.name === 'AbortError' || version !== current) return;
    report = null; renderMetrics();
    $('form-error').textContent = error.message; $('form-error').hidden = false;
  }
}
function openDevice(id = null) {
  editing = id;
  const d = config.devices.find(d => d.id === id);
  $('dialog-title').textContent = d ? 'Editar aparelho' : 'Novo aparelho';
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
  if (!d.name) { $('device-error').textContent = 'Informe o nome do aparelho.'; $('device-error').hidden = false; return; }
  if (editing) config.devices = config.devices.map(old => old.id === editing ? d : old);
  else config.devices.push(d);
  $('device-dialog').close(); changed(); toast('Aparelho salvo. Estimativa atualizada.');
};
$('delete-device').onclick = () => {
  const previous = structuredClone(config);
  config.devices = config.devices.filter(d => d.id !== editing);
  $('device-dialog').close(); changed();
  toast('Aparelho excluído.', () => { config = previous; changed(); toast('Aparelho restaurado.'); });
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
    toast(`${option.label}: exemplo fictício carregado.`, () => { config = previous; sample = oldSample; changed(); toast('Seus dados foram restaurados.'); });
  } catch (error) {
    toast(error.status === 404
      ? 'Este exemplo precisa da versão atual do servidor. Reinicie o WattWise e recarregue a página.'
      : 'Não foi possível carregar o exemplo. Confira se o WattWise está em execução e tente novamente.');
  }
  finally { $('load-demo').disabled = false; }
};
async function status() {
  $('model-status').textContent = 'Verificando Gemma local…';
  try {
    const data = await api('/api/status');
    $('model-dot').classList.toggle('ready', data.available);
    $('model-status').textContent = data.error || (data.available ? `${data.model} · pronto neste computador` : data.running ? `${data.model} · modelo não instalado` : 'Ollama não conectado · modo manual disponível');
  } catch { $('model-status').textContent = 'Não foi possível verificar o Ollama'; $('model-dot').classList.remove('ready'); }
}
$('check-model').onclick = status;
function pickPlan(plan) {
  $('ai-error').hidden = true;
  $('plan-placeholder').hidden = true; $('chosen-plan').hidden = false;
  followupQuestion = plan.provider === 'ollama' ? plan.question : '';
  $('advisor-followup').hidden = !followupQuestion || (config.advisorAnswers || []).length >= 4;
  $('advisor-question').textContent = followupQuestion;
  $('advisor-answer').value = '';
  if (plan.decision === 'clarify') {
    chosen = null; $('comparison-section').hidden = true;
    $('chosen-plan').innerHTML = `<article class="selected-plan"><div class="plan-provider">✧ Gemma local · orientação para sua casa</div><h3>Antes de sugerir uma mudança</h3><p>${esc(plan.reason)}</p><p class="next-step">${esc(plan.next_step)}</p>${$('advisor-followup').hidden ? `<p class="question">${esc(plan.question)} Atualize a rotina acima para continuar.</p>` : ''}</article>`;
    return;
  }
  chosen = plan;
  const c = plan.candidate;
  $('chosen-plan').innerHTML = `<article class="selected-plan"><div class="plan-provider">${plan.provider === 'ollama' ? `✧ Gemma local · ${esc(plan.model)}` : 'Ordenação por potencial · sem IA'}</div><h3>${esc(c.name)}</h3><p>${esc(plan.reason)}</p><p class="next-step">${esc(plan.next_step)}</p>${plan.experiment ? `<p><strong>Uma experiência de ${num(plan.experiment.duration_days)} dias</strong><br>${esc(plan.experiment.check)}</p>` : ''}${plan.question && $('advisor-followup').hidden ? `<p class="question">${esc(plan.question)}</p>` : ''}</article>`;
  const baseline = report.total.baseline_cost_brl;
  const after = c.household_after_cost_brl;
  const max = Math.max(1, baseline, after);
  $('comparison-chart').innerHTML = `<div class="chart-line"><div class="chart-label"><span>Como usa hoje</span><strong>${money(baseline)}</strong></div><div class="chart-bar"><span style="width:${baseline / max * 100}%"></span></div></div><div class="chart-line after"><div class="chart-label"><span>Com esta mudança</span><strong>${money(after)}</strong></div><div class="chart-bar"><span style="width:${after / max * 100}%"></span></div></div>`;
  $('chosen-saving').textContent = money(c.modeled_variable_cost_reduction_brl);
  $('chosen-caption').textContent = `${num(c.energy_reduction_kwh, 2)} kWh a menos em ${num(config.days)} dias, mantendo as demais hipóteses de uso.`;
  $('comparison-section').hidden = false;
}
$('use-demo-plan').onclick = async () => {
  await refresh();
  if (!report?.opportunities.length) { toast('Edite um aparelho e proponha um uso com menor consumo.'); return; }
  const c = report.opportunities[0];
  pickPlan({provider: 'calculator', candidate: c, reason: 'Esta é a proposta com maior redução estimada entre as opções cadastradas. Sua rotina ainda precisa ser considerada antes de experimentar.',
    next_step: `Compare o uso atual (${num(c.watts)} W por ${num(c.hours, 2)} h/dia) com sua proposta (${num(c.plannedWatts)} W por ${num(c.plannedHours, 2)} h/dia).`,
    question: 'Essa mudança é possível sem prejudicar uma atividade importante para você?'});
};
async function askAdvisor() {
  await refresh();
  if (!report) { toast('Cadastre um aparelho e confira os valores antes de consultar o Gemma.'); return; }
  const current = version, button = $('ask-ai');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 100000);
  button.disabled = true; button.textContent = '✧ Gemma está considerando sua rotina…'; $('ai-error').hidden = true;
  try {
    const plan = await api('/api/advise', config, controller.signal);
    if (version !== current) { toast('Os dados mudaram. Gere um novo plano com os valores atuais.'); return; }
    pickPlan(plan); toast(plan.decision === 'clarify' ? 'Gemma precisa de uma informação para orientar sua escolha.' : 'Plano personalizado pelo Gemma local.');
  } catch (error) {
    if (version !== current) return;
    $('ai-error').textContent = error.name === 'AbortError' ? 'O modelo demorou para responder. Tente novamente ou use o cálculo sem IA.' : error.message;
    $('ai-error').hidden = false; $('model-setup').open = true;
  } finally {
    clearTimeout(timeout); button.disabled = false; button.textContent = '✧ Encontrar uma mudança com Gemma';
  }
}
$('ask-ai').onclick = askAdvisor;
$('advisor-followup').onsubmit = async (event) => {
  event.preventDefault();
  const answer = $('advisor-answer').value.trim();
  if (!answer || !followupQuestion || $('ask-ai').disabled) return;
  const previous = config.advisorAnswers || [];
  if (previous.length >= 4) { toast('Atualize sua rotina e recomece a conversa para continuar.'); return; }
  config.advisorAnswers = [...previous, {question: followupQuestion, answer}];
  changed(true); await askAdvisor();
};
$('clear-answers').onclick = () => { changed(); toast('Conversa reiniciada. Sua rotina e seus aparelhos foram mantidos.'); };
function renderHistory() {
  $('history-count').textContent = `${history.length} ${history.length === 1 ? 'registro' : 'registros'}`;
  $('history-list').innerHTML = history.length ? history.map((h, i) => `<div class="history-row"><div><strong>${esc(h.plan.candidate.name)}</strong><small>${new Date(h.date).toLocaleDateString('pt-BR')} · ${num(h.days)} dias · projeção ${h.sample ? 'com dados fictícios' : 'manual'}</small></div><div class="history-saving">${money(h.plan.candidate.modeled_variable_cost_reduction_brl)}<small> estimados</small></div><button class="text-button" data-delete-history="${i}" aria-label="Excluir simulação de ${esc(h.plan.candidate.name)}">×</button></div>`).join('') : '<p class="history-empty">Suas escolhas ficam aqui. Salve uma simulação para acompanhar sua jornada.<br>Os registros permanecem apenas neste navegador.</p>';
  $('history-list').querySelectorAll('[data-delete-history]').forEach(b => b.onclick = () => {
    const previous = structuredClone(history); history.splice(Number(b.dataset.deleteHistory), 1); persist(); renderHistory();
    toast('Simulação excluída.', () => { history = previous; persist(); renderHistory(); });
  });
}
$('save-experiment').onclick = () => {
  if (!chosen) return;
  history.unshift({date: new Date().toISOString(), days: config.days, sample, plan: structuredClone(chosen)});
  history = history.slice(0, 10); persist(); renderHistory(); toast('Simulação salva. O resultado continua sendo uma projeção.');
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
syncFields(); renderDevices(); renderMetrics(); renderHistory(); refresh(); status();
