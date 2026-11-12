import { test, expect } from '@playwright/test';

// Pico wireless-variant sweep (live): UART hello on each Pico board in the
// pico-emu package (RP2040 + RP2350, base + W + ETH). Same silicon as the
// proven pico/pico2 cells; proves every package board boots + prints.
const VARIANTS = [
  'openhw-pico',
  'openhw-pico-w',
  'openhw-pico-eth',
  'openhw-pico-2',
  'openhw-pico-2-w',
  'openhw-pico-2-eth',
];

const CODE = 'void setup(){Serial.begin(9600);Serial.println("PICOSWEEP_READY");}\nvoid loop(){Serial.println("PICOSWEEP_TICK");delay(500);}\n';

test.describe('Pico UART variant sweep', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const type of VARIANTS) {
    test(`Pico-UART sweep (${type})`, async ({ page }) => {
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'p1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'PICOSWEEP_TICK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`SWEEP ${type}:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
