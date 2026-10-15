import { test, expect } from '@playwright/test';

// AVR SoftwareSerial TX decode (live): Uno bit-bangs 9600 baud on pin 10
// (runner's hardcoded softSerialTxPin); the runner's edge decoder surfaces
// bytes on the softserial serial source. SS-only firmware (no hardware
// Serial) so ingress arbitration cannot mask the decoded stream.
// RX echo stays parked (EXTI triage).
const CODE = '#include <SoftwareSerial.h>\nSoftwareSerial ss(11,10);\nvoid setup(){ss.begin(9600);ss.println("SS_TX_HELLO");}\nvoid loop(){ss.println("SS_TX_TICK");delay(1000);}\n';

test.describe('AVR SoftwareSerial TX', () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Uno SoftSerial TX decodes to serial', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 15000, serialNeedle: 'SS_TX_HELLO', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('SS_TX verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('SS_TX serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const ssFound = (verdict.serial || '').includes('SS_TX_HELLO');
    console.log('SS_TX decoded present:', ssFound);
    expect(ssFound).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
