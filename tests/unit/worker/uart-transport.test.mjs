import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { SabSerialRing } from '../../../src/worker/sab/layout.ts';
import {
  UART_TRANSPORT_STRIDE_B,
  bindUartTransportRings,
  createUartTransport,
  uartKindFromSource,
  uartSourceFromKind,
  uartTransportDrain,
  uartTransportPushRx,
  uartTransportPushTx,
} from '../../../src/worker/uart-transport.ts';

// UART SAB-ring transport contract, headless:
// framing preserves routing flavors; layout slots never overlap; drain
// reproduces exact inject pairs in order.
describe('uart SAB-ring transport', () => {
  test('kind framing round-trips all source labels', () => {
    assert.equal(uartSourceFromKind(uartKindFromSource('uart0')), 'uart0');
    assert.equal(uartSourceFromKind(uartKindFromSource('uart1')), 'uart1');
    assert.equal(uartSourceFromKind(uartKindFromSource('softserial')), 'softserial');
    assert.equal(uartSourceFromKind(uartKindFromSource('SOFT-UART')), 'softserial');
    assert.equal(uartSourceFromKind(uartKindFromSource('weird-label')), 'uart0');
    assert.equal(uartSourceFromKind(uartKindFromSource(undefined)), 'uart0');
  });

  test('layout slots are disjoint across boards', () => {
    const t = createUartTransport(3);
    assert.ok(t, 'transport allocates');
    assert.equal(t.offsets.length, 3);
    const spans = t.offsets.map((o) => [o.txOff, o.txOff + 8 + 4096, o.rxOff, o.rxOff + 8 + 4096]);
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        const [a0, a1, a2, a3] = spans[i];
        const [b0, b1, b2, b3] = spans[j];
        assert.ok(a1 <= b0 && a3 <= b0, `board ${i} fully before board ${j}`);
      }
    }
    assert.equal(UART_TRANSPORT_STRIDE_B, 2 * (8 + 4096));
  });

  test('tx push + drain reproduces pairs in order', () => {
    const t = createUartTransport(2);
    const { tx } = bindUartTransportRings(t.sab, t.offsets[1]);
    const pairs = [[0, 65], [0, 66], [2, 67], [1, 68], [0, 10]];
    for (const [k, v] of pairs) assert.ok(uartTransportPushTx(tx, k, v));
    const got = [];
    const n = uartTransportDrain(tx, (k, v) => got.push([k, v]));
    assert.equal(n, pairs.length);
    assert.deepEqual(got, pairs);
    assert.equal(tx.pending(), 0);
  });

  test('rx ring is independent from tx ring of the same board', () => {
    const t = createUartTransport(1);
    const { tx, rx } = bindUartTransportRings(t.sab, t.offsets[0]);
    uartTransportPushRx(rx, 0, 0x55);
    uartTransportPushTx(tx, 2, 0xaa);
    const rxGot = [];
    uartTransportDrain(rx, (k, v) => rxGot.push([k, v]));
    assert.deepEqual(rxGot, [[0, 0x55]]);
    const txGot = [];
    uartTransportDrain(tx, (k, v) => txGot.push([k, v]));
    assert.deepEqual(txGot, [[2, 0xaa]]);
  });

  test('drain on null/empty rings is a safe no-op', () => {
    assert.equal(uartTransportDrain(null, () => { throw new Error('must not run'); }), 0);
    const t = createUartTransport(1);
    const { tx } = bindUartTransportRings(t.sab, t.offsets[0]);
    assert.equal(uartTransportDrain(tx, () => { throw new Error('must not run'); }), 0);
    assert.equal(uartTransportPushTx(null, 0, 65), false);
  });

  test('wrap-around preserves pair order at capacity', () => {
    const sab = new SharedArrayBuffer(8 + 16);
    const ring = new SabSerialRing(sab, 0, 16);
    // Fill exactly to capacity with pairs, then drain half, push more.
    for (let i = 0; i < 8; i++) { ring.pushByte(0); ring.pushByte(65 + i); }
    const first = [];
    uartTransportDrain(ring, (k, v) => first.push([k, v]), 4);
    assert.deepEqual(first, [[0, 65], [0, 66], [0, 67], [0, 68]]);
    for (let i = 8; i < 12; i++) { ring.pushByte(1); ring.pushByte(65 + i); }
    const rest = [];
    uartTransportDrain(ring, (k, v) => rest.push([k, v]), 8);
    assert.deepEqual(rest, [[0, 69], [0, 70], [0, 71], [0, 72], [1, 73], [1, 74], [1, 75], [1, 76]]);
  });
});
