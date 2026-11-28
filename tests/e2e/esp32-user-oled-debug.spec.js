import { test, expect } from '@playwright/test';

// TEMPORARY diagnostic — will be deleted after the run. Unfiltered console
// capture + full verdict/snapshot dump to find why ESP32 serial is empty.
test.describe('ESP32 user OLED diag (temp)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile') && !url.includes('/compile/ports') && !url.includes('flash')) {
        try {
          const pd = route.request().postData() || '';
          console.log('DIAG-COMPILE-REQ:', url.slice(-40), 'postLen:', pd.length, 'body head:', pd.slice(0, 400));
        } catch (e) { console.log('DIAG-COMPILE-REQ-ERR:', String(e)); }
        return route.continue();
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    page.on('response', async (resp) => {
      try {
        const url = resp.url();
        if (url.includes('/compile') && !url.includes('ports')) {
          const txt = await resp.text().catch(() => '');
          console.log('DIAG-COMPILE-RESP:', resp.status(), 'len:', txt.length, 'head:', txt.slice(0, 300));
        }
      } catch { /* ignore */ }
    });
  });

  test('dump all console + verdict + snapshot', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('console', (msg) => {
      console.log('DIAG-CONSOLE[' + msg.type() + ']:', msg.text().slice(0, 500));
    });
    page.on('pageerror', (err) => console.log('DIAG-PAGEERROR:', String(err).slice(0, 600)));
    page.on('requestfailed', (req) => console.log('DIAG-REQFAIL:', req.url().slice(0, 200), req.failure()?.errorText));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const sketch = '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(115200);Serial.println("DIAG_READY");d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("Hi");d.display();Serial.println("DIAG_DRAWN");}\nvoid loop(){Serial.println("DIAG_TICK");delay(1000);}\n';
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
    console.log('DIAG setup:', JSON.stringify(setup));
    const snap0 = await page.evaluate(() => {
      try { return window.OpenHWE2E.snapshot(); } catch (e) { return { err: String(e) }; }
    });
    console.log('DIAG snapshot pre-run:', JSON.stringify(snap0).slice(0, 1000));
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, selectTelemetry: ['oled1'], serialNeedle: 'DIAG_DRAWN', telemetryMode: 'detail',
    }));
    console.log('DIAG verdict full:', JSON.stringify(verdict).slice(0, 6000));
    const snap1 = await page.evaluate(() => {
      try { return window.OpenHWE2E.snapshot(); } catch (e) { return { err: String(e) }; }
    });
    console.log('DIAG snapshot post-run:', JSON.stringify(snap1).slice(0, 1000));
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
    expect(true).toBe(true);
  });
});
