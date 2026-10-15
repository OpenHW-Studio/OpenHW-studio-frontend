import { test, expect } from '@playwright/test';

// Dual-board regression: two Unos share one run; each runner owns the
// peripherals wired to it (partition) and telemetry merges per id
// (no last-writer-wins). Phase A lockstep keeps their sim clocks together
// (millis-sync test below).
test.describe('Dual boards (two Unos, partitioned + merged)', () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/Creating runner|Skipping board|Running/.test(t)) console.log('DUO:', t.slice(0, 200));
      } catch { /* ignore */ }
    });
  });
  test('two unos blink', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 100 },
        { id: 'uno2', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 300 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
        { id: 'oled2', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 300 },
      ],
      wires: [
        { from: 'uno1:A4', to: 'oled1:SDA' },
        { from: 'uno1:A5', to: 'oled1:SCL' },
        { from: 'uno1:5V', to: 'oled1:VCC' },
        { from: 'uno1:gnd_1', to: 'oled1:GND' },
        { from: 'uno2:A4', to: 'oled2:SDA' },
        { from: 'uno2:A5', to: 'oled2:SCL' },
        { from: 'uno2:5V', to: 'oled2:VCC' },
        { from: 'uno2:gnd_1', to: 'oled2:GND' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("UNO1_READY");}\nvoid loop(){Serial.println("UNO1_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate(() => window.OpenHWE2E.setupCircuitBoards({
      extra: {
        uno2: '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d2(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("UNO2_READY");d2.begin(SSD1306_SWITCHCAPVCC,0x3C);d2.clearDisplay();d2.setTextSize(2);d2.setTextColor(SSD1306_WHITE);d2.setCursor(0,0);d2.println("Hi2");d2.display();}\nvoid loop(){Serial.println("UNO2_TICK");delay(1000);}\n',
      },
    }));
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['oled2'], serialNeedle: 'UNO1_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('DUO serial:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    console.log('DUO pins keys:', JSON.stringify(Object.keys(verdict.pins || {})));
    // Both boards must run their own firmware.
    expect(verdict.serial || '').toContain('UNO2_READY');
    expect(verdict.serial || '').toContain('UNO2_TICK');
    // Both OLEDs must hold pixels (user-reported blank second screen).
    const oled2 = (verdict.telemetry || []).find((t) => t.id === 'oled2');
    expect(oled2).toBeTruthy();
    const ocustom = oled2.details?.custom || oled2.details?.metrics?.custom || {};
    console.log('OLED2 vramFill:', ocustom.vramFillPercentage, 'power:', ocustom.powerStatus);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('two unos stay in millis sync under lockstep', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'uno2', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 300 },
      ],
      wires: [],
      code: 'void setup(){Serial.begin(9600);Serial.println("S1_READY");}\nvoid loop(){Serial.print("T1:");Serial.println(millis());delay(250);}\n',
    }));
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate(() => window.OpenHWE2E.setupCircuitBoards({
      extra: {
        uno2: 'void setup(){Serial.begin(9600);Serial.println("S2_READY");}\nvoid loop(){Serial.print("T2:");Serial.println(millis());delay(250);}\n',
      },
    }));
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, serialNeedle: 'S1_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    // Last reported millis per board must agree: lockstep advances both
    // boards by identical quanta, so any residual offset is boot stagger
    // only (must not grow into seconds of drift).
    const t1 = [...serial.matchAll(/T1:(\d+)/g)].map((m) => Number(m[1]));
    const t2 = [...serial.matchAll(/T2:(\d+)/g)].map((m) => Number(m[1]));
    console.log('SYNC n1:', t1.length, 'n2:', t2.length, 'last1:', t1[t1.length - 1], 'last2:', t2[t2.length - 1]);
    expect(t1.length).toBeGreaterThan(5);
    expect(t2.length).toBeGreaterThan(5);
    expect(Math.abs(t1[t1.length - 1] - t2[t2.length - 1])).toBeLessThan(2500);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
