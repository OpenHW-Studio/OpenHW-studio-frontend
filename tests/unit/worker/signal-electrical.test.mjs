import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  normalizeEndpointPin,
  buildNetGraph,
  traversePassive,
} from '../../../src/worker/signal/electrical.ts';
import { getInternalBridgesForComponent } from '../../../src/worker/registries/component-registry.ts';

function fakeInst(id, type, pins, state = {}) {
  const store = {};
  for (const p of pins) store[p] = 0;
  return {
    id,
    type,
    state: { ...state },
    setPinVoltage(pin, v) { store[pin] = v; },
    getPinVoltage(pin) { return store[pin] ?? 0; },
    _v: store,
  };
}

const bridges = (id, type) => getInternalBridgesForComponent(id, type);

describe('shared signal service parity (plan §5.3)', () => {
  test('normalizeEndpointPin merges power aliases, passes signals through', () => {
    assert.equal(normalizeEndpointPin('b:gnd_1'), 'b:GND');
    assert.equal(normalizeEndpointPin('b:GND.2'), 'b:GND');
    assert.equal(normalizeEndpointPin('b:GND:1'), 'b:GND');
    assert.equal(normalizeEndpointPin('b:vcc'), 'b:5V');
    assert.equal(normalizeEndpointPin('b:5V'), 'b:5V');
    assert.equal(normalizeEndpointPin('b:3v3_en'), 'b:3V3');
    assert.equal(normalizeEndpointPin('b:3V3'), 'b:3V3');
    assert.equal(normalizeEndpointPin('b:13'), 'b:13');
    assert.equal(normalizeEndpointPin('b:A0'), 'b:A0');
    assert.equal(normalizeEndpointPin('b:SWD_GND'), 'b:SWD_GND');
    assert.equal(normalizeEndpointPin('no-colon'), 'no-colon');
  });

  test('buildNetGraph wires, bridges, aliases, resistor marking', () => {
    const instances = new Map([
      ['uno1', fakeInst('uno1', 'openhw-arduino-uno', [])],
      ['led1', fakeInst('led1', 'openhw-led', ['A', 'K'])],
      ['res1', fakeInst('res1', 'openhw-resistor', ['p1', 'p2'])],
    ]);
    const wires = [
      { from: 'uno1:13', to: 'res1:p1' },
      { from: 'res1:p2', to: 'led1:A' },
      { from: 'led1:K', to: 'uno1:gnd_1' },
    ];
    const { pinToNet, netHasResistor } = buildNetGraph(wires, instances, bridges);
    const netA = pinToNet.get('uno1:13');
    assert.equal(pinToNet.get('res1:p1'), netA);
    assert.equal(pinToNet.get('res1:p2'), netA);
    assert.equal(pinToNet.get('led1:A'), netA);
    // D/Dn alias on the same net.
    assert.equal(pinToNet.get('uno1:D13'), netA);
    // Power-rail variants share the ground net.
    const gndNet = pinToNet.get('led1:K');
    assert.equal(pinToNet.get('uno1:gnd_1'), gndNet);
    assert.equal(pinToNet.get('uno1:GND'), gndNet);
    assert.equal(pinToNet.get('uno1:GND.1'), gndNet);
    // Resistor net is marked.
    assert.ok(netHasResistor.has(netA));
    // Malformed wires never throw, never create undefined keys.
    const again = buildNetGraph([{ from: null, to: 'x:y' }], new Map(), bridges);
    assert.equal(again.pinToNet.size, 0);
  });

  test('traversePassive forwards volts per component model', () => {
    const seen = [];
    const visit = (target, v) => seen.push([target, v]);

    // Resistor: 1000Ω → drop = min(5*0.2, max(0.01, 0.2)) = 0.2 → 4.8.
    const res = fakeInst('res1', 'openhw-resistor', ['p1', 'p2'], { value: 1000 });
    traversePassive(res, 'res1', 'p1', 5.0, visit, bridges);
    assert.deepEqual(seen, [['res1:p2', 4.8]]);
    assert.equal(res._v.p2, 4.8);
    seen.length = 0;

    // LED: anode forward drop 1.8V.
    const led = fakeInst('led1', 'openhw-led', ['A', 'K']);
    traversePassive(led, 'led1', 'A', 5.0, visit, bridges);
    assert.deepEqual(seen, [['led1:K', 3.2]]);
    seen.length = 0;
    traversePassive(led, 'led1', 'K', 5.0, visit, bridges);
    assert.deepEqual(seen, []);

    // Pushbutton unpressed: 1-side internal short only.
    const btn = fakeInst('btn1', 'openhw-pushbutton', ['1l', '1r', '2l', '2r'], { pressed: false });
    traversePassive(btn, 'btn1', '1l', 5.0, visit, bridges);
    assert.ok(seen.some(([t, v]) => t === 'btn1:1r' && v === 5.0));
    assert.ok(!seen.some(([t]) => t === 'btn1:2l'));

    // Pushbutton pressed: 1-side crosses to 2-side.
    const btn2 = fakeInst('btn2', 'openhw-pushbutton', ['1l', '1r', '2l', '2r'], { pressed: true });
    seen.length = 0;
    traversePassive(btn2, 'btn2', '1l', 5.0, visit, bridges);
    assert.ok(seen.some(([t, v]) => t === 'btn2:2l' && v === 5.0));

    // Slide switch right: 3↔2.
    const sw = fakeInst('sw1', 'openhw-slide-switch', ['1', '2', '3'], { value: '1' });
    seen.length = 0;
    traversePassive(sw, 'sw1', '3', 5.0, visit, bridges);
    assert.deepEqual(seen, [['sw1:2', 5.0]]);

    // Potentiometer at 50%: SIG is mid-rail.
    const pot = fakeInst('pot1', 'openhw-potentiometer', ['1', '2', 'SIG'], { value: 50 });
    seen.length = 0;
    traversePassive(pot, 'pot1', '2', 5.0, visit, bridges);
    assert.deepEqual(seen, [['pot1:SIG', 2.5]]);
  });
});
