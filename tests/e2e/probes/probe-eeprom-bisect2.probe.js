import { test, expect } from '@playwright/test';

// PROBE (lane/pico-cov): bisect the FULL pico2-periph EEPROM sketch on the
// M33 (the reduced sketch passes; the full one prints nothing).
const SKETCH = '#include <EEPROM.h>\nvoid hx(uint8_t b){if(b<16)Serial.print("0");Serial.print(b,HEX);}\nvoid setup(){Serial.begin(9600);Serial.println("S0_WARM");Serial.println("S1_BEFORE_BEGIN");EEPROM.begin(512);Serial.println("S2_AFTER_BEGIN");EEPROM.write(0x10,0xAB);Serial.println("S2A_AFTER_W10");EEPROM.write(0x11,0xCD);EEPROM.write(0x100,0x12);Serial.println("S2B_AFTER_W100");EEPROM.write(0x101,0x34);Serial.println("S3_AFTER_WRITES");EEPROM.commit();Serial.println("S4_AFTER_COMMIT");uint8_t a=EEPROM.read(0x10),b=EEPROM.read(0x11),c=EEPROM.read(0x100),d=EEPROM.read(0x101);Serial.print("PICO2_EE_RB:");hx(a);hx(b);Serial.println();Serial.print("PICO2_NVS_RB:");hx(c);hx(d);Serial.println();}\nvoid loop(){Serial.println("S6_TICK");delay(2000);}\n';

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
  console.log(`PROBE4 ${boardType} serial:`, JSON.stringify(verdict.serial));
  await page.evaluate(() => window.OpenHWE2E.stop());
  await page.waitForTimeout(1000);
}

test.describe('PROBE eeprom bisect 2', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('m0+ full eeprom bisect', async ({ page }) => {
    await probe(page, 'openhw-pico', 30000);
  });

  test('m33 full eeprom bisect', async ({ page }) => {
    await probe(page, 'openhw-pico-2', 60000);
  });
});
