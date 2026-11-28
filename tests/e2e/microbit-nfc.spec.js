import { test, expect } from '@playwright/test';

// micro:bit v2 NFC cell — owner `blinky/nfct_nrf.bin` (byte-copied into
// public/firmware/microbit/) drives NFCT ENABLE/SENSE/ACTIVATE + a TX frame
// and checks the driver-fed `RESP` RX frame before printing `NFC:OK` /
// `NFCT:OK`. The runner's pumpSysExtras completes the staged TX and supplies
// the peer answer; the board counters come from real engine takes.
test.describe('micro:bit v2 NFC (owner nfct_nrf.bin)', () => {
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
    // The harness installs window.OpenHWE2E asynchronously; a fixed wait
    // races on a loaded host ("Cannot read properties of undefined
    // (reading 'setupCircuit')"). Wait for it explicitly.
    await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/nfct_nrf.bin', nfcField: true }, x: 100, y: 100 },
      ],
      wires: [],
      code: '',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['mb1'], serialNeedle: 'NFCT:OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MB NFC serial:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('NFC:OK');
    expect(verdict.serial || '').toContain('NFCT:OK');
    expect(verdict.serial || '').not.toContain('NFCT:BAD');
    const mb = (verdict.telemetry || []).find((t) => t.id === 'mb1');
    const dump = JSON.stringify(mb || null);
    console.log('MB NFC board telemetry:', dump.slice(0, 300));
    expect(/nfcTxFrames["':\s]+[1-9]/.test(dump)).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
