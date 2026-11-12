import { test, expect } from '@playwright/test';

// ESP32-CAM ADC2 (cam shell GPIO13): the shell exposes 0/2/4/12-15 (no
// ADC1 pins 32-39), which ARE ESP32 ADC2 pins — runner §E4 injects them
// via setAnalogInput identically (WiFi stays off in e2e, so ADC2 reads
// valid). Pot wiper on GPIO13, real Arduino analogRead. Same assert
// shape as the DevKit ADC1 row (esp32-adc.spec.js); pot telemetry is
// the model-truth oracle.
test.describe('ESP32-CAM ADC2 (shell potentiometer on GPIO13)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('analogRead tracks the pot wiper via ADC2', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'cam1', type: 'openhw-esp32-cam', attrs: {}, x: 100, y: 100 },
        { id: 'pot1', type: 'openhw-potentiometer', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'cam1:13', to: 'pot1:SIG' },
        { from: 'cam1:3V3', to: 'pot1:1' },
        { from: 'cam1:GND.1', to: 'pot1:2' },
      ],
      code: 'void setup(){Serial.begin(115200);Serial.println("CAMADC_READY");analogReadResolution(12);}\nvoid loop(){int v=analogRead(13);Serial.print("CAMADC_VAL:");Serial.println(v);delay(500);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, selectTelemetry: ['pot1'], serialNeedle: 'CAMADC_VAL:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAMADC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const vals = [...(verdict.serial || '').matchAll(/CAMADC_VAL:(\d+)/g)].map((m) => Number(m[1]));
    console.log('CAMADC values:', JSON.stringify(vals.slice(0, 8)));
    expect(vals.length).toBeGreaterThan(0);
    const settled = vals.slice(4);
    expect(settled.length).toBeGreaterThan(0);
    for (const v of settled) expect(Math.abs(v - 2048)).toBeLessThan(500);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
