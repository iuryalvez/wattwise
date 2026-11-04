'use strict';
(() => {
  const core = window.WattWiseMonitor, el = id => document.getElementById(id);
  const I = globalThis.WattWiseI18n, t = I.text, h = I.html, text = I.escape;
  const format = (value, digits=0) => I.number(value, digits, digits);
  const storageKey = 'wattwise-simulated-connections-v1';
  let connected = new Set(['tv','fridge','ac','shower']);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) connected = new Set(saved.filter(id=>core.devices.some(d=>d.id===id)));
  } catch { /* Simulation stays usable without browser storage. */ }
  let room='living', scenario='day', running=true, energy=0, elapsed=0, heldPower=null;
  let lastTime=performance.now(), lastSnapshot, updatedAt=null, points=[], events=[], pairingTimer=null;
  let currentNotice={key:'conexoes_de_demonstracao_nenhum_aparelho_real_e_acessado', params:{}};
  const time = value => I.date(value, {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const paramsFor = params => ({...params, ...(params.nameKey ? {name:t(params.nameKey)} : {}),
    ...(params.scenarioKey ? {scenario:t(params.scenarioKey)} : {})});
  function persist() { try {localStorage.setItem(storageKey,JSON.stringify([...connected]));} catch {notice('conexao_demo_ativa_nesta_sessao_nao_foi_possivel');} }
  function renderNotice() {el('monitor-notice').textContent=t(currentNotice.key,paramsFor(currentNotice.params));}
  function notice(key,params={}) {currentNotice={key,params};renderNotice();}
  function renderEvents() {
    el('sensor-events').innerHTML=events.map(e=>`<li><time>${text(time(e.time))}</time><span>${h(e.key,paramsFor(e.params))}</span></li>`).join('');
  }
  function event(key,params={}) {events.unshift({time:new Date().toISOString(),key,params});events=events.slice(0,4);renderEvents();}
  function renderSensors() {
    el('selected-room').textContent=t(core.rooms[room]);
    const assigned=core.devices.filter(d=>d.room===room),online=assigned.filter(d=>connected.has(d.id)).length;
    el('room-description').textContent=t('sensor_ratio',{online:I.number(online,0),count:assigned.length});
    el('room-sensors').innerHTML=assigned.map(d=>`<article class="sensor-card"><div class="sensor-card-title"><span class="sensor-mini-icon">⌁</span><div><strong>${h(d.name)}</strong><small>${h(d.kind)}</small></div><span class="sensor-state ${connected.has(d.id)?'connected':''}">${h(connected.has(d.id)?'demo_online':'disconnected')}</span></div><div class="sensor-reading-row"><strong id="sensor-reading-${d.id}">—</strong><button class="text-button" data-sensor-id="${d.id}" data-sensor-action="${connected.has(d.id)?'disconnect':'connect'}">${h(connected.has(d.id)?'desconectar_demo':'conectar_demo')}</button></div></article>`).join('');
    document.querySelectorAll('[data-room]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.room===room)));
    document.querySelectorAll('[data-floor]').forEach(f=>f.classList.toggle('selected',f.dataset.floor===room));
  }
  function paint(reading,appendPoint) {
    el('monitor-power').textContent=reading.watts===null?'—':`${format(reading.watts)} W`;
    el('monitor-energy').textContent=`${format(energy,5)} kWh`;
    el('monitor-live').textContent=running&&!document.hidden?t('live_sensors',{count:reading.online}):t('ii_simulacao_em_pausa');
    el('monitor-live').classList.toggle('paused',!running||document.hidden);
    for(const [id,r] of Object.entries(reading.rooms)) {
      const marker=document.querySelector(`[data-room-power="${id}"]`);
      marker.textContent=r.connected?`${format(r.watts)} W`:t('sem_leitura');
      marker.parentElement.classList.toggle('has-reading',r.connected>0);
    }
    for(const sensor of reading.readings) {const value=el(`sensor-reading-${sensor.id}`);if(value)value.textContent=sensor.watts===null?'—':`${format(sensor.watts)} W`;}
    if(appendPoint) {
      // Disconnection is a gap, never an invented zero-watt reading.
      if(reading.watts===null)points=[];else points=[...points,reading.watts].slice(-40);
      const max=Math.max(100,...points),coordinates=points.map((w,i)=>`${i*600/Math.max(1,points.length-1)},${68-w/max*58}`);
      el('sparkline-line').setAttribute('points',coordinates.join(' '));
      el('sparkline-fill').setAttribute('d',coordinates.length>1?`M0,76 L${coordinates.join(' L')} L600,76 Z`:'');
      updatedAt=new Date().toISOString();
    }
    if(updatedAt)el('monitor-updated').textContent=t('simulated_at',{time:time(updatedAt)});
  }
  function tick(appendPoint=true) {
    const now=performance.now(),delta=Math.max(0,Math.min((now-lastTime)/1000,5));lastTime=now;
    if(!running||document.hidden){heldPower=null;if(lastSnapshot)paint(lastSnapshot,false);return;}
    energy=core.integrate(energy,heldPower,delta);elapsed+=delta;
    lastSnapshot=core.snapshot(connected,scenario,elapsed);heldPower=lastSnapshot.watts;paint(lastSnapshot,appendPoint);
  }
  function chooseRoom(id){room=id;renderSensors();if(lastSnapshot)paint(lastSnapshot,false);}
  function renderOptions(selected) {
    const available=core.devices.filter(d=>!connected.has(d.id));
    el('demo-device').innerHTML=available.map(d=>`<option value="${d.id}">${h(d.name)} · ${h(core.rooms[d.room])}</option>`).join('');
    el('demo-device').disabled=!available.length;el('pair-demo').disabled=!available.length||pairingTimer!==null;
    if(available.some(d=>d.id===selected))el('demo-device').value=selected;
    preview();
  }
  function openConnection(id){renderOptions(id);el('connect-dialog').showModal();}
  function preview() {
    const device=core.devices.find(d=>d.id===el('demo-device').value);
    el('connect-preview').textContent=device?t('pair_preview',{room:t(core.rooms[device.room])}):t('todos_os_sensores_da_demonstracao_ja_estao_conectados');
  }
  el('demo-device').onchange=preview;
  el('connect-demo-device').onclick=()=>openConnection();
  el('close-connect').onclick=()=>el('connect-dialog').close();
  el('connect-dialog').addEventListener('close',()=>{clearTimeout(pairingTimer);pairingTimer=null;el('pair-demo').textContent=t('simular_conexao');el('pair-demo').disabled=false;});
  el('connect-form').onsubmit=e=>{
    e.preventDefault();const device=core.devices.find(d=>d.id===el('demo-device').value);if(!device||pairingTimer)return;
    el('pair-demo').disabled=true;el('pair-demo').textContent=t('simulando_pareamento');
    pairingTimer=setTimeout(()=>{
      tick(false);connected.add(device.id);persist();chooseRoom(device.room);tick();
      event('sensor_added',{nameKey:device.name});notice('sensor_connected',{nameKey:device.name});el('connect-dialog').close();
    },650);
  };
  el('room-sensors').onclick=e=>{
    const button=e.target.closest('[data-sensor-id]');if(!button)return;
    const device=core.devices.find(d=>d.id===button.dataset.sensorId);if(!device)return;
    if(button.dataset.sensorAction==='connect')return openConnection(device.id);
    tick(false);connected.delete(device.id);persist();renderSensors();tick();
    event('sensor_removed',{nameKey:device.name});notice('sensor_unavailable',{nameKey:device.name});
  };
  document.querySelectorAll('[data-room]').forEach(button=>button.onclick=()=>chooseRoom(button.dataset.room));
  el('monitor-scenario').onchange=()=>{
    tick(false);scenario=el('monitor-scenario').value;tick();
    const scenarioKey={day:'durante_o_dia',bath:'hora_do_banho',night:'noite_de_descanso'}[scenario];
    event('scenario_changed',{scenarioKey});notice('cenario_alterado_somente_no_simulador_nenhum_aparelho_real');
  };
  el('pause-monitor').onclick=()=>{
    tick(false);running=!running;lastTime=performance.now();heldPower=null;
    el('pause-monitor').textContent=t(running?'ii_pausar_simulacao':'retomar_simulacao');
    event(running?'simulacao_retomada':'simulacao_pausada');tick(false);
  };
  document.addEventListener('visibilitychange',()=>{lastTime=performance.now();heldPower=null;tick(false);});
  I.onChange(()=>{
    renderSensors();renderEvents();renderNotice();
    el('pause-monitor').textContent=t(running?'ii_pausar_simulacao':'retomar_simulacao');
    if(el('connect-dialog').open)renderOptions(el('demo-device').value);
    el('pair-demo').textContent=t(pairingTimer?'simulando_pareamento':'simular_conexao');
    if(lastSnapshot)paint(lastSnapshot,false);
  });
  renderSensors();event('casa_demonstrativa_pronta_leituras_ficticias');tick();setInterval(tick,3000);
})();
