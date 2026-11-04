'use strict';
(function(root) {
  const rooms = {living:'sala', kitchen:'cozinha', bedroom:'quarto', bathroom:'banheiro', laundry:'lavanderia'};
  const devices = [
    {id:'tv', name:'televisao', room:'living', kind:'tomada_de_energia_demo', power:100},
    {id:'fridge', name:'fridge', room:'kitchen', kind:'sensor_de_energia_demo', power:180},
    {id:'ac', name:'ac', room:'bedroom', kind:'medidor_de_energia_demo', power:900},
    {id:'shower', name:'chuveiro_eletrico', room:'bathroom', kind:'medidor_de_circuito_demo', power:5500},
    {id:'work', name:'computador_de_trabalho', room:'living', kind:'tomada_de_energia_demo', power:180},
    {id:'router', name:'router', room:'living', kind:'sensor_de_energia_demo', power:12},
    {id:'light', name:'iluminacao', room:'bedroom', kind:'sensor_de_energia_demo', power:60},
    {id:'washer', name:'maquina_de_lavar', room:'laundry', kind:'tomada_de_energia_demo', power:450},
    {id:'airfryer', name:'air_fryer', room:'kitchen', kind:'tomada_de_energia_demo', power:1400}
  ];
  function samplePower(device, scenario, seconds) {
    let active;
    if (device.id === 'shower') return scenario === 'bath' ? 5500 : 0;
    if (device.id === 'fridge') active = Math.floor(seconds / 24) % 3 !== 2;
    else if (device.id === 'ac') active = scenario === 'night';
    else if (device.id === 'light') active = scenario === 'night';
    else if (device.id === 'router') return 12;
    else active = scenario === 'day';
    return active ? Math.round(device.power * (1 + 0.035 * Math.sin(seconds / 7 + device.id.length))) : 0;
  }
  function snapshot(connected, scenario, seconds) {
    const roomData = Object.fromEntries(Object.keys(rooms).map(id => [id, {watts:0, connected:0, total:0}]));
    let watts = 0, online = 0;
    const readings = devices.map(device => {
      const available = connected.has(device.id);
      const power = available ? samplePower(device, scenario, seconds) : null;
      roomData[device.room].total++;
      if (available) { online++; watts += power; roomData[device.room].watts += power; roomData[device.room].connected++; }
      return {...device, watts:power, connected:available};
    });
    return {watts:online ? watts : null, online, rooms:roomData, readings, evidence:'simulated'};
  }
  function integrate(kwh, heldWatts, elapsedSeconds) {
    if (heldWatts === null) return kwh;
    if (![kwh, heldWatts, elapsedSeconds].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)) throw new Error('Invalid simulated interval');
    return kwh + heldWatts * elapsedSeconds / 3600000;
  }
  const api = {rooms, devices, samplePower, snapshot, integrate};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WattWiseMonitor = api;
})(globalThis);
