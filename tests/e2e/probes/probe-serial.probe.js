import { test, expect } from '@playwright/test';

// PROBE (lane/pico-cov): characterize what the serial monitor actually
// captures for a Pico sketch — where the first bytes go, how lines are
// split, and whether the first print() is lost. Not a matrix cell.
test.describe('PROBE serial capture', () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('probe first-line loss on openhw-pico', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const code = 'void setup(){Serial.begin(9600);Serial.print("A");Serial.println("B");Serial.println("LINE2");Serial.println("LINE3");}\nvoid loop(){Serial.println("TICK");delay(800);}\n';
    const setup = await page.evaluate((cd) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'pico1', type: 'openhw-pico', attrs: {}, x: 100, y: 100 }],
      wires: [],
      code: cd,
    }), code);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 12000, serialNeedle: 'TICK', telemetryMode: 'detail',
    }));
    console.log('PROBE lines:', verdict.serialLines);
    console.log('PROBE serial:', JSON.stringify(verdict.serial));
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1000);
  });
});
