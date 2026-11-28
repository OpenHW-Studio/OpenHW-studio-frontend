import { test, expect } from '@playwright/test';

// F1 board-variant sweep (live): SSD1306 OLED over I2C1 once per F1 board
// type. Same runner mechanism; variants differ in FQBN + IDCODE.
const VARIANTS = [
  'openhw-stm32-bluepill',
  'openhw-stm32f103cb',
  'openhw-stm32f103rc',
  'openhw-stm32-gd32f103c8',
  'openhw-stm32-gd32f103cb',
  'openhw-stm32-gd32f103rb',
  'openhw-stm32-maple-mini',
  'openhw-stm32-nucleo-f103rb',
];

const CODE = '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("SWEEP_READY");Wire.begin();d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("HiF1");d.display();Serial.println("SWEEP_DRAWN");}\nvoid loop(){Serial.println("SWEEP_TICK");delay(1000);}\n';

test.describe('F1 I2C variant sweep (SSD1306)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const type of VARIANTS) {
    test(`F1-I2C sweep (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'bp1', type: t, attrs: {}, x: 100, y: 100 },
          { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
        ],
        wires: [
          { from: 'bp1:PB7', to: 'oled1:SDA' },
          { from: 'bp1:PB6', to: 'oled1:SCL' },
          { from: 'bp1:3V3.1', to: 'oled1:VCC' },
          { from: 'bp1:GND.1', to: 'oled1:GND' },
        ],
        code,
      }), { t: type, code: CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, selectTelemetry: ['oled1'], serialNeedle: 'SWEEP_DRAWN', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`SWEEP ${type}:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
      expect(oled).toBeTruthy();
      const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
      expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
