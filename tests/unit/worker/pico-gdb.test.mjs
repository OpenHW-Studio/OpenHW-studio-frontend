import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  gdbChecksum,
  gdbDecodeThumbStore,
  gdbPacketize,
  gdbParseStopReply,
  gdbParseU32le,
  PicoGdb,
} from '../../../src/worker/pico-gdb.ts';

// GDB-RSP driver contract, headless (injected in-memory transport).
function memTransport() {
  const rx = [];
  const tx = [];
  return {
    rx,
    tx,
    t: {
      pushRx: (b) => { for (const x of b) rx.push(x); },
      popTx: (n) => Uint8Array.from(tx.splice(0, n)),
      txLen: () => tx.length,
      poll: () => 2,
    },
    answer: (s) => { for (let i = 0; i < s.length; i++) tx.push(s.charCodeAt(i)); },
  };
}

describe('pico GDB-RSP driver', () => {
  test('packet framing checksum matches RSP', () => {
    assert.equal(gdbChecksum('Z2,40044010,2'), 'a3');
    const p = gdbPacketize('c');
    assert.equal(String.fromCharCode(...p), '$c#63');
  });

  test('stop replies parse watch address + type', () => {
    assert.deepEqual(gdbParseStopReply('$T05watch:40044010;thread:1;#ab'), { type: 'watch', addr: 0x40044010 });
    assert.deepEqual(gdbParseStopReply('$T05thread:1;#cd'), null);
    assert.deepEqual(gdbParseStopReply('garbage'), null);
  });

  test('LE u32 parse handles target byte order + x-slots', () => {
    assert.equal(gdbParseU32le('78563412'), 0x12345678);
    assert.ok(Number.isNaN(gdbParseU32le('xxxxxxxx')));
  });

  test('Thumb store decode covers compiler shapes', () => {
    // STRB r3, [r0, #1] → 01110 000 011 00001 = 0x7041
    assert.deepEqual(gdbDecodeThumbStore(0x7041, 0), { kind: 'strb-imm', rt: 1, sizeBytes: 1 });
    // STRH r2, [r1, #0x10] → 10000 001 010 ... = 0x8288-ish
    assert.deepEqual(gdbDecodeThumbStore(0x8288, 0), { kind: 'strh-imm', rt: 0, sizeBytes: 2 });
    // STR r4, [r5] → 0x602C
    assert.deepEqual(gdbDecodeThumbStore(0x602c, 0), { kind: 'str-imm', rt: 4, sizeBytes: 4 });
    // T2 STRB.W r7, [r6, #0x10]: first half 0xf886, rt in next[15:12]
    assert.deepEqual(gdbDecodeThumbStore(0xf886, 0x7610), { kind: 'strb-imm', rt: 7, sizeBytes: 1 });
    // ADD (non-store) → unknown, never fatal
    assert.deepEqual(gdbDecodeThumbStore(0x1c41, 0), { kind: 'unknown', rt: -1, sizeBytes: 0 });
  });

  test('exchange round-trips through the injected transport', () => {
    const m = memTransport();
    const g = new PicoGdb(m.t);
    m.answer('$OK#9a');
    assert.equal(g.setWriteWatchpoint(0x40044010, 2), '$OK#9a');
    assert.ok(m.rx.length > 0, 'packet pushed');
    const sent = String.fromCharCode(...m.rx);
    assert.ok(sent.startsWith('$Z2,40044010,2#'), `framed: ${sent}`);
  });

  test('readRegs parses 17 LE words', () => {
    const m = memTransport();
    const g = new PicoGdb(m.t);
    const words = Array.from({ length: 17 }, (_, i) => i + 1);
    const hex = words.map((w) => {
      const b = [w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, (w >> 24) & 0xff];
      return b.map((x) => x.toString(16).padStart(2, '0')).join('');
    }).join('');
    m.answer(`$${hex}#00`);
    assert.deepEqual(g.readRegs(), words);
  });
});
