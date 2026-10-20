import { test, expect } from '@playwright/test';

// STM32F4 ADC (disco potentiometer): PA0 analog input driven by a pot
// wiper at 50% (1.65V) via facade setAdcChannel (raw 12-bit). Independent
// of the I2C wedge (core boots + serial run; ADC inject is live any time).
test.describe('STM32F4 ADC (disco potentiometer)', () => {
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
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/F4 ADC DIAG|F4 PC DIAG/i.test(t)) console.log('CAPTURED-DIAG:', t.slice(0, 220));
      } catch { /* ignore */ }
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: {}, x: 100, y: 100 },
        { id: 'pot1', type: 'openhw-potentiometer', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f41:PA0', to: 'pot1:SIG' },
        { from: 'f41:3V3', to: 'pot1:1' },
        { from: 'f41:GND.1', to: 'pot1:2' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("F4ADC_READY");analogReadResolution(12);}\nvoid loop(){Serial.println("F4ADC_PRE");int v=analogRead(PA0);Serial.print("F4ADC_VAL:");Serial.println(v);Serial.println("F4ADC_POST");delay(500);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      // NOTE: the F4 engine needs ~108M instructions per loop iteration
      // (~10s wall in the browser worker), so a 20s window only yields
      // ~2 samples. 90s gives ~9 (engine-verified healthy, just slow).
      forMs: 90000, selectTelemetry: ['pot1'], serialNeedle: 'F4ADC_VAL:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4ADC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const vals = [...(verdict.serial || '').matchAll(/F4ADC_VAL:(\d+)/g)].map((m) => Number(m[1]));
    console.log('F4ADC values:', JSON.stringify(vals.slice(0, 8)));
    expect(vals.length).toBeGreaterThan(0);
    const settled = vals.slice(4);
    expect(settled.length).toBeGreaterThan(0);
    for (const v of settled) expect(Math.abs(v - 2048)).toBeLessThan(500);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
