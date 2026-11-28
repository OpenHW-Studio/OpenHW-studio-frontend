import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { AVRRunner } from '../../../src/worker/runners/avr-runner.ts';
import {
  allocateStateSab,
  boardSerialOffsets,
} from '../../../src/worker/sab/layout.ts';
import { readPinRegion } from '../../../src/pages/simulationpage/utils/sabReader.js';

const noop = () => {};
const HEX = ':400000000000';

function unoBoard(id = 'uno1') {
  return { id, type: 'openhw-arduino-uno', attrs: {} };
}

describe('AVR Board HAL surface (plan §5.1)', () => {
  test('rail, pins, aliases, capabilities, limits, sampling', () => {
    const r = new AVRRunner(HEX, [unoBoard()], [], noop, {
      boardId: 'uno1', boardType: 'openhw-arduino-uno',
    });
    try {
      assert.equal(r.railVoltage(), 5.0);
      assert.ok(r.boardPins().includes('13'));
      assert.ok(r.boardPins().includes('A0'));
      assert.deepEqual(r.pinAliases('D13').sort(), ['13', 'D13'].sort());
      assert.deepEqual(r.pinAliases('13').sort(), ['13', 'D13'].sort());
      assert.ok(r.boardCapabilities().includes('digital-gpio'));
      assert.ok(r.boardCapabilities().includes('uart'));
      assert.deepEqual(r.boardLimits(), []);
      // Fresh reset CPU: DDRB=0, so D13 is an undriven input.
      const s = r.sampleOutput('13');
      assert.equal(s.driving, false);
      assert.equal(r.sampleOutput('nope'), null);
      // Input injection never throws and does not touch pinStates contract.
      r.driveInput('A0', true);
      r.driveInput('13', false);
    } finally {
      r.stop();
    }
  });

  test('publish paths flow through the transport (SAB-bound)', () => {
    const pins = ['13', 'gnd_1', '5V'];
    const alloc = allocateStateSab(['uno1', 'led1'], 64, [
      { boardId: 'uno1', boardIdx: 0, pins },
    ]);
    const states = [];
    const r = new AVRRunner(
      HEX,
      [unoBoard(), { id: 'led1', type: 'openhw-led', attrs: {} }],
      [
        { from: 'uno1:13', to: 'led1:A' },
        { from: 'led1:K', to: 'uno1:gnd_1' },
      ],
      (s) => states.push(s),
      {
        boardId: 'uno1',
        boardType: 'openhw-arduino-uno',
        sab: alloc.buffer,
        sabOffsets: alloc.offsets,
        boardPinMaps: [{ boardId: 'uno1', boardIdx: 0, pins }],
        sabGeometry: {
          boardTableOffset: alloc.boardTableOffset,
          pinBitWords: alloc.pinBitWords,
          analogBase: alloc.analogBase,
        },
        sabDebugOffset: alloc.debugOffset,
        sabSerialRxOffset: alloc.serialRxOffset,
        sabSerialTxOffset: alloc.serialTxOffset,
        sabDisplayDescOffset: alloc.displayDescOffset,
      },
    );
    try {
      assert.ok(r.transport, 'transport bound when SAB present');
      assert.ok(r.sabProtoWriter, 'protocol writer bound on v3 alloc');
      r.stop(); // freeze the tick loop for deterministic assertions
      r.propagateBoardPin('13', true);
      const region = readPinRegion(alloc.buffer, [{ boardId: 'uno1', pins }]);
      assert.equal(region.uno1.bits[0] & 1, 1);
      assert.ok(region.uno1.analog[0] > 4.0);
      const led = r.instances.get('led1');
      assert.equal(led.getPinVoltage('A'), 5.0);
      r.forceEmitState();
      const slotBase = new Uint32Array(alloc.buffer)[10];
      const version = new Uint32Array(alloc.buffer, slotBase + 1 * 64, 1)[0];
      assert.ok(version > 0);
      const ledMsg = states.flatMap((s) => s.components || []).find((c) => c.id === 'led1');
      assert.ok(ledMsg);
      assert.ok('illuminated' in ledMsg.state);
    } finally {
      r.stop();
    }
  });

  test('transport absent without SAB (message fallback needs no writer)', () => {
    const r = new AVRRunner(HEX, [unoBoard()], [], noop, { boardId: 'uno1' });
    try {
      assert.equal(r.transport, null);
      assert.equal(r.sabProtoWriter, null);
    } finally {
      r.stop();
    }
  });

  test('both runner families provide the _driveBoardPin bus service', async () => {
    const avr = new AVRRunner(
      HEX,
      [unoBoard(), { id: 'led1', type: 'openhw-led', attrs: {} }],
      [],
      noop,
      { boardId: 'uno1' },
    );
    try {
      const ledA = avr.instances.get('led1');
      assert.equal(typeof ledA._driveBoardPin, 'function');
      ledA._driveBoardPin('8', true); // port set + repropagate, never throws
      ledA._driveBoardPin('8', false);
    } finally {
      avr.stop();
    }
    const { RetroRunner } = await import('../../../src/worker/runners/retro-runner.ts');
    const retro = new RetroRunner(
      '',
      [{ id: 'r85', type: 'openhw-8085', attrs: {} }, { id: 'led1', type: 'openhw-led', attrs: {} }],
      [],
      noop,
      { boardId: 'r85', boardType: 'openhw-8085' },
    );
    try {
      const ledR = retro.instances.get('led1');
      assert.equal(typeof ledR._driveBoardPin, 'function');
      ledR._driveBoardPin('L2', true); // idle engine in vitest: safe no-op
    } finally {
      retro.stop();
    }
  });
});
