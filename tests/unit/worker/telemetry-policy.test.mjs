import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  TELEMETRY_SCHEMA_VERSION,
  validateTelemetrySchema,
  collectComponentTelemetry,
  getUnifiedComponentSyncState,
  telemetrySamplePolicy,
  shouldEmitTelemetrySample,
} from '../../../src/worker/registries/component-registry.ts';
import { LEDLogic } from '@openhw/emulator/src/components/openhw-led/logic';

function makeLed() {
  const led = new LEDLogic('led1', {
    type: 'openhw-led',
    attrs: {},
    pins: [{ id: 'A' }, { id: 'K' }],
  });
  led.setPinVoltage('A', 5.0);
  led.setPinVoltage('K', 0.0);
  return led;
}

describe('telemetry enforcement (plan §5.5, Phase 3 seed)', () => {
  test('schema validator accepts versioned payloads, rejects drift', () => {
    assert.equal(TELEMETRY_SCHEMA_VERSION, 1);
    assert.deepEqual(validateTelemetrySchema({}), { ok: true, reasons: [] });
    assert.equal(validateTelemetrySchema({ schemaVersion: 1, telemetryData: {} }).ok, true);
    assert.equal(validateTelemetrySchema({ telemetryData: {} }).ok, false);
    assert.equal(validateTelemetrySchema({ schemaVersion: 99 }).ok, false);
    assert.equal(validateTelemetrySchema({ schemaVersion: 1, telemetryData: 42 }).ok, false);
    assert.equal(validateTelemetrySchema(null).ok, false);
    assert.equal(validateTelemetrySchema([1]).ok, false);
  });

  test('collected telemetry validates when enabled', () => {
    const led = makeLed();
    led.telemetryEnabled = true;
    const out = collectComponentTelemetry(led, 'detail', undefined);
    const res = validateTelemetrySchema(out);
    assert.equal(res.ok, true, JSON.stringify(res.reasons));
  });

  test('disabled telemetry changes nothing observable (parity)', () => {
    const on = makeLed();
    on.telemetryEnabled = true;
    on.update(1000, [], new Map());
    on.update(2000, [], new Map());
    const off = makeLed();
    off.telemetryEnabled = false;
    off.update(1000, [], new Map());
    off.update(2000, [], new Map());
    // Sync state (what the sim publishes) is identical either way.
    assert.deepEqual(getUnifiedComponentSyncState(off), getUnifiedComponentSyncState(on));
    // Disabled collection stays empty (bandwidth parity: nothing sent).
    assert.deepEqual(collectComponentTelemetry(off, 'detail', undefined), {});
  });

  test('sampling policy matches the wired ingest semantics', () => {
    // Defaults: 250 ms window at 1x, Delta bypasses.
    assert.deepEqual(telemetrySamplePolicy('detail', 250, 1.0), { throttleMs: 250, bypassThrottle: false });
    assert.deepEqual(telemetrySamplePolicy('delta', 250, 1.0), { throttleMs: 250, bypassThrottle: true });
    // Speed scaling with 50 ms floor; junk inputs fall back safely.
    assert.equal(telemetrySamplePolicy('detail', 250, 2.0).throttleMs, 125);
    assert.equal(telemetrySamplePolicy('detail', 250, 0).throttleMs, 250);
    assert.equal(telemetrySamplePolicy('detail', NaN, NaN).throttleMs, 250);
    assert.equal(telemetrySamplePolicy('detail', 10, 1.0).throttleMs, 50);
    // Gate: emits on/after the window, suppresses inside it, never in Delta.
    const p = telemetrySamplePolicy('detail', 250, 1.0);
    assert.equal(shouldEmitTelemetrySample(0, 100, p), false);
    assert.equal(shouldEmitTelemetrySample(0, 250, p), true);
    const d = telemetrySamplePolicy('delta', 250, 1.0);
    assert.equal(shouldEmitTelemetrySample(0, 0, d), true);
  });
});
