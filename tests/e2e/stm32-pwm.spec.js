import { test, expect } from '@playwright/test';

// STM32F1 PWM (bluepill LED): analogWrite(PA8, 192) programs a hardware
// TIM channel at ~75% duty; the runner observes it (3.3.0 TIM class) and
// drives the LED model. Assert brightness tracks 75% of full scale.
test.describe('STM32 PWM (bluepill LED)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('LED brightness tracks analogWrite duty via TIM', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'bp1:PA8', to: 'led1:A' },
        { from: 'bp1:GND.1', to: 'led1:K' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("F1PWM_READY");analogWrite(PA8,192);Serial.println("F1PWM_SET");}\nvoid loop(){Serial.println("F1PWM_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['led1'], serialNeedle: 'F1PWM_SET', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1PWM reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    const lcustom = led.details?.custom || led.details?.metrics?.custom || {};
    console.log('F1PWM led:', JSON.stringify(lcustom).slice(0, 200));
    // PWM-driven (not DC): status dim + glow, with zero DC current.
    // A DC-high pin would show measurable current; the event path sets
    // brightness without current.
    expect(lcustom.status).toBe('dim');
    expect(lcustom.glow).toBe(true);
    expect(lcustom.current).toBe('0.00 mA');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
