import { test, expect } from '@playwright/test';

// PROBE (lane/pico-cov): bisect WHERE the M33 EEPROM sketch stalls in the
// browser (it prints nothing after the first line; headless/native the very
// same UF2 completes). Prints a marker after every EEPROM step.
const SKETCH = '#include <EEPROM.h>\nvoid setup(){Serial.begin(9600);Serial.println("S0_WARM");Serial.println("S1_BEFORE_BEGIN");EEPROM.begin(512);Serial.println("S2_AFTER_BEGIN");EEPROM.write(0x10,0xAB);Serial.println("S3_AFTER_WRITE");EEPROM.commit();Serial.println("S4_AFTER_COMMIT");Serial.println("S5_DONE");}\nvoid loop(){Serial.println("S6_TICK");delay(2000);}\n';

async function probe(page, boardType, forMs) {
  await page.addInitScript(() => {
    window.localStorage.setItem('openhw-tour-completed', 'true');
  });
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const setup = await page.evaluate(([bt, cd]) => window.OpenHWE2E.setupCircuit({
    components: [{ id: 'b1', type: bt, attrs: {}, x: 100, y: 100 }],
    wires: [],
    code: cd,
  }), [boardType, SKETCH]);
  expect(setup.ok).toBe(true);
  const verdict = await page.evaluate((ms) => window.OpenHWE2E.run({
    forMs: ms, serialNeedle: 'S6_TICK', telemetryMode: 'detail',
  }), forMs);
  console.log(`PROBE3 ${boardType} serial:`, JSON.stringify(verdict.serial));
  await page.evaluate(() => window.OpenHWE2E.stop());
  await page.waitForTimeout(1000);
}

test.describe('PROBE eeprom bisect', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('m0+ eeprom bisect', async ({ page }) => {
    await probe(page, 'openhw-pico', 30000);
  });

  test('m33 eeprom bisect', async ({ page }) => {
    await probe(page, 'openhw-pico-2', 60000);
  });
});
