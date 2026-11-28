import { test, expect } from '@playwright/test';

// micro:bit v2 I2S cell — owner `blinky/i2s_nrf.bin` (byte-copied into
// public/firmware/microbit/) streams 8 TX bytes, checks patterned RX and
// prints `I2S:OK` once the driver releases the RAM mailbox. The runner's
// pumpSysExtras now performs that owner-bench handshake: real engine takes
// feed the board counters (i2sTxWords/i2sRxReqs), never faked traffic.
test.describe('micro:bit v2 I2S (owner i2s_nrf.bin)', () => {
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
    // The harness installs window.OpenHWE2E asynchronously; a fixed wait
    // races on a loaded host ("Cannot read properties of undefined
    // (reading 'setupCircuit')"). Wait for it explicitly.
    await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/i2s_nrf.bin' }, x: 100, y: 100 },
      ],
      wires: [],
      code: '',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['mb1'], serialNeedle: 'I2S:OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MB I2S serial:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('I2S:OK');
    expect(verdict.serial || '').not.toContain('I2S:BAD');
    const mb = (verdict.telemetry || []).find((t) => t.id === 'mb1');
    const dump = JSON.stringify(mb || null);
    console.log('MB I2S board telemetry:', dump.slice(0, 300));
    expect(/i2sTxWords["':\s]+[1-9]/.test(dump)).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
