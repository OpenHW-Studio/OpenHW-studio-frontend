import { test, expect } from '@playwright/test';

// STM32F4 PWM: analogWrite on PA6 (TIM3_CH1) observed via the engine TIM3
// buzzer tap (freq/duty from modeled timer regs) into the LED model.
test.describe('STM32F4 PWM (disco LED)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('LED brightness tracks analogWrite duty on PA6', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: {}, x: 100, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f41:PA6', to: 'led1:A' },
        { from: 'f41:GND.1', to: 'led1:C' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("F4PWM_READY");analogWrite(PA6,192);Serial.println("F4PWM_SET");}\nvoid loop(){Serial.println("F4PWM_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, selectTelemetry: ['led1'], serialNeedle: 'F4PWM_SET', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4PWM reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    const custom = led.details?.custom || led.details?.metrics?.custom || {};
    console.log('F4PWM led:', JSON.stringify(custom).slice(0, 200));
    expect(custom.glow).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
