# Smart-home monitoring demonstration

The **Casa conectada** page at `/monitor` is a browser-local mockup, separate from the overview and its planning calculations. Its SVG blueprint is illustrative, not to scale. It contains a living room, kitchen, bedroom, bathroom, and laundry area. Native buttons over the map select each room and expose its simulated sensor status. Sidebar links and **Voltar à visão geral** return to the main planning page.

## Walkthrough

1. Open Casa conectada. The television, refrigerator, air conditioner, and shower-circuit demo sensors start connected for a new browser profile.
2. Select the bathroom. The day scenario shows an available shower sensor with a zero-watt reading.
3. Change the scenario to **Hora do banho**. The fictional shower reading becomes 5,500 W. The connected-sensor total and power chart update. No physical appliance is controlled.
4. Select the bedroom and switch to **Noite de descanso** to see the simulated air-conditioning load.
5. Choose **Conectar dispositivo demo**, select another available sensor, and confirm the simulated pairing. Its room, online status, and generated reading appear after a short demonstration delay. No network is scanned, and no credential is requested.
6. Disconnect a demo sensor. Its reading becomes unavailable. A disconnected refrigerator does not become a claim that the appliance is off.
7. Pause the simulation. The session energy counter stops accumulating. It also pauses while this tab is hidden and resets on reload. Connection choices persist separately in local storage.

## Architecture

- `web/monitor-core.js`: deterministic fictional power profiles, room totals, simulated provenance, and interval energy integration. It can also be loaded by Node for checks.
- `web/monitor.js`: room selection, pairing mock, browser-local connection storage, scenarios, chart rendering, and active-session integration.
- `web/monitor.css`: responsive floorplan and monitoring panels.
- `tests/javascript/test_monitor.js`: checks units, missing readings, scenario changes, connected-sensor totals, and room assignment.

The session counter integrates held power as `watts × elapsed seconds / 3,600,000`. It is synthetic energy for visible, active simulation time. Unknown data is not filled with fabricated zeros. The chart is a rolling history of generated samples, not imported household history.

## Boundary with the planning product

Manual appliance assumptions, saved savings simulations, and Gemma decisions are separate from this mock telemetry. Sensor values are not silently copied into the planning profile and are never evidence of real savings. A future real-device adapter would need timestamps, units, device identification, provenance, data-gap handling, and a deliberate association with the planning appliance before measured comparisons could be offered.
