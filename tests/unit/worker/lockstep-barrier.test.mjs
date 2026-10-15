import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  BARRIER_STEP_IDX,
  barrierAckIdx,
  barrierCollectAcks,
  barrierPostStep,
  barrierSkew,
  barrierTryStep,
  createBarrier,
} from '../../../src/worker/lockstep-barrier.ts';

// Phase B barrier contract, headless (no Atomics.wait blocking: collect
// runs with pre-acked cells or zero timeout; tryStep never blocks).
describe('lockstep SAB-Atomics barrier (Phase B)', () => {
  test('layout: step cell 0, dense per-board ack cells', () => {
    const b = createBarrier(3);
    assert.ok(b, 'barrier allocates');
    assert.equal(b.cells.length, 4);
    assert.equal(BARRIER_STEP_IDX, 0);
    assert.equal(barrierAckIdx(0), 1);
    assert.equal(barrierAckIdx(2), 3);
  });

  test('postStep publishes the sequence + tryStep steps and acks exactly once', () => {
    const b = createBarrier(2);
    const stepped = [];
    barrierPostStep(b.cells, 1);
    assert.equal(b.cells[0], 1);
    // Advanced (0 → 1): steps once, acks, returns the new sequence.
    assert.equal(barrierTryStep(b.cells, barrierAckIdx(0), 0, () => stepped.push('x')), 1);
    assert.deepEqual(stepped, ['x']);
    assert.equal(b.cells[barrierAckIdx(0)], 1);
    // Same sequence again: no double-step.
    assert.equal(
      barrierTryStep(b.cells, barrierAckIdx(0), 1, () => stepped.push('x')),
      1,
    );
    assert.deepEqual(stepped, ['x']);
  });

  test('collect returns observed acks without blocking when already acked', () => {
    const b = createBarrier(2);
    barrierPostStep(b.cells, 5);
    b.cells[barrierAckIdx(0)] = 5;
    b.cells[barrierAckIdx(1)] = 5;
    const t0 = Date.now();
    const acks = barrierCollectAcks(b.cells, [barrierAckIdx(0), barrierAckIdx(1)], 5, 30);
    assert.deepEqual(acks, [5, 5]);
    assert.ok(Date.now() - t0 < 25, 'no blocking when acked');
  });

  test('collect is bounded: zero timeout never waits on a straggler', () => {
    const b = createBarrier(2);
    barrierPostStep(b.cells, 7);
    b.cells[barrierAckIdx(0)] = 7; // board 0 acked
    // board 1 silent (still 0)
    const t0 = Date.now();
    const acks = barrierCollectAcks(b.cells, [barrierAckIdx(0), barrierAckIdx(1)], 7, 0);
    assert.deepEqual(acks, [7, 0]);
    assert.ok(Date.now() - t0 < 25, 'straggler never stalls collect');
    const { minAck, skew } = barrierSkew(acks, 7);
    assert.equal(minAck, 0);
    assert.equal(skew, 7);
  });

  test('skew is zero when all boards acked the current sequence', () => {
    const { minAck, skew } = barrierSkew([4, 4, 4], 4);
    assert.equal(minAck, 4);
    assert.equal(skew, 0);
  });
});
