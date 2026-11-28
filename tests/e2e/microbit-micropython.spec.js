import { test, expect } from '@playwright/test';

// MicroPython on the real micro:bit v2 nRF52833 guest — not a serial boot
// string. The worker hands `main.py` to MicrobitRunner as a PYSCRIPT payload;
// the runner boots the owner MicroPython v1.18 HEX image (LSM303/KL27 TWIM1
// parts + QSPI flash), types the script into the live REPL, and the guest's
// display/pin writes must fan out to host component telemetry.
const MP_MAIN = `
from microbit import *
print("MP_MB_READY")
display.show(Image.HAPPY)
pin0.write_digital(1)
for _ in range(5):
    print("MP_MB_TICK")
`.trim() + '\n';

test.describe('micro:bit v2 MicroPython (main.py over REPL)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('guest script lights a host LED and the on-board LED matrix', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });

    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { env: 'micropython' }, x: 100, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'mb1:P0', to: 'led1:A' },
        { from: 'mb1:GND', to: 'led1:K' },
      ],
      code: '// micropython main.py is installed by setupCircuitBoards below',
    }));
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((mp) => window.OpenHWE2E.setupCircuitBoards({
      extra: { mb1: mp },
    }), MP_MAIN);
    expect(setup2.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, selectTelemetry: ['mb1', 'led1'], serialNeedle: 'MP_MB_TICK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MP-MB reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('MP-MB serial:', JSON.stringify((verdict.serial || '').slice(0, 1200)));
    console.log('MP-MB board state:', JSON.stringify((verdict.liveOop || {}).mb1 || null));
    // No weakened cell: the verdict itself must be clean.
    expect(verdict.pass).toBe(true);
    expect(verdict.reasons || []).toEqual([]);

    const serial = String(verdict.serial || '');
    // Bare lines are guest prints; echoes carry `>>> print("...")`.
    expect(/(^|\r?\n)MP_MB_READY(\r?\n|$)/.test(serial)).toBe(true);
    expect(/(^|\r?\n)MP_MB_TICK(\r?\n|$)/.test(serial)).toBe(true);
    // Real MicroPython interpreter, not the fixed-bin UARTE images.
    expect(serial).toContain('MicroPython v1.18');
    expect(serial).toContain('micro:bit v2.1.2');

    // HOST COMPONENT: the guest's `pin0.write_digital(1)` reached the LED
    // model wired to edge pin P0 (P0.02).
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    console.log('MP-MB LED telemetry:', JSON.stringify(led || null).slice(0, 500));
    expect(led).toBeTruthy();
    const lsum = String(led.summary || '') + String(JSON.stringify(led.details || {}));
    expect(/illuminated[":\s]+true/i.test(lsum)).toBe(true);

    // On-board matrix: `display.show(Image.HAPPY)` drives CODAL's 5x5 scan
    // out through the engine's matrix_state(). matrixLit is the instantaneous
    // row (2 at a sample); matrixLitUnion is the runner's sticky mask across
    // the run — a displayed image must light at least 5 distinct pixels.
    const mb = (verdict.telemetry || []).find((t) => t.id === 'mb1');
    const union = Number((verdict.liveOop || {}).mb1?.matrixLitUnion ?? mb?.details?.state?.matrixLitUnion ?? NaN);
    console.log('MP-MB matrixLitUnion:', union, 'board telemetry:', JSON.stringify(mb || null).slice(0, 300));
    expect(Number.isFinite(union)).toBe(true);
    expect(union).toBeGreaterThanOrEqual(5);
    expect(errors).toEqual([]);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
