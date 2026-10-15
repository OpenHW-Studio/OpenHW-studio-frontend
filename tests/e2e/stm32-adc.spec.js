import { test, expect } from '@playwright/test';

// STM32F1 ADC (bluepill potentiometer): PA0 analog input driven by a pot
// wiper at 50% (1.65V) via the 3.3.0 ADC inject path (adc1.setVoltage).
// Firmware reads + prints; the value must track mid-scale 12-bit.
test.describe('STM32 ADC (bluepill potentiometer)', () => {
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
        if (/F1 ADC DIAG/i.test(t)) console.log('CAPTURED-DIAG:', t.slice(0, 200));
      } catch { /* ignore */ }
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'pot1', type: 'openhw-potentiometer', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'bp1:PA0', to: 'pot1:SIG' },
        { from: 'bp1:3V3.1', to: 'pot1:1' },
        { from: 'bp1:GND.1', to: 'pot1:2' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("F1ADC_READY");analogReadResolution(12);}\nvoid loop(){int v=analogRead(PA0);Serial.print("F1ADC_VAL:");Serial.println(v);delay(500);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['pot1'], serialNeedle: 'F1ADC_VAL:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1ADC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1ADC serial:', JSON.stringify((verdict.serial || '').slice(-300)));
    expect(verdict.pass).toBe(true);
    const vals = [...(verdict.serial || '').matchAll(/F1ADC_VAL:(\d+)/g)].map((m) => Number(m[1]));
    console.log('F1ADC values:', JSON.stringify(vals.slice(0, 8)));
    expect(vals.length).toBeGreaterThan(0);
    // 50% of 3V3 at 12-bit = 2048; tolerance covers rail/quantization spread.
    // Drop the startup transient (first reads race rail-power convergence).
    const settled = vals.slice(4);
    expect(settled.length).toBeGreaterThan(0);
    for (const v of settled) expect(Math.abs(v - 2048)).toBeLessThan(500);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
