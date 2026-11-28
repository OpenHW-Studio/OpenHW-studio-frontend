import { test, expect } from '@playwright/test';

// Pico 2 ADC: pot wiper on GP26 (ADC0) via _picoemu_adc_set inject.
test.describe('Pico 2 ADC (potentiometer)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('analogRead tracks the pot wiper via ADC0', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico2', type: 'openhw-pico-2', attrs: {}, x: 100, y: 100 },
        { id: 'pot1', type: 'openhw-potentiometer', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'pico2:GP26', to: 'pot1:SIG' },
        { from: 'pico2:3V3', to: 'pot1:1' },
        { from: 'pico2:GND', to: 'pot1:2' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("P2ADC_READY");analogReadResolution(12);}\nvoid loop(){int v=analogRead(26);Serial.print("P2ADC_VAL:");Serial.println(v);delay(500);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['pot1'], serialNeedle: 'P2ADC_VAL:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('P2ADC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const vals = [...(verdict.serial || '').matchAll(/P2ADC_VAL:(\d+)/g)].map((m) => Number(m[1]));
    console.log('P2ADC values:', JSON.stringify(vals.slice(0, 8)));
    expect(vals.length).toBeGreaterThan(0);
    const settled = vals.slice(4);
    expect(settled.length).toBeGreaterThan(0);
    for (const v of settled) expect(Math.abs(v - 2048)).toBeLessThan(500);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
