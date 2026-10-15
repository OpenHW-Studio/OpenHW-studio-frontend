import { test, expect } from '@playwright/test';

// ESP32 I2C (DevKit OLED): first cell over esp32-emu 1.2.0 host taps
// (attachI2cSlave + pollI2c events into the shared I2C bridge).
// Same assert shape as the F1/Pico I2C rows.
test.describe('ESP32 I2C (devkit OLED)', () => {
  test.setTimeout(420000); // 200s run + slow ESP32 boot + compile headroom
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('SSD1306 OLED draws via ESP32 Wire', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/Esp32|ESP32|esp32|error|Error|wasm|WASM|abort|Aborted|failed|warn/i.test(t)) console.log('ESP-CAP:', t.slice(0, 300));
      } catch { /* ignore */ }
    });
    page.on('pageerror', (err) => console.log('ESP-PAGEERROR:', String(err).slice(0, 400)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'esp1:21', to: 'oled1:SDA' },
        { from: 'esp1:22', to: 'oled1:SCL' },
        { from: 'esp1:3V3', to: 'oled1:VCC' },
        { from: 'esp1:GND.1', to: 'oled1:GND' },
      ],
      code: '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(115200);Serial.println("ESP_OLED_READY");d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("HiESP");d.display();Serial.println("ESP_OLED_DRAWN");}\nvoid loop(){d.clearDisplay();d.setCursor(0,0);d.println(millis());d.display();Serial.println("ESP_OLED_TICK");delay(500);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 200000, selectTelemetry: ['oled1'], serialNeedle: 'ESP_OLED_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESP reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESP serial:', JSON.stringify((verdict.serial || '').slice(-500)));
    expect(verdict.pass).toBe(true);
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('ESP-OLED vramFill:', ocustom.vramFillPercentage, 'power:', ocustom.powerStatus);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
