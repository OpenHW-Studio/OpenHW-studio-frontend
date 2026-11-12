import { test, expect } from '@playwright/test';

// Pico 2 (RP2350 M33): boot proof + I2C0 OLED via the first-party mirror.
// Same assert shape as the Pico 1 row; exercises the M33 membus I2C remap
// (previously HardFaulted at PC=0x3E380000 before any output).
test.describe('Pico 2 (RP2350 M33)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('boots and prints over M33 UART0', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico2', type: 'openhw-pico-2', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code: 'void setup(){Serial.begin(9600);Serial.println("PICO2_READY");}\nvoid loop(){Serial.println("PICO2_TICK");delay(500);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'PICO2_TICK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PICO2 reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    // NOTE: the first Pico serial line is routinely lost (<500ms
    // early-byte race) — needle on the repeating TICK, not READY.
    expect(verdict.serial || '').toContain('PICO2_TICK');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('SSD1306 draws via Pico 2 I2C0', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico2', type: 'openhw-pico-2', attrs: {}, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
      ],
      wires: [
        { from: 'pico2:GP4', to: 'oled1:SDA' },
        { from: 'pico2:GP5', to: 'oled1:SCL' },
        { from: 'pico2:3V3', to: 'oled1:VCC' },
        { from: 'pico2:GND', to: 'oled1:GND' },
      ],
      code: '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("PICO2_OLED_READY");delay(500);Serial.println("PICO2_OLED_READY2");Wire.setSDA(4);Wire.setSCL(5);d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("HiP2");d.display();Serial.println("PICO2_OLED_DRAWN");}\nvoid loop(){d.clearDisplay();d.setCursor(0,0);d.println(millis());d.display();Serial.println("PICO2_OLED_TICK");delay(200);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['oled1'], serialNeedle: 'PICO2_OLED_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PICO2-OLED reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.serial || '').toContain('PICO2_OLED_DRAWN');
    expect(verdict.pass).toBe(true);
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('PICO2-OLED vramFill:', ocustom.vramFillPercentage, 'power:', ocustom.powerStatus);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
