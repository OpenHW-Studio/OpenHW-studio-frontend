import { test, expect } from '@playwright/test';

// ESP32-CAM I2C: the cam SHELL exposes GPIO 0/1/2/3/4/12/13/14/15/16 —
// no 21/22, so the ESP32 default Wire pins do not exist on this board.
// The cell therefore REMAPS the bus (Wire.begin(13, 14)) — the same
// remap the MicroPython cam cell uses (esp32-cam-mp) — and drives a real
// SSD1306 OLED over the engine's I2C slave tap (attachI2cSlave +
// pollI2c events into the shared I2C bridge).
// Proof: the guest's own draw marker AND the OLED model's vram fill
// (model truth, not firmware self-report).
test.describe('ESP32-CAM I2C (remapped bus + SSD1306)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('SSD1306 draws over remapped SDA13/SCL14', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('pageerror', (err) => console.log('CAM-I2C PAGEERROR:', String(err).slice(0, 300)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'cam1', type: 'openhw-esp32-cam', attrs: {}, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'cam1:13', to: 'oled1:SDA' },
        { from: 'cam1:14', to: 'oled1:SCL' },
        { from: 'cam1:3V3', to: 'oled1:VCC' },
        { from: 'cam1:GND.1', to: 'oled1:GND' },
      ],
      code: [
        '#include <Wire.h>',
        '#include <Adafruit_GFX.h>',
        '#include <Adafruit_SSD1306.h>',
        'Adafruit_SSD1306 d(128,64,&Wire,-1);',
        'void setup(){',
        '  Serial.begin(115200);',
        '  Serial.println("CAMOLED_READY");',
        '  Wire.begin(13,14);',
        '  d.begin(SSD1306_SWITCHCAPVCC,0x3C);',
        '  d.clearDisplay();',
        '  d.setTextSize(2);',
        '  d.setTextColor(SSD1306_WHITE);',
        '  d.setCursor(0,0);',
        '  d.println("HiCAM");',
        '  d.display();',
        '  Serial.println("CAMOLED_DRAWN");',
        '}',
        'void loop(){d.clearDisplay();d.setCursor(0,0);d.println(millis());d.display();Serial.println("CAMOLED_TICK");delay(500);}',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['oled1'], serialNeedle: 'CAMOLED_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAM-I2C reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('CAM-I2C serial:', JSON.stringify((verdict.serial || '').slice(-400)));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('CAMOLED_DRAWN');
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('CAM-I2C OLED vramFill:', ocustom.vramFillPercentage);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
