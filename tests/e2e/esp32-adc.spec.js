import { test, expect } from '@playwright/test';

// ESP32 ADC: pot wiper on GPIO34 (ADC1_CH6) via setAnalogInput volts inject.
// Same assert shape as the Pico/F1 ADC rows (real Arduino analogRead).
test.describe('ESP32 ADC (devkit potentiometer)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('analogRead tracks the pot wiper via ADC1', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'pot1', type: 'openhw-potentiometer', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:GPIO34', to: 'pot1:SIG' },
        { from: 'esp1:3V3', to: 'pot1:1' },
        { from: 'esp1:GND', to: 'pot1:2' },
      ],
      code: 'void setup(){Serial.begin(115200);Serial.println("ESPADC_READY");analogReadResolution(12);}\nvoid loop(){int v=analogRead(34);Serial.print("ESPADC_VAL:");Serial.println(v);delay(500);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, selectTelemetry: ['pot1'], serialNeedle: 'ESPADC_VAL:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPADC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const vals = [...(verdict.serial || '').matchAll(/ESPADC_VAL:(\d+)/g)].map((m) => Number(m[1]));
    console.log('ESPADC values:', JSON.stringify(vals.slice(0, 8)));
    expect(vals.length).toBeGreaterThan(0);
    const settled = vals.slice(4);
    expect(settled.length).toBeGreaterThan(0);
    for (const v of settled) expect(Math.abs(v - 2048)).toBeLessThan(500);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
