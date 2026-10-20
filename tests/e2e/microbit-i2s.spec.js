import { test, expect } from '@playwright/test';

// micro:bit v2 I2S cell — SKIPPED until a fixed .bin image streaming I2S
// TX (i2s_take_tx → MB_I2S:<words>) lands in public/firmware/microbit/.
// Runner pump APPLIED 2026-10-09 (microbit-runner.ts pumpSysExtras,
// I2S-only: taps verified in-file nrf52833_periph_wasm.js 1483-1540
// i2s_take_tx/take_rx/complete_tx/complete_rx). The pump acks taken words
// back verbatim (no consumer model — the board-state i2sTxWords count is
// the oracle, never faked traffic). Unskip when i2s_nrf.bin lands.
test.describe.skip('micro:bit v2 I2S (blocked: firmware image)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('I2S TX stream bumps the board i2sTxWords counter', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/i2s_nrf.bin' }, x: 100, y: 100 },
      ],
      wires: [],
      code: '',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['mb1'], serialNeedle: 'MB_I2S:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MB I2S serial:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('MB_I2S:');
    const mb = (verdict.telemetry || []).find((t) => t.id === 'mb1');
    const dump = JSON.stringify(mb || null);
    console.log('MB I2S board telemetry:', dump.slice(0, 300));
    expect(/i2sTxWords["':\s]+[1-9]/.test(dump)).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
