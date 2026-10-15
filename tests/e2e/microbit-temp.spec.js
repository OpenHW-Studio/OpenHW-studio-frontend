import { test, expect } from '@playwright/test';

// micro:bit v2 TEMP cell — SKIPPED until the runner TEMP patch
// (.tmp-vitest/esp32-mbit-retro-patches.md §MB-1) + a fixed .bin image
// reading NRF_TEMP (TASKS_START -> poll EVENTS_DATARDY -> TEMP.TEMP)
// printing MB_TEMP:<raw> land. Board attr tempC drives
// temp_set_celsius (engine line 2277, synchronous). Two runs (0 C vs
// 40 C) must track. Unskip when both land.
const RUNS = [
  { tempC: 0, tag: 'MB_TEMP_COLD' },
  { tempC: 40, tag: 'MB_TEMP_HOT' },
];

test.describe.skip('micro:bit v2 TEMP (blocked: runner patch + firmware)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const run of RUNS) {
    test(`die temp tracks board attr (${run.tempC} C)`, async ({ page }) => {
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ tempC }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/temp_nrf.bin', tempC }, x: 100, y: 100 },
        ],
        wires: [],
        code: '',
      }), { tempC: run.tempC });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'MB_TEMP:', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`MB TEMP ${run.tempC}C serial:`, (verdict.serial || '').slice(0, 200));
      expect(verdict.pass).toBe(true);
      const m = /MB_TEMP:(-?\d+)/.exec(verdict.serial || '');
      expect(m).toBeTruthy();
      console.log(run.tag, Number(m[1]));
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
