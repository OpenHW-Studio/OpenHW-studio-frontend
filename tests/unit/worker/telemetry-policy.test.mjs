import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  TELEMETRY_SCHEMA_VERSION,
  validateTelemetrySchema,
  collectComponentTelemetry,
  getUnifiedComponentSyncState,
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
});
