import { test, expect } from '@playwright/test';

// Pico PWM (LED): analogWrite duty observed via _picoemu_pwm_read (freq +
// duty A/B) into LED brightness. Same discriminator as the F1 row.
test.describe('Pico PWM (LED)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('LED brightness tracks analogWrite duty via PWM slice', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico1', type: 'openhw-pico', attrs: {}, x: 100, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'pico1:GP16', to: 'led1:A' },
        { from: 'pico1:GND', to: 'led1:K' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("PICOPWM_READY");analogWrite(16,192);Serial.println("PICOPWM_SET");}\nvoid loop(){Serial.println("PICOPWM_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['led1'], serialNeedle: 'PICOPWM_SET', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PICOPWM reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    const lcustom = led.details?.custom || led.details?.metrics?.custom || {};
    console.log('PICOPWM led:', JSON.stringify(lcustom).slice(0, 200));
    expect(lcustom.status).toBe('dim');
    expect(lcustom.glow).toBe(true);
    expect(lcustom.current).toBe('0.00 mA');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
