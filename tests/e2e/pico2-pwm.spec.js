import { test, expect } from '@playwright/test';

// Pico 2 PWM: analogWrite duty on GP16 observed via _picoemu_pwm_read.
test.describe('Pico 2 PWM (LED)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('LED brightness tracks analogWrite duty on GP16', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico2', type: 'openhw-pico-2', attrs: {}, x: 100, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'pico2:GP16', to: 'led1:A' },
        { from: 'pico2:GND', to: 'led1:C' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("P2PWM_READY");analogWrite(16,192);Serial.println("P2PWM_SET");}\nvoid loop(){Serial.println("P2PWM_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['led1'], serialNeedle: 'P2PWM_SET', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('P2PWM reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    const custom = led.details?.custom || led.details?.metrics?.custom || {};
    console.log('P2PWM led:', JSON.stringify(custom).slice(0, 200));
    expect(custom.glow).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
