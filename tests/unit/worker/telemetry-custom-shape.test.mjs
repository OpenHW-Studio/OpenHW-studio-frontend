import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { Lcd2004I2CLogic } from '@openhw/emulator/src/components/openhw-lcd2004-i2c/logic';
import { collectComponentTelemetry } from '../../../src/worker/registries/component-registry.ts';

describe('debug custom shape', () => {
  test('dump metrics.custom after real traffic', () => {
    const lcd = new Lcd2004I2CLogic('lcd1', {
      type: 'openhw-lcd2004-i2c', attrs: {},
      pins: [{ id: 'GND' }, { id: 'VCC' }, { id: 'SDA' }, { id: 'SCL' }],
    });
    const pair = (b, rs) => {
      const base = (rs ? 0x01 : 0x00) | 0x08;
      const hi = ((b >> 4) & 0xf) << 4 | base;
      const lo = ((b & 0xf)) << 4 | base;
      return [hi | 0x04, hi & ~0x04, lo | 0x04, lo & ~0x04];
    };
    const stream = [];
    for (const b of [0x33, 0x32, 0x28, 0x0c, 0x06, 0x01]) stream.push(...pair(b, false));
    for (const b of [0x48, 0x69]) stream.push(...pair(b, true));
    lcd.onI2CStart(0x27, false);
    for (const by of stream) lcd.onI2CByte(0x27, by);
    lcd.onI2CStop();
    lcd.update(3000000, [], new Map());
    lcd.telemetryEnabled = true;
    const out = collectComponentTelemetry(lcd, 'detail', undefined);
    // Transport-shape contract: custom telemetry rides inside
    // telemetryData.metrics.custom (NOT top-level custom), and decoded
    // content is also in telemetryData.state. Consumers must read both.
    assert.equal(out.telemetryData?.metrics?.custom?.textContent?.includes('Hi'), true);
    assert.equal(String((out.telemetryData?.state?.lines || [])[0] || '').startsWith('Hi'), true);
  });
});
