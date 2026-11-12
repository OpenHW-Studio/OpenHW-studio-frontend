import { test, expect } from '@playwright/test';

// USER reproduction: openhw-esp32 (DevKit) + SSD1306 OLED, SDA->GPIO21,
// SCL->GPIO22, VCC->3V3, GND->GND. User sketch shape: Adafruit SSD1306 over
// default Wire @0x3C, prints millis()/1000 + " s" in loop with delay(1000).
// Mirrors tests/e2e/esp32-i2c.spec.js harness shape (route stub passing
// /compile through, setupCircuit, run with serialNeedle + telemetryMode
// detail, verdict.pass asserts, evidence logs, OpenHWE2E.stop() at end).
test.describe('ESP32 user OLED repro (millis seconds counter)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('user sketch: seconds counter draws on OLED, millis advances', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/Esp32|ESP32|esp32|USER_OLED|error|Error|wasm|WASM|abort|Aborted|failed|warn/i.test(t)) console.log('USER-CAP:', t.slice(0, 300));
      } catch { /* ignore */ }
    });
    page.on('pageerror', (err) => console.log('USER-PAGEERROR:', String(err).slice(0, 400)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const sketch = '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\n#define SCREEN_WIDTH 128\n#define SCREEN_HEIGHT 64\n#define OLED_RESET -1\nAdafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);\nvoid setup(){\nSerial.begin(115200);\nSerial.println("USER_OLED_SETUP");\nif(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)){Serial.println("USER_OLED_BEGIN_FAIL");for(;;);}\ndisplay.clearDisplay();\ndisplay.setTextSize(2);\ndisplay.setTextColor(SSD1306_WHITE);\ndisplay.setCursor(0,0);\ndisplay.println("Booting");\ndisplay.display();\nSerial.println("USER_OLED_READY");\ndelay(1000);\n}\nvoid loop(){\ndisplay.clearDisplay();\ndisplay.setTextSize(2);\ndisplay.setTextColor(SSD1306_WHITE);\ndisplay.setCursor(0,0);\ndisplay.println(String(millis()/1000) + " s");\ndisplay.display();\nSerial.println(String(millis()/1000) + " s");\ndelay(1000);\n}\n';
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
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
      code,
    }), sketch);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['oled1'], serialNeedle: 'USER_OLED_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('USER reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines, 'wallMs:', verdict.wallMs);
    console.log('USER serial:', JSON.stringify((verdict.serial || '').slice(-1500)));
    console.log('USER serial head:', JSON.stringify((verdict.serial || '').slice(0, 1500)));
    expect(verdict.pass).toBe(true);
    // millis-advances proof: at least two distinct "<n> s" values on serial
    const secs = [...String(verdict.serial || '').matchAll(/(\d+)\s*s/g)].map((m) => Number(m[1]));
    const distinct = [...new Set(secs)];
    console.log('USER secs values:', JSON.stringify(secs.slice(0, 30)), 'distinct:', JSON.stringify(distinct.slice(0, 30)));
    expect(distinct.length).toBeGreaterThanOrEqual(2);
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    console.log('USER oled telemetry:', JSON.stringify(oled).slice(0, 2000));
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('USER-OLED vramFill:', ocustom.vramFillPercentage, 'power:', ocustom.powerStatus, 'keys:', Object.keys(ocustom || {}).join(','));
    console.log('USER-OLED details keys:', Object.keys(oled.details || {}).join(','));
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
