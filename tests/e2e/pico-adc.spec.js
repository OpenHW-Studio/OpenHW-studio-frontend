import { test, expect } from '@playwright/test';

// Pico ADC (potentiometer): GP26 wiper at 50% (1.65V) via _picoemu_adc_set
// (12-bit code) into RP2040 ADC0. Firmware reads + prints; mid-scale asserted.
test.describe('Pico ADC (potentiometer)', () => {
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
        { id: 'pico1', type: 'openhw-pico', attrs: {}, x: 100, y: 100 },
        { id: 'pot1', type: 'openhw-potentiometer', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'pico1:GP26', to: 'pot1:SIG' },
        { from: 'pico1:3V3', to: 'pot1:1' },
        { from: 'pico1:GND', to: 'pot1:2' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("PICOADC_READY");analogReadResolution(12);}\nvoid loop(){int v=analogRead(26);Serial.print("PICOADC_VAL:");Serial.println(v);delay(500);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['pot1'], serialNeedle: 'PICOADC_VAL:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PICOADC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const pot = (verdict.telemetry || []).find((t) => t.id === 'pot1');
    const pcustom = pot?.details?.custom || pot?.details?.metrics?.custom || {};
    console.log('PICOADC pot:', JSON.stringify(pcustom).slice(0, 160));
    const vals = [...(verdict.serial || '').matchAll(/PICOADC_VAL:(\d+)/g)].map((m) => Number(m[1]));
    console.log('PICOADC values:', JSON.stringify(vals.slice(0, 8)));
    expect(vals.length).toBeGreaterThan(0);
    const settled = vals.slice(4);
    expect(settled.length).toBeGreaterThan(0);
    for (const v of settled) expect(Math.abs(v - 2048)).toBeLessThan(500);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
