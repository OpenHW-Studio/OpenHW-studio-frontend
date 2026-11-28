import { test, expect } from '@playwright/test';

// MicroPython die-temperature cell: `microbit.temperature()` reads the
// nRF52833 TEMP model, which the runner drives from the board's `tempC`
// attr (temp_set_celsius). Two runs (0 C / 40 C) must track the host value.
const MP_MAIN = `
from microbit import temperature
print("MP_TEMP", temperature())
`.trim() + '\n';
const RUNS = [
  { tempC: 0, needle: 'MP_TEMP 0' },
  { tempC: 40, needle: 'MP_TEMP 40' },
];

test.describe('micro:bit v2 MicroPython TEMP', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const run of RUNS) {
    test(`guest temperature() tracks ${run.tempC} C`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      await page.addInitScript(() => window.localStorage.setItem('openhw-tour-completed', 'true'));
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });

      const setup = await page.evaluate((attrs) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'mb1', type: 'openhw-microbit-v2', attrs, x: 100, y: 100 },
        ],
        wires: [],
        code: '// main.py installed below',
      }), { env: 'micropython', tempC: run.tempC });
      expect(setup.ok).toBe(true);
      const setup2 = await page.evaluate((mp) => window.OpenHWE2E.setupCircuitBoards({
        extra: { mb1: mp },
      }), MP_MAIN);
      expect(setup2.ok).toBe(true);

      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 90000, selectTelemetry: ['mb1'], serialNeedle: needle, telemetryMode: 'detail',
      }), run.needle);
      expect(verdict.ok).toBe(true);
      console.log(`MP-TEMP ${run.tempC}C reasons:`, JSON.stringify(verdict.reasons || []));
      console.log(`MP-TEMP ${run.tempC}C serial:`, JSON.stringify((verdict.serial || '').slice(-400)));
      expect(verdict.pass).toBe(true);
      expect(verdict.reasons || []).toEqual([]);
      expect(verdict.serial || '').toContain(run.needle);
      expect(errors).toEqual([]);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
