import { test, expect } from '@playwright/test';

// Display verification (§11 R4 + AGENT_LOOP.md):
// ILI9341 TFT (SPI) + SSD1306 OLED (I2C) driven via the OpenHWE2E loop —
// setupCircuit → run → verdict with serial/pins/telemetry evidence.
// Verifies: circuit builds, sim runs, display telemetry entries exist
// (powerOn/displayOn), pins driven, serial handshake from firmware.
test.describe('Display verification (TFT + OLED)', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    // Pass compile through to the REAL backend (displays need real firmware);
    // stub only the non-compile API calls that gate the page.
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('ILI9341 TFT (SPI): run + telemetry + pins evidence', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    // UNO + ILI9341 TFT wired over SPI: CS→10, RESET→9, DC→8, MOSI→11, SCK→13, LED→5V, VCC→5V, GND→GND.
    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'tft1', type: 'openhw-ili9341', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:10', to: 'tft1:CS' },
          { from: 'uno1:9', to: 'tft1:DC' },
          { from: 'uno1:8', to: 'tft1:RESET' },
          { from: 'uno1:11', to: 'tft1:MOSI' },
          { from: 'uno1:13', to: 'tft1:SCK' },
          { from: 'uno1:5V', to: 'tft1:LED' },
          { from: 'uno1:5V', to: 'tft1:VCC' },
          { from: 'uno1:gnd_1', to: 'tft1:GND' },
        ],
        code: '#include <SPI.h>\nvoid setup(){Serial.begin(9600);Serial.println("TFT_READY");pinMode(10,OUTPUT);SPI.begin();}\nvoid loop(){Serial.println("TFT_TICK");delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);
    expect(setup.components).toBe(2);
    expect(setup.wires).toBe(8);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 12000, selectTelemetry: ['tft1'], serialNeedle: 'TFT_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    // Evidence, logged for the report.
    console.log('TFT verdict:', JSON.stringify({
      pass: verdict.pass,
      reasons: verdict.reasons,
      serialLines: verdict.serialLines,
      serialHead: (verdict.serial || '').slice(0, 300),
      telemetryCount: verdict.telemetryCount,
      telemetry: (verdict.telemetry || []).map((t) => ({ id: t.id, type: t.type, status: t.status, summary: String(t.summary || '').slice(0, 200) })),
      pins: verdict.pins,
    }, null, 1));
    expect(verdict.pass).toBe(true);
    // Display telemetry entry exists for the selected TFT.
    const tftEntry = (verdict.telemetry || []).find((t) => t.id === 'tft1');
    expect(tftEntry).toBeTruthy();
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(3000);
    expect(errors.filter((e) => /OpenHWE2E|ili9341|ILI9341/i.test(e))).toEqual([]);
  });

  test('SSD1306 OLED (I2C): run + telemetry + pins evidence', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    // UNO + SSD1306 OLED wired over I2C: SDA→A4, SCL→A5, VCC→5V, GND→GND.
    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:A4', to: 'oled1:SDA' },
          { from: 'uno1:A5', to: 'oled1:SCL' },
          { from: 'uno1:5V', to: 'oled1:VCC' },
          { from: 'uno1:gnd_1', to: 'oled1:GND' },
        ],
        code: '#include <Wire.h>\nvoid setup(){Serial.begin(9600);Serial.println("OLED_READY");Wire.begin();}\nvoid loop(){Serial.println("OLED_TICK");delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);
    expect(setup.components).toBe(2);
    expect(setup.wires).toBe(4);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 12000, selectTelemetry: ['oled1'], serialNeedle: 'OLED_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('OLED verdict:', JSON.stringify({
      pass: verdict.pass,
      reasons: verdict.reasons,
      serialLines: verdict.serialLines,
      serialHead: (verdict.serial || '').slice(0, 300),
      telemetryCount: verdict.telemetryCount,
      telemetry: (verdict.telemetry || []).map((t) => ({ id: t.id, type: t.type, status: t.status, summary: String(t.summary || '').slice(0, 200) })),
      pins: verdict.pins,
    }, null, 1));
    expect(verdict.pass).toBe(true);
    const oledEntry = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oledEntry).toBeTruthy();
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(3000);
    expect(errors.filter((e) => /OpenHWE2E|ssd1306|SSD1306|oled/i.test(e))).toEqual([]);
  });
});
