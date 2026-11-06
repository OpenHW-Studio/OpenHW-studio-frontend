import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createRunnerForBoard } from '../../../src/worker/execute.ts';

// Output-wins arbitration (pico-emu `_set_gpio` unconditionally overwrites
// the pin level — proven headless: OUT 0x2008000 -> 0x2000000 after
// set_gpio(15,0)). The input half must not feed a net's lagging
// component-side voltage back into a board pin the engine drives;
// otherwise firmware output deadlocks LOW forever (live pico GP15 LED).
const noop = () => {};

function topology() {
  return {
    comps: [
      { id: 'pico1', type: 'openhw-pico', attrs: {} },
      { id: 'res1', type: 'openhw-resistor', attrs: {} },
      { id: 'led1', type: 'openhw-led', attrs: {} },
    ],
    wires: [
      { from: 'pico1:GP15', to: 'res1:p1' },
      { from: 'res1:p2', to: 'led1:A' },
      { from: 'led1:K', to: 'pico1:GND' },
    ],
  };
}

async function makeRunner(sample) {
  const { comps, wires } = topology();
  // boardPinMaps is posted by the START postamble in production; pass an
  // explicit pin list (the poll iterates it every tick). NOTE: the
  // COMPONENT_PINS *value* table lacks some board types (its type
  // annotation lists more) — pass pins explicitly, never rely on the
  // registry fallback here.
  const pins = ['GP0', 'GP1', 'GND', 'GP2', 'GP15', 'GP25', 'GND_1', '3V3', 'GP28'];
  const r = await createRunnerForBoard('openhw-pico', '', comps, wires, noop,
    { boardId: 'pico1', boardType: 'openhw-pico', boardPinMaps: [{ boardId: 'pico1', pins }] });
  const injected = [];
  r.engine = {
    sampleGpioOut: sample,
    setGpioInput: (pin, high) => { injected.push([String(pin), !!high]); },
    drainUartOut: () => [],
    stepBudget: () => 0,
  };
  return { r, injected };
}

describe('GPIO output-wins arbitration (plan §5.3, pico-emu clobber)', () => {
  test('engine-driven output is published, never fed back as input', async () => {
    const { r, injected } = await makeRunner(
      (pin) => (pin === 'GP15' ? { level: 1, driving: true } : { level: 0, driving: false }),
    );
    r.pollGpioBidirectional();
    // No input injection on the driven net (the clobber path).
    assert.ok(!injected.some(([p]) => p === 'GP15'), `GP15 must not be injected while driven, got ${JSON.stringify(injected)}`);
    // ...but the output publishes and lights the LED at the 3V3 rail.
    assert.equal(r.pinStates['GP15'], true);
    const led = r.instances.get('led1');
    assert.ok(led.getPinVoltage('A') > 3.0, `LED anode should sit near rail, got ${led.getPinVoltage('A')}`);
    r.stop();
  });

  test('undriven pins still accept input injection (buttons/sensors work)', async () => {
    const { r, injected } = await makeRunner(
      () => ({ level: 0, driving: false }),
    );
    // External 5V on the net (e.g. pressed button to rail).
    r.instances.get('res1').setPinVoltage('p1', 5.0);
    r.pollGpioBidirectional();
    assert.ok(injected.some(([p, h]) => p === 'GP15' && h === true),
      `undriven GP15 must receive input injection, got ${JSON.stringify(injected)}`);
    r.stop();
  });
});
