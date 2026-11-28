import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  allocateStateSab,
  SAB_LAYOUT_VERSION,
  SAB_H_PROTO_OFF,
  SAB_H_PROTO_LEN,
  SabProtocolWriter,
} from '../../../src/worker/sab/layout.ts';
import {
  readProtocolRing,
  readRiver,
  getSabDiag,
  createSabCursor,
} from '../../../src/pages/simulationpage/utils/sabReader.js';
import {
  PROTO_BUS_I2C,
  PROTO_FLAG_ACK,
  i2cRecord,
} from '../../../src/worker/hal/protocol-frames.ts';

describe('protocol-lane ring (SAB v3, plan §11.1)', () => {
  test('v3 appends the region without moving earlier offsets', () => {
    assert.equal(SAB_LAYOUT_VERSION, 3);
    const alloc = allocateStateSab(['led1'], 64, [
      { boardId: 'b1', boardIdx: 0, pins: ['L0', 'L1'] },
    ]);
    const diag = getSabDiag(alloc.buffer);
    assert.equal(diag.version, 3);
    const u32 = new Uint32Array(alloc.buffer);
    const protoBase = u32[SAB_H_PROTO_OFF];
    const protoLen = u32[SAB_H_PROTO_LEN];
    assert.ok(protoBase > alloc.displayDescOffset);
    assert.ok(protoLen > 8);
    // Writer resolves geometry from the header alone (no options needed).
    const writer = new SabProtocolWriter(alloc.buffer);
    for (let i = 0; i < 300; i += 1) {
      assert.equal(writer.push(i2cRecord(0x3c, i, false, true, i)), true);
    }
    const page = readProtocolRing(alloc.buffer, 0, 64);
    assert.equal(page.records.length, 64);
    assert.equal(page.head, 300);
    assert.equal(page.skipped, 236);
    const first = page.records[0];
    assert.equal(first.bus, PROTO_BUS_I2C);
    assert.ok(first.flags & PROTO_FLAG_ACK);
    assert.equal(first.address, 0x3c);
    assert.equal(first.v0, 236);
    // readRiver carries the lane with accounting.
    const river = readRiver(alloc.buffer, {
      boardPinMaps: [{ boardId: 'b1', pins: ['L0', 'L1'] }],
      offsets: { led1: 0 },
      cursor: createSabCursor(),
      protocolSinceHead: 300,
      protocolMax: 64,
    });
    assert.equal(river.header.version, 3);
    assert.deepEqual(river.protocol.records, []);
    assert.equal(river.protocol.skipped, 0);
    assert.equal(river.skipped.protocol, 0);
  });

  test('absent region (v1/v2 buffers) reads as empty, never throws', () => {
    const alloc = allocateStateSab(['led1'], 64, [
      { boardId: 'b1', boardIdx: 0, pins: ['L0'] },
    ]);
    // Simulate a v2 buffer: zero the v3 header words.
    const u32 = new Uint32Array(alloc.buffer);
    u32[SAB_H_PROTO_OFF] = 0;
    u32[SAB_H_PROTO_LEN] = 0;
    assert.deepEqual(readProtocolRing(alloc.buffer, 0, 64), []);
    const writer = new SabProtocolWriter(alloc.buffer);
    assert.equal(writer.push(i2cRecord(0x3c, 1, false, true, 1)), false);
    const river = readRiver(alloc.buffer, {
      boardPinMaps: [{ boardId: 'b1', pins: ['L0'] }],
      offsets: { led1: 0 },
      cursor: createSabCursor(),
    });
    assert.deepEqual(river.protocol, []);
  });
});
