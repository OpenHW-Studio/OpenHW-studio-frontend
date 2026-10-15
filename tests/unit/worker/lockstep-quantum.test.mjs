import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { AVRRunner } from '../../../src/worker/runners/avr-runner.ts';
import { ArmRunnerBase } from '../../../src/worker/runners/arm-runner-base.ts';

// Phase A lockstep contract, headless:
//   1. stepQuantum(simMs) advances simulated time deterministically —
//      two identically-driven runners land on identical cycle counts.
//   2. The externalStepping guard swallows wall-driven ticks (a pending
//      setTimeout firing after handoff must not advance or reschedule).
//   3. ARM-base runners expose the same contract (shared scheduler calls
//      both families uniformly).
class ProbeArm extends ArmRunnerBase {
  engine = {
    sampleGpioOut: () => null,
    setGpioInput() {},
    drainUartOut: () => [],
  };
  uartTxPins = [];
  uartRxPins = [];
}

function avrPair() {
  const mk = () => new AVRRunner(
    ':00000001FF',
    [{ id: 'uno1', type: 'openhw-arduino-uno', attrs: {} }],
    [],
    () => {},
    { boardId: 'uno1' },
  );
  const a = mk();
  const b = mk();
  for (const r of [a, b]) {
    r.externalStepping = true;
    try { r.stop?.(); } catch { /* ignore */ }
    r.running = true;
  }
  return [a, b];
}

describe('lockstep stepQuantum (Phase A)', () => {
  test('identical quanta advance two AVR runners identically', () => {
    const [a, b] = avrPair();
    // NB: construction runs a few wall ticks before handoff, so bases may
    // differ — lockstep promises equal ADVANCE per quantum, not equal base.
    const baseA = a.cpu.cycles;
    const baseB = b.cpu.cycles;
    for (let i = 0; i < 5; i += 1) {
      a.stepQuantum(8);
      b.stepQuantum(8);
    }
    assert.equal(a.cpu.cycles - baseA, b.cpu.cycles - baseB);
    assert.ok(a.cpu.cycles - baseA > 0, 'cycles advanced');
    for (const r of [a, b]) { try { r.stop?.(); } catch { /* ignore */ } }
  });

  test('externalStepping guard swallows wall-driven ticks', async () => {
    const [a] = avrPair();
    const before = a.cpu.cycles;
    a.runLoop();
    assert.equal(a.cpu.cycles, before, 'unguarded wall tick must not advance');
    a.stepQuantum(8);
    assert.ok(a.cpu.cycles > before, 'quantum tick advances');
    try { a.stop?.(); } catch { /* ignore */ }
  });

  test('ARM-base runners expose the same stepQuantum contract', () => {
    const mk = () => new ProbeArm(
      ':00000001FF',
      [{ id: 'b1', type: 'openhw-arduino-uno', attrs: {} }],
      [],
      () => {},
      { boardId: 'b1' },
    );
    const a = mk();
    const b = mk();
    for (const r of [a, b]) {
      r.externalStepping = true;
      r.running = true;
    }
    for (let i = 0; i < 5; i += 1) {
      a.stepQuantum(8);
      b.stepQuantum(8);
    }
    assert.equal(a.simCycleCount, b.simCycleCount);
    assert.ok(a.simCycleCount > 0, 'sim cycles advanced');
    const before = a.simCycleCount;
    a.runLoop();
    assert.equal(a.simCycleCount, before, 'unguarded wall tick must not advance');
  });
});
