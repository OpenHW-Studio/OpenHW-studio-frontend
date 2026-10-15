import { test, expect } from '@playwright/test';

// micro:bit v2 SAADC cell — SKIPPED until firmware + runner land.
// Engine: saadc_take_result/complete exist (nrf52833_periph_wasm.js
// lines 2189-2196) and microbit-runner.ts pumpDma ALREADY fills
// mid-scale 0x80 (no runner change needed). Missing: a fixed .bin
// image sampling SAADC CH0 and printing MB_SAADC:<raw> (no backend
// nRF core — image must be built from the nRF5 SDK like button_nrf).
// Unskip when /firmware/microbit/saadc_nrf.bin lands.
test.describe.skip('micro:bit v2 SAADC (blocked: firmware image)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('SAADC sample reads back the runner mid-scale fill', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/saadc_nrf.bin' }, x: 100, y: 100 },
      ],
      wires: [],
      code: '',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'MB_SAADC:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MB SAADC serial:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    const m = /MB_SAADC:(\d+)/.exec(verdict.serial || '');
    expect(m).toBeTruthy();
    expect(Math.abs(Number(m[1]) - 0x8080)).toBeLessThan(0x100);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
