import { test, expect } from '@playwright/test';

// micro:bit v2 NVS cell — SKIPPED until the runner NVMC erase-pump patch
// (.tmp-vitest/esp32-mbit-retro-patches.md §MB-2) + a fixed .bin image
// (erase one flash page, write a magic word, read back, print
// MB_NVS:<magic>) land. Word writes have no tap (synchronous in-model);
// the erase->write->readback needle fails loudly if that is wrong.
test.describe.skip('micro:bit v2 NVS (blocked: runner patch + firmware)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('flash page erase -> write -> readback roundtrips magic', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/nvs_nrf.bin' }, x: 100, y: 100 },
      ],
      wires: [],
      code: '',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'MB_NVS:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MB NVS serial:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('MB_NVS:CAFEBABE');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
