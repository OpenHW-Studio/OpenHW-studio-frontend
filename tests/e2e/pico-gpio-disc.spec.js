import { test, expect } from '@playwright/test';

// Pico GPIO discriminator: drive GP15 (external LED) AND GP25 (onboard)
// HIGH latched. If GP25 lights and GP15 doesn't -> mapping/scope issue;
// if neither -> sampler/engine output gap; if both -> v2 was a flake.
test.describe('Pico GPIO discriminator (live)', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/PICO-DIAG/.test(t)) console.log('CAPTURED-DIAG:', t.slice(0, 220));
      } catch { /* ignore */ }
    });
  });

  test('GP15 + GP25 latched HIGH', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'pico1', type: 'openhw-pico', attrs: {}, x: 100, y: 100 },
          { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 450, y: 80 },
          { id: 'led1', type: 'openhw-led', attrs: {}, x: 600, y: 80 },
          { id: 'res2', type: 'openhw-resistor', attrs: {}, x: 450, y: 220 },
          { id: 'led2', type: 'openhw-led', attrs: {}, x: 600, y: 220 },
        ],
        wires: [
          { from: 'pico1:GP15', to: 'res1:p1' },
          { from: 'res1:p2', to: 'led1:A' },
          { from: 'led1:K', to: 'pico1:GND' },
          { from: 'pico1:GP25', to: 'res2:p1' },
          { from: 'res2:p2', to: 'led2:A' },
          { from: 'led2:K', to: 'pico1:GND' },
        ],
        code: 'void setup(){pinMode(15,OUTPUT);pinMode(25,OUTPUT);Serial.begin(9600);Serial.println("PICO_READY");}\nvoid loop(){digitalWrite(15,HIGH);digitalWrite(25,HIGH);Serial.println("PICO_HOLD");delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['led1', 'led2'], serialNeedle: 'PICO_HOLD', telemetryMode: 'detail',
    }));
    console.log('PICO-DISC verdict:', JSON.stringify({
      pass: verdict.pass, reasons: verdict.reasons,
      serialHead: (verdict.serial || '').slice(-160),
      pins: verdict.pins,
      telemetry: (verdict.telemetry || []).map((t) => ({ id: t.id, status: t.status, summary: String(t.summary || '').slice(0, 160) })),
    }, null, 1));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
