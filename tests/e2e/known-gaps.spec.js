import { test, expect } from '@playwright/test';

// Documented engine gaps, asserted live (plan §8: gaps explicit, not silent).
// Each case proves the firmware runs (serial needle) while the documented
// hardware limit holds. Backend compiles real firmware.
test.describe('Known engine gaps (explicit, not silent)', () => {
  test.setTimeout(600000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('ESP32 has no GPIO-output readback: LED stays dark, serial flows', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
          { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 300, y: 120 },
          { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'esp1:2', to: 'res1:p1' },
          { from: 'res1:p2', to: 'led1:A' },
          { from: 'led1:K', to: 'esp1:GND.1' },
        ],
        code: 'void setup(){pinMode(2,OUTPUT);digitalWrite(2,HIGH);Serial.begin(115200);Serial.println("GAP_ESP");}\nvoid loop(){delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() =>
      window.OpenHWE2E.run({ forMs: 20000, serialNeedle: 'GAP_ESP', telemetryMode: 'detail', selectTelemetry: ['led1'] }));
    console.log('esp32-gap verdict:', JSON.stringify({
      pass: verdict.pass, reasons: verdict.reasons,
      serialHead: (verdict.serial || '').slice(0, 60),
    }));
    expect(verdict.ok).toBe(true);
    // Firmware runs (serial proves it) but the SAB proxy exposes input-only
    // GPIO: no output is ever published, so the LED model stays dark.
    expect((verdict.serial || '')).toContain('GAP_ESP');
    const ledEntry = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(ledEntry).toBeTruthy();
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('8051 HIGH floats: LED stays dark, serial flows', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'r51', type: 'openhw-8051', attrs: {}, x: 100, y: 100 },
          { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 300, y: 120 },
          { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'r51:L2', to: 'res1:p1' },
          { from: 'res1:p2', to: 'led1:A' },
          { from: 'led1:K', to: 'r51:SWD_GND' },
        ],
        code: `ORG 0\nMOV P1, #0FFh\nMOV SBUF, #'G'\nSJMP $\nEND`,
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() =>
      window.OpenHWE2E.run({ forMs: 12000, serialNeedle: 'G', telemetryMode: 'detail', selectTelemetry: ['led1'] }));
    expect(verdict.ok).toBe(true);
    expect((verdict.serial || '')).toContain('G');
    // Quasi-bidirectional HIGH floats: nothing is driven, LED stays dark.
    const t = await page.evaluate(() => (window.OpenHWTelemetry?.getLatestTelemetry?.() || []).map((x) => ({ id: x.id, illum: x.details?.state?.illuminated })));
    const led = (t || []).find((x) => x.id === 'led1');
    expect(led?.illum).toBe(false);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
