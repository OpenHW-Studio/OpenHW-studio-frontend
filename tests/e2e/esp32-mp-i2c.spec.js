import { test, expect } from '@playwright/test';

// MicroPython language axis (live): ESP32 runs machine.I2C against the same
// peripheral taps as Arduino-C (same DW silicon), proving the language
// pipeline (MP image + REPL injection) end to end. Mirrors pico-mp-i2c:
// SSD1306 init lights vramFill; scan is informational.
const MP_MAIN = `from machine import I2C, Pin
print("MP_READY")
try:
    i2c = I2C(0, scl=Pin(22), sda=Pin(21), freq=100000)
    print("MP_I2C_OK")
except Exception as e:
    print("MP_I2C_FAIL:", e)
    i2c = None

print("MP_READY2")
try:
    print("MP_SCAN:", i2c.scan())
except Exception as e:
    print("MP_SCAN_FAIL:", e)
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
print("MP_DRAWN")
i2c.writeto(ADDR, b'\\\\x40' + b'\\\\xff' * 128)
print("MP_PIXELS")
for _ in range(5):
    print("MP_TICK")
`;

test.describe('MicroPython I2C (esp32 OLED)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('machine.I2C drives the OLED via the peripheral taps', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: { env: 'micropython' }, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'esp1:21', to: 'oled1:SDA' },
        { from: 'esp1:22', to: 'oled1:SCL' },
        { from: 'esp1:3V3', to: 'oled1:VCC' },
        { from: 'esp1:GND.1', to: 'oled1:GND' },
      ],
      code: '//micropython-placeholder',
    }));
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((mp) => window.OpenHWE2E.setupCircuitBoards({
      extra: { esp1: mp },
    }), MP_MAIN);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 240000, selectTelemetry: ['oled1'], serialNeedle: 'MP_TICK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPMP serial head:', JSON.stringify((verdict.serial || '').slice(0, 400)));
    console.log('ESPMP serial tail:', JSON.stringify((verdict.serial || '').slice(-1500)));
    console.log('ESPMP markers:', JSON.stringify({ ready: (verdict.serial||'').includes('MP_READY'), i2cok: (verdict.serial||'').includes('MP_I2C_OK'), drawn: (verdict.serial||'').includes('MP_DRAWN') }));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('MP_DRAWN');
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('ESPMP-OLED vramFill:', ocustom.vramFillPercentage);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
