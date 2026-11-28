import { test, expect } from '@playwright/test';

// PROBE (lane/pico-cov): M33 EEPROM in the browser — capture the page
// console so a compile failure is visible, and print the raw serial.
test.describe('PROBE pico2 eeprom', () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('probe M33 eeprom on openhw-pico-2', async ({ page }) => {
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`.slice(0, 400)));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e).slice(0, 400)}`));
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const code = '#include <EEPROM.h>\nvoid hx(uint8_t b){if(b<16)Serial.print("0");Serial.print(b,HEX);}\nvoid setup(){Serial.begin(9600);Serial.println("PICO2_EE_READY");EEPROM.begin(512);EEPROM.write(0x10,0xAB);EEPROM.write(0x11,0xCD);EEPROM.write(0x100,0x12);EEPROM.write(0x101,0x34);EEPROM.commit();uint8_t a=EEPROM.read(0x10),b=EEPROM.read(0x11),c=EEPROM.read(0x100),d=EEPROM.read(0x101);Serial.print("PICO2_EE_RB:");hx(a);hx(b);Serial.println();Serial.print("PICO2_NVS_RB:");hx(c);hx(d);Serial.println();}\nvoid loop(){Serial.println("PICO2_EE_TICK");delay(2000);}\n';
    const setup = await page.evaluate((cd) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'pico2', type: 'openhw-pico-2', attrs: {}, x: 100, y: 100 }],
      wires: [],
      code: cd,
    }), code);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, serialNeedle: "PICO2_NVS_RB:", telemetryMode: 'detail',
    }));
    console.log('PROBE2 verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('PROBE2 serial:', JSON.stringify(verdict.serial));
    console.log('PROBE2 console tail:', JSON.stringify(logs.slice(-25)));
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1000);
  });
});
