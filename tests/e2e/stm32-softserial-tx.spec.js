import { test, expect } from '@playwright/test';

// F1 SoftwareSerial TX decode (live): Bluepill bit-bangs 9600 baud on
// PB7 (runner's softSerial observer: change-event arm + sub-bit polling
// with self-calibration). SS-only firmware so ingress arbitration
// cannot mask the decoded stream (AVR lesson).
const CODE = '#include <SoftwareSerial.h>\nSoftwareSerial ss(PB6, PB7);\nvoid setup(){ss.begin(9600);ss.println("F1SS_TX_HELLO");}\nvoid loop(){ss.println("F1SS_TX_TICK");delay(1000);}\n';

test.describe('F1 SoftwareSerial TX', () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Bluepill SoftSerial TX decodes to serial', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    // Needle is the LOOP print, not the setup HELLO: the page arbitrates
    // one serial source per 240ms window (useSerialIngress) and the boot
    // burst (uart0 first) masks a setup-once softserial line (proven F1-wide
    // alongside the marker-steals-setup hunt). Loop TICKs prove the same
    // TX-decode path deterministically.
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'F1SS_TX_TICK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1SS verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1SS serial head:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('F1SS_TX_TICK');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
