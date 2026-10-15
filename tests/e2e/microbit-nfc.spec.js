import { test, expect } from '@playwright/test';

// micro:bit v2 NFC cell — SKIPPED until a fixed .bin image initiating an
// NFCT exchange (nfct_take_tx → MB_NFC:<frames>) lands in
// public/firmware/microbit/. Runner pump APPLIED 2026-10-09
// (microbit-runner.ts pumpSysExtras, NFC-only: taps verified in-file
// nrf52833_periph_wasm.js 1631-1700 nfct_take_tx/take_rx/complete_tx/
// complete_rx + nfct_field_present; board attr nfcField presents the RF
// field at first tick). The pump counts takes only (no peer frames
// staged — owner engine owns the air model; nfcTxFrames is the oracle,
// never faked traffic). Unskip when nfct_nrf.bin lands.
test.describe.skip('micro:bit v2 NFC (blocked: firmware image)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('NFC initiator bumps the board nfcTxFrames counter', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/nfct_nrf.bin', nfcField: true }, x: 100, y: 100 },
      ],
      wires: [],
      code: '',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['mb1'], serialNeedle: 'MB_NFC:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MB NFC serial:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('MB_NFC:');
    const mb = (verdict.telemetry || []).find((t) => t.id === 'mb1');
    const dump = JSON.stringify(mb || null);
    console.log('MB NFC board telemetry:', dump.slice(0, 300));
    expect(/nfcTxFrames["':\s]+[1-9]/.test(dump)).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
