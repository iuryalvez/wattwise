'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'../..');
const elements = new Map(), storage = new Map(), intervals = [], timers = new Map();
let now=0;
function get(id) {
  if(!elements.has(id)) {
    const listeners={};let markup='';
    elements.set(id,{value:'',dataset:{},textContent:'',open:false,disabled:false,parentElement:{classList:{toggle(){}}},
      classList:{toggle(){}},setAttribute(){},addEventListener:(event,fn)=>{listeners[event]=fn;},
      querySelectorAll:()=>[],
      showModal(){this.open=true;},close(){this.open=false;listeners.close?.();},
      set innerHTML(value){markup=value;if(id==='demo-device')this.value=/value="([^"]+)"/.exec(value)?.[1]||'';},get innerHTML(){return markup;}});
  }
  return elements.get(id);
}
get('monitor-scenario').value='day';
const rooms=['living','kitchen','bedroom','bathroom','laundry'].map(room=>{const el=get('room-'+room);el.dataset.room=room;return el;});
const context={Intl,Date,console,performance:{now:()=>now},navigator:{languages:['es-MX']},
  document:{documentElement:{},hidden:false,getElementById:get,querySelector:selector=>get(selector),
    querySelectorAll:selector=>selector==='[data-room]'?rooms:[],addEventListener(){}},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  setInterval:fn=>intervals.push(fn),setTimeout:fn=>{timers.set(timers.size+1,fn);return timers.size;},clearTimeout:id=>timers.delete(id)};
context.window=context;vm.createContext(context);
for(const file of ['vendor/i18next-25.6.0.min.js','locales.js','i18n.js','monitor-core.js','monitor.js'])vm.runInContext(fs.readFileSync(path.join(root,'web',file),'utf8'),context);
for(const locale of ['en','pt-BR','es']) {
  const catalog=context.WattWiseCatalogs[locale].translation;
  for(const key of [...Object.values(context.WattWiseMonitor.rooms),...context.WattWiseMonitor.devices.flatMap(device=>[device.name,device.kind])])assert.equal(typeof catalog[key],'string',`${locale}: missing monitor metadata ${key}`);
}
const select=locale=>vm.runInContext(`WattWiseI18n.select(${JSON.stringify(locale)})`,context);
assert.equal(get('selected-room').textContent,'Living room');
now=3000;intervals[0]();get('pause-monitor').onclick();
const energy=get('monitor-energy').textContent;
get('connect-demo-device').onclick();const device=get('demo-device').value;
select('es');
assert.equal(get('selected-room').textContent,'Sala');
assert(get('pause-monitor').textContent.includes('Reanudar'));
assert(get('sensor-events').innerHTML.includes('Simulación pausada'));
assert.equal(get('connect-dialog').open,true);assert.equal(get('demo-device').value,device);
assert.equal(get('monitor-energy').textContent,energy.replace('.',','),'Locale changes only energy presentation');
get('connect-form').onsubmit({preventDefault(){}});select('pt-BR');
assert.equal(get('pair-demo').textContent,'Simulando pareamento…');assert(get('pair-demo').disabled);
[...timers.values()][0]();
const connections=storage.get('wattwise-simulated-connections-v1');
assert(connections.includes(device));assert.equal(get('connect-dialog').open,false);
select('en');
assert(get('sensor-events').innerHTML.includes('demo connection added'));
assert(get('monitor-notice').textContent.includes('No actual device was paired'));
assert.equal(storage.get('wattwise-simulated-connections-v1'),connections);
select('auto');assert.equal(get('language-select').value,'auto');
assert.equal(vm.runInContext('WattWiseI18n.locale',context),'es');
assert(get('sensor-events').innerHTML.includes('conexión demo añadida'));
const {createApp} = require('./app_harness');
const planning = createApp(null,{locale:storage.get('wattwise-locale-v1'),languages:['es-MX']});
assert.equal(planning.read('I.locale'),'es','The same saved choice applies after navigating from monitoring to planning');
console.log('Monitor i18n: events, pairing, room selection, browser detection, paused state, and energy preservation passed.');
