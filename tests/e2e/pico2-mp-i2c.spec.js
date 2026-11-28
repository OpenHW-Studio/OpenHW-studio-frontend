import { test, expect } from '@playwright/test';

// MicroPython on Pico 2 (RP2350 M33): machine.I2C against the same mirror
// bridge as Arduino-C, proving the M33 MicroPython pipeline end to end.
const MP2_MAIN = `
from machine import I2C, Pin
print("MP2_READY")
try:
    i2c = I2C(0, scl=Pin(5), sda=Pin(4), freq=100000)
    print("MP2_I2C_OK")
except Exception as e:
    print("MP2_I2C_FAIL:", e)
    i2c = None

print("MP2_READY2")
print("MP2_SCAN: []")
ADDR = 0x3C
i2c.writeto(ADDR, b'\\x00\\xae')
i2c.writeto(ADDR, b'\\x00\\xd5\\x80')
i2c.writeto(ADDR, b'\\x00\\xa8\\x3f')
i2c.writeto(ADDR, b'\\x00\\xd3\\x00')
i2c.writeto(ADDR, b'\\x00\\x40')
i2c.writeto(ADDR, b'\\x00\\x8d\\x14')
i2c.writeto(ADDR, b'\\x00\\x20\\x00')
i2c.writeto(ADDR, b'\\x00\\xa1')
i2c.writeto(ADDR, b'\\x00\\xc8')
i2c.writeto(ADDR, b'\\x00\\xda\\x12')
i2c.writeto(ADDR, b'\\x00\\x81\\xcf')
i2c.writeto(ADDR, b'\\x00\\xd9\\xf1')
i2c.writeto(ADDR, b'\\x00\\xdb\\x40')
i2c.writeto(ADDR, b'\\x00\\xa4')
i2c.writeto(ADDR, b'\\x00\\xa6')
i2c.writeto(ADDR, b'\\x00\\xaf')
print("MP2_DRAWN")
i2c.writeto(ADDR, b'\\x40' + b'\\xff' * 128)
print("MP2_PIXELS")
for _ in range(5):
    print("MP2_TICK")
`.trim() + '\n';

test.describe('MicroPython I2C (pico 2 OLED)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('machine.I2C drives the OLED via the mirror bridge', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico2', type: 'openhw-pico-2', attrs: { env: 'micropython' }, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'pico2:GP4', to: 'oled1:SDA' },
        { from: 'pico2:GP5', to: 'oled1:SCL' },
        { from: 'pico2:3V3', to: 'oled1:VCC' },
        { from: 'pico2:GND', to: 'oled1:GND' },
      ],
      code: '//micropython-placeholder',
    }));
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((mp) => window.OpenHWE2E.setupCircuitBoards({
      extra: { pico2: mp },
    }), MP2_MAIN);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, selectTelemetry: ['oled1'], serialNeedle: 'MP2_TICK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MP2 reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('MP2_DRAWN');
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('MP2-OLED vramFill:', ocustom.vramFillPercentage, 'power:', ocustom.powerStatus);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
