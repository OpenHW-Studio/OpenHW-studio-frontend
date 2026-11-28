import { test, expect } from '@playwright/test';

// F4 chip-variant sweep (live): UART hello on each F4 silicon so every
// board in the stm32f4-emu package is proven to boot + print, not just
// the Disco F407. Shared runner mechanism; variants differ in chip/FQBN.
const VARIANTS = [
  'openhw-stm32f4',
  'openhw-stm32f401',
  'openhw-stm32f411',
  'openhw-stm32f407ve',
  'openhw-stm32f429',
];

const CODE = 'void setup(){Serial.begin(9600);Serial.println("F4SWEEP_READY");}\nvoid loop(){Serial.println("F4SWEEP_TICK");delay(500);}\n';

test.describe('F4 UART variant sweep', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const type of VARIANTS) {
    test(`F4-UART sweep (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'f41', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'F4SWEEP_TICK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`SWEEP ${type}:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
