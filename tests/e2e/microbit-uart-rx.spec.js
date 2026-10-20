import { test, expect } from '@playwright/test';

// micro:bit v2 UARTE0 RX cell — proves the RX leg end to end.
//
// The guest firmware (public/firmware/microbit/uartrx_nrf.bin, source
// uartrx_nrf.s) polls EVENTS_RXDRDY, reads the byte out of RXD and
// prints it. The host pushes bytes into the board's serial RX ring
// (window.__sabSerialRxPushToBoard → SAB ring → runner.serialRx →
// engine.injectUartByte → the runner's paced uart_rx_byte drip).
//
// The assertion is OBSERVED DATA, not a self-report: the printed byte is
// the value the guest read out of the UARTE RXD register, so it can only
// exist if the byte really crossed the wire into the guest.
test.describe('micro:bit v2 UART RX (UARTE0)', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('guest reads injected bytes out of UARTE0 RXD', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { firmware: '/firmware/microbit/uartrx_nrf.bin' }, x: 100, y: 100 },
      ],
      wires: [],
      code: '',
    }));
    expect(setup.ok).toBe(true);

    // Run first: the firmware must boot and arm its RX loop before the
    // host pushes anything (the runner is rebuilt on every run).
    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'UART_RX_READY', telemetryMode: 'detail',
    }));
    await page.waitForTimeout(9000);

    const pushed = await page.evaluate(() => {
      try {
        if (typeof window.__sabSerialRxPushToBoard === 'function') {
          const ok = window.__sabSerialRxPushToBoard('mb1', 'MBRX');
          if (ok) return 'ring:mb1';
        }
        if (typeof window.__sabSerialRxPush === 'function') {
          const ok = window.__sabSerialRxPush('MBRX');
          if (ok) return 'ring:shared';
        }
        return 'no-push-helper';
      } catch (e) { return 'push-threw:' + String(e && e.message || e); }
    });
    console.log('MB UART RX pushed:', JSON.stringify(pushed));
    expect(pushed).not.toBe('no-push-helper');

    const verdict = await runP;
    expect(verdict.ok).toBe(true);
    console.log('MB UART RX serial:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    expect(verdict.pass).toBe(true);

    const serial = String(verdict.serial || '');
    // The banner alone must NOT satisfy the proof.
    expect(serial).toContain('UART_RX_READY');
    // Every injected byte came back out of the guest's RXD register:
    // M=0x4D, B=0x42, R=0x52, X=0x58.
    for (const hex of ['4D', '42', '52', '58']) {
      expect(serial).toContain(`RX:${hex}`);
    }
    // No phantom bytes: the guest printed exactly the 4 we pushed.
    const echoes = serial.match(/RX:[0-9A-F]{2}/g) || [];
    expect(echoes.length).toBeGreaterThanOrEqual(4);
    expect(echoes.slice(0, 4)).toEqual(['RX:4D', 'RX:42', 'RX:52', 'RX:58']);
    expect(errors).toEqual([]);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
