import { test, expect } from '@playwright/test';

// AVR control cell (live): bare Uno, Serial-only hello. Proves the harness
// shape (single board, no wires) prints before protocol cells build on it.
const CODE = 'void setup(){Serial.begin(9600);Serial.println("CTRL_ALIVE");}\nvoid loop(){Serial.println("CTRL_TICK");delay(500);}\n';

test.describe('AVR control', () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Uno Serial-only control prints', async ({ page }) => {
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
      forMs: 12000, serialNeedle: 'CTRL_ALIVE', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CTRL verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
