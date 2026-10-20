import { test, expect } from '@playwright/test';

// micro:bit v2 PWM0 cell — proves the owner P164 runner gear end to end.
//
// The engine keeps the PWM waveform bytes driver-side (it has no guest-RAM
// handle), so the duty is only knowable through the driver-fed latch:
// the runner reads the SEQ compare word out of guest RAM, feeds it with
// pwm_observe_seq_word and asks the engine for pwm_get_duty /
// pwm_get_freq_hz. That duty then drives the LED model wired to the PWM
// output pin (onPWM), so the LED brightness is the observed proof.
//
// Firmware (public/firmware/microbit/pwm_nrf.bin, source pwm_nrf.s):
// PWM0, COUNTERTOP=1000, PRESCALER=0 (16 MHz), Up mode -> 16000 Hz,
// SEQ compare word 250 -> duty 250/1000 = 25 % (2500 basis points),
// PSEL.OUT[0] = P0.26 (edge pin P19).
//
// Expected: LED illuminated with brightness round(0.25 * 255) = 64.
test.describe('micro:bit v2 PWM0 (owner P164 readback gear)', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('LED on the PWM pin lights with the duty the engine read back', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/pwm_nrf.bin' }, x: 100, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'mb1:P19', to: 'led1:A' },
        { from: 'mb1:GND', to: 'led1:K' },
      ],
      code: '',
    }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, selectTelemetry: ['led1', 'mb1'], serialNeedle: 'PWM_SEQ:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MB PWM serial:', JSON.stringify((verdict.serial || '').slice(0, 200)));
    expect(verdict.pass).toBe(true);
    // The guest programmed compare word 250 (the value the runner reads
    // out of guest RAM and feeds to the engine latch).
    expect(verdict.serial || '').toContain('PWM_SEQ:250');

    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    console.log('MB PWM LED telemetry:', JSON.stringify(led || null).slice(0, 400));
    expect(led).toBeTruthy();
    const sum = String((led && led.summary) || '') + String(JSON.stringify((led && led.details) || {}));
    // 25 % duty -> brightness 64/255, illuminated true.
    expect(/illuminated[":\s]+true/i.test(sum)).toBe(true);
    const m = /brightness[":\s]+([0-9.]+)/i.exec(sum);
    expect(m).toBeTruthy();
    const brightness = Number(m[1]);
    console.log('MB PWM brightness:', brightness);
    expect(Math.abs(brightness - 64)).toBeLessThanOrEqual(2);

    // Board telemetry carries the readback itself.
    const mb = (verdict.liveOop || {}).mb1 || {};
    console.log('MB PWM board state:', JSON.stringify(mb).slice(0, 300));
    expect(Number(mb.pwmDutyBp)).toBe(2500);
    expect(Number(mb.pwmFreqHz)).toBe(16000);
    expect(errors).toEqual([]);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
