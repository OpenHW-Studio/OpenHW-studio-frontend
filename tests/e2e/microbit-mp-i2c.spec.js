import { test, expect } from '@playwright/test';

// MicroPython-language I2C on the micro:bit: the guest's `i2c.write()`
// (TWIM0) must drive the host SSD1306 model through the shared I2C bridge.
// Same bus/fixture as the fixed-bin microbit-cells OLED case, but the bus
// traffic comes from a real main.py interpreter, not a prebuilt .bin.
const MP_MAIN = `
from microbit import i2c
i2c.write(0x3c, bytes([0x00,0xae]))
i2c.write(0x3c, bytes([0x00,0xd5,0x80]))
i2c.write(0x3c, bytes([0x00,0xa8,0x3f]))
i2c.write(0x3c, bytes([0x00,0xd3,0x00]))
i2c.write(0x3c, bytes([0x00,0x40,0x00]))
i2c.write(0x3c, bytes([0x00,0x8d,0x14]))
i2c.write(0x3c, bytes([0x00,0x20,0x00]))
i2c.write(0x3c, bytes([0x00,0xa1]))
i2c.write(0x3c, bytes([0x00,0xc8]))
i2c.write(0x3c, bytes([0x00,0xda,0x12]))
i2c.write(0x3c, bytes([0x00,0x81,0xcf]))
i2c.write(0x3c, bytes([0x00,0xd9,0xf1]))
i2c.write(0x3c, bytes([0x00,0xdb,0x40]))
i2c.write(0x3c, bytes([0x00,0xa4]))
i2c.write(0x3c, bytes([0x00,0xa6]))
i2c.write(0x3c, bytes([0x00,0xaf]))
print("MP_I2C_INIT")
i2c.write(0x3c, bytes([0x40] + [0xff] * 128))
print("MP_I2C_PIXELS")
`.trim() + '\n';

test.describe('micro:bit v2 MicroPython I2C (SSD1306)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('guest i2c.write lights the host OLED and prints both needles', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript(() => window.localStorage.setItem('openhw-tour-completed', 'true'));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });

    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { env: 'micropython' }, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'mb1:P19', to: 'oled1:SCL' },
        { from: 'mb1:P20', to: 'oled1:SDA' },
        { from: 'mb1:3V3', to: 'oled1:VCC' },
        { from: 'mb1:GND', to: 'oled1:GND' },
      ],
      code: '// main.py installed below',
    }));
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((mp) => window.OpenHWE2E.setupCircuitBoards({
      extra: { mb1: mp },
    }), MP_MAIN);
    expect(setup2.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, selectTelemetry: ['oled1'], serialNeedle: 'MP_I2C_PIXELS', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MP-I2C reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('MP-I2C serial tail:', JSON.stringify((verdict.serial || '').slice(-800)));
    expect(verdict.pass).toBe(true);
    expect(verdict.reasons || []).toEqual([]);
    expect(verdict.serial || '').toContain('MP_I2C_INIT');

    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    console.log('MP-I2C OLED telemetry:', JSON.stringify(oled || null).slice(0, 600));
    expect(oled).toBeTruthy();
    const custom = oled.details?.custom || oled.details?.metrics?.custom || {};
    const sum = String(oled.summary || '') + JSON.stringify(oled.details || {});
    expect(/displayOn[":\s]+true/i.test(sum)).toBe(true);
    expect(/updateCount[":\s]+[1-9]/.test(sum)).toBe(true);
    const fill = Number(custom.vramFillPercentage ?? custom.vramFillPercent ?? NaN);
    console.log('MP-I2C vramFill:', fill);
    expect(Number.isFinite(fill)).toBe(true);
    expect(fill).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
