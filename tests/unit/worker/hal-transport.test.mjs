import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  allocateStateSab,
  boardSerialOffsets,
  SabStateWriter,
  SabCommandWriter,
  SabCommandReader,
  SabEventWriter,
  SabEventReader,
  SabPinWriter,
  SabSerialRing,
} from '../../../src/worker/sab/layout.ts';
import {
  readPinRegion,
  readAllSlots,
  drainSerialRingCounted,
  readTelemetryRing,
} from '../../../src/pages/simulationpage/utils/sabReader.js';
import {
  SabTransport,
  MessageTransport,
  commandRecordToEnvelope,
} from '../../../src/worker/hal/transport.ts';

const CLOCK = () => 1000;

function buildSabSide() {
  const alloc = allocateStateSab(
    ['led1'],
    64,
    [{ boardId: 'b1', boardIdx: 0, pins: ['L0', 'L1'] }],
  );
  const pinIndex = new Map([['L0', 0], ['L1', 1]]);
  const pinWriter = new SabPinWriter(alloc.buffer);
  pinWriter.bindGeometry(alloc.pinBitWords, alloc.analogBase);
  const txOff = boardSerialOffsets(alloc, 0).tx;
  const cmdBuf = SabCommandWriter.create();
  const cmdWriter = new SabCommandWriter(cmdBuf);
  cmdWriter.enqueueInteract(3, 'press', 11);
  cmdWriter.enqueueSerial('hi', 12);
  const evtBuf = SabEventWriter.create();
  return {
    alloc,
    txOff,
    transport: new SabTransport({
      buffer: alloc.buffer,
      pinIndex,
      pinWriter,
      stateWriter: new SabStateWriter(alloc.buffer),
      serialTx: new SabSerialRing(alloc.buffer, txOff),
      evtWriter: new SabEventWriter(evtBuf),
      cmdReader: new SabCommandReader(cmdBuf),
      railVoltage: 3.3,
      clock: CLOCK,
    }),
    evtReader: new SabEventReader(evtBuf),
  };
}

const OPS = {
  pins: { L0: true, L1: false },
  analog: { L0: 3.3, L1: 0 },
  serial: [65, 66],
  slots: [{ id: 'led1', slot: 0, version: 7, kind: 1, f: [200, 0, 0, 0, 0, 0, 0, 0], i: [1, 0, 0, 0] }],
  telemetry: [{ slot: 0, code: 2, v0: 1.5, v1: 2.5, cycles: 3 }],
  event: {
    schema: 1, lane: 'fault', boardId: 'b1', componentId: 'led1',
    payload: { code: 'burnedOut' }, seq: 0, simTimeMs: 1000,
  },
};

describe('transport parity (SAB vs message twin)', () => {
  test('identical inputs produce identical observable outputs', () => {
    const sab = buildSabSide();
    const msg = new MessageTransport({ clock: CLOCK });

    for (const t of [sab.transport, msg]) {
      t.publishPins('b1', OPS.pins, OPS.analog);
      t.publishSerial('b1', OPS.serial, 'uart0');
      t.publishComponentSlots(OPS.slots);
      t.publishTelemetryRecords(OPS.telemetry);
      t.emitEvent(OPS.event);
    }

    // SAB side, read back through the public river readers.
    const pins = readPinRegion(sab.alloc.buffer, [{ boardId: 'b1', pins: ['L0', 'L1'] }]);
    assert.deepEqual(pins.b1.bits, [0b01]);
    assert.ok(Math.abs(pins.b1.analog[0] - 3.3) < 1e-6);
    assert.equal(pins.b1.analog[1], 0);
    const slots = readAllSlots(sab.alloc.buffer, { led1: 0 });
    assert.equal(slots[0].state.f0, 200);
    assert.equal(slots[0].state.i0, 1);
    const serial = drainSerialRingCounted(sab.alloc.buffer, sab.txOff, 256);
    assert.deepEqual(serial.bytes, OPS.serial);
    assert.equal(serial.skipped, 0);
    const tele = readTelemetryRing(sab.alloc.buffer, 0, 64);
    assert.equal(tele.records.length, 1);
    assert.ok(Math.abs(tele.records[0].v0 - 1.5) < 1e-6);
    assert.equal(tele.skipped, 0);
    const evts = sab.evtReader.drain(10);
    assert.equal(evts.length, 1);
    const evtBody = JSON.parse(evts[0].str);
    assert.equal(evtBody.lane, 'fault');
    assert.equal(evtBody.boardId, 'b1');
    assert.deepEqual(evtBody.payload, { code: 'burnedOut' });

    // Message side carries the same semantics.
    const sent = msg.sent;
    assert.equal(sent.length, 5);
    assert.deepEqual(sent[0].payload.levels, OPS.pins);
    assert.deepEqual(sent[1].payload.bytes, OPS.serial);
    assert.deepEqual(sent[2].payload.frames, OPS.slots);
    assert.deepEqual(sent[3].payload.records, OPS.telemetry);
    assert.equal(sent[4].lane, 'fault');
    assert.deepEqual(sent[4].payload, { code: 'burnedOut' });

    // Commands drain identically shaped envelopes on both sides.
    const sabCmds = sab.transport.drainCommands(10);
    assert.equal(sabCmds.length, 2);
    assert.equal(sabCmds[0].lane, 'control');
    assert.equal(sabCmds[0].payload.op, 1);
    assert.equal(sabCmds[0].payload.event, 'press');
    assert.equal(sabCmds[1].payload.op, 2);
    assert.equal(sabCmds[1].payload.str, 'hi');
    const msgCmds = new MessageTransport({
      clock: CLOCK,
      seedCommands: sabCmds.map((c) => ({ ...c })),
    }).drainCommands(10);
    assert.deepEqual(msgCmds.map((c) => c.payload.op), [1, 2]);

    // Shared command mapping helper is stable.
    const mapped = commandRecordToEnvelope({ op: 9, target: 5, arg0: 1, arg1: 0, cycles: 0, str: '' });
    assert.equal(mapped.lane, 'control');
    assert.equal(mapped.schema, 1);
  });
});
