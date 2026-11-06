import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  allocateStateSab,
  boardSerialOffsets,
  boardDebugOffset,
  SAB_BOARD_SERIAL_STRIDE_B,
  SAB_SERIAL_RING_B,
  SAB_DEBUG_BYTES,
  SabSerialRing,
  SabDebugWriter,
} from '../../../src/worker/sab/layout.ts';

describe('sab v2 per-board regions', () => {
  test('each board gets disjoint serial + debug regions', () => {
    const alloc = allocateStateSab(
      ['uno1', 'pico1'],
      1024,
      [
        { boardId: 'uno1', boardIdx: 0, pins: ['0', '1', 'A0'] },
        { boardId: 'pico1', boardIdx: 1, pins: ['GP0', 'GP1'] },
      ],
    );
    assert.equal(alloc.numBoards, 2);
    assert.deepEqual(alloc.boardIds, ['uno1', 'pico1']);

    const b0 = boardSerialOffsets(alloc, 0);
    const b1 = boardSerialOffsets(alloc, 1);
    assert.equal(b1.rx - b0.rx, SAB_BOARD_SERIAL_STRIDE_B);
    assert.equal(b0.tx - b0.rx, 8 + SAB_SERIAL_RING_B);
    assert.equal(b1.tx - b1.rx, 8 + SAB_SERIAL_RING_B);
    // No overlap between board spans.
    assert.ok(b0.tx + 8 + SAB_SERIAL_RING_B <= b1.rx);

    const d0 = boardDebugOffset(alloc, 0);
    const d1 = boardDebugOffset(alloc, 1);
    assert.equal(d1 - d0, SAB_DEBUG_BYTES);

    // Legacy aliases still mirror board 0.
    assert.equal(alloc.serialRxOffset, alloc.boardSerialBase);
    assert.equal(alloc.debugOffset, alloc.boardDebugBase);

    // Rings are independently writable: bytes in board 1 don't leak to 0.
    const rx0 = new SabSerialRing(alloc.buffer, b0.rx);
    const rx1 = new SabSerialRing(alloc.buffer, b1.rx);
    rx0.pushByte(0x41);
    rx1.pushByte(0x42);
    rx1.pushByte(0x43);
    assert.deepEqual(rx0.drain(8), [0x41]);
    assert.deepEqual(rx1.drain(8), [0x42, 0x43]);

    // Debug writers are independent too.
    const dw0 = new SabDebugWriter(alloc.buffer, d0);
    const dw1 = new SabDebugWriter(alloc.buffer, d1);
    dw0.write({ pc: 0x1111, sp: 0, cycles: 10, halted: false });
    dw1.write({ pc: 0x2222, sp: 0, cycles: 20, halted: true });
    const u0 = new Uint32Array(alloc.buffer, d0, 6);
    const u1 = new Uint32Array(alloc.buffer, d1, 6);
    assert.equal(u0[0], 0x1111);
    assert.equal(u1[0], 0x2222);
    assert.equal(u1[5], 1);
  });

  test('single-board alloc stays shape-compatible', () => {
    const alloc = allocateStateSab(['a'], 64, []);
    assert.equal(alloc.numBoards, 1);
    assert.ok(alloc.bufferSize >= 4096);
    assert.equal(alloc.serialRxOffset, alloc.boardSerialBase);
  });
});
