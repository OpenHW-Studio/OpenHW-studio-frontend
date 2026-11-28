import { test, expect } from '@playwright/test';

// MicroPython on the ESP32-CAM shell: machine.I2C (sda=13, scl=14) drives
// the OLED via the same taps as Arduino-C. MP image + REPL injection are
// board-agnostic (flash offset 0x1000, cam preset rides config.board),
// so no runner change — same shape as esp32-mp-i2c, shell pins only.
const MP_MAIN = `from machine import I2C, Pin
print("MPCAM_READY")
try:
    i2c = I2C(0, scl=Pin(14), sda=Pin(13), freq=100000)
    print("MPCAM_I2C_OK")
except Exception as e:
    print("MPCAM_I2C_FAIL:", e)
    i2c = None

ADDR = 0x3C
i2c.writeto(ADDR, b'\\\\x00\\\\xae')
i2c.writeto(ADDR, b'\\\\x00\\\\xd5\\\\x80')
i2c.writeto(ADDR, b'\\\\x00\\\\xa8\\\\x3f')
i2c.writeto(ADDR, b'\\\\x00\\\\xd3\\\\x00')
i2c.writeto(ADDR, b'\\\\x00\\\\x40')
i2c.writeto(ADDR, b'\\\\x00\\\\x8d\\\\x14')
i2c.writeto(ADDR, b'\\\\x00\\\\x20\\\\x00')
i2c.writeto(ADDR, b'\\\\x00\\\\xa1')
i2c.writeto(ADDR, b'\\\\x00\\\\xc8')
i2c.writeto(ADDR, b'\\\\x00\\\\xda\\\\x12')
i2c.writeto(ADDR, b'\\\\x00\\\\x81\\\\xcf')
i2c.writeto(ADDR, b'\\\\x00\\\\xd9\\\\xf1')
i2c.writeto(ADDR, b'\\\\x00\\\\xdb\\\\x40')
i2c.writeto(ADDR, b'\\\\x00\\\\xa4')
i2c.writeto(ADDR, b'\\\\x00\\\\xa6')
i2c.writeto(ADDR, b'\\\\x00\\\\xaf')
print("MPCAM_DRAWN")
i2c.writeto(ADDR, b'\\\\x40' + b'\\\\xff' * 128)
print("MPCAM_PIXELS")
for _ in range(5):
    print("MPCAM_TICK")
`;

test.describe('MicroPython I2C (esp32-cam OLED)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('machine.I2C drives the OLED on shell pins', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'cam1', type: 'openhw-esp32-cam', attrs: { env: 'micropython' }, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'cam1:13', to: 'oled1:SDA' },
        { from: 'cam1:14', to: 'oled1:SCL' },
        { from: 'cam1:3V3', to: 'oled1:VCC' },
        { from: 'cam1:GND.1', to: 'oled1:GND' },
      ],
      code: '//micropython-placeholder',
    }));
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((mp) => window.OpenHWE2E.setupCircuitBoards({
      extra: { cam1: mp },
    }), MP_MAIN);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 240000, selectTelemetry: ['oled1'], serialNeedle: 'MPCAM_TICK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAMMP serial head:', JSON.stringify((verdict.serial || '').slice(0, 400)));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('MPCAM_DRAWN');
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('CAMMP-OLED vramFill:', ocustom.vramFillPercentage);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
