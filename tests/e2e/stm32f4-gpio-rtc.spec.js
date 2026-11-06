import { test, expect } from '@playwright/test';

// F4 GPIO-in + external RTC (all five chips): verbatim ports of the proven
// sketches — static PB0->3V3 / PB1->GND reads (the F1 gpio-in recipe; all
// F4 shells expose PB0/PB1/3V3/GND.1) and the DS1307 set/read cell over
// I2C1 (PB7/PB6 + 3V3/SWD_GND, same wiring as the F429 OLED row). No
// runner changes: the shared gpio.pin input path and I2C1 bridge are
// chip-agnostic. F429 remap note: DISCO_F429ZI Arduino defaults are
// Wire=I2C3 (PC9/PA8), so the sketch selects I2C1 explicitly
// (Wire.setSDA(PB7)/setSCL(PB6)) — same-peripheral no-op elsewhere.
// RTC read path (runner): the tap-slave spec is skipped for RTC types so
// the engine-native regfile serves guest reads (RX-queue pushes land one
// transfer late); the drain mirrors regs into the JS model for telemetry.
const TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'F401', type: 'openhw-stm32f401', id: 'f401' },
  { tag: 'F411', type: 'openhw-stm32f411', id: 'f411' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

const GPIOIN_CODE = 'void setup(){Serial.begin(9600);Serial.println("GPIOIN_READY");pinMode(PB0,INPUT);pinMode(PB1,INPUT);}\nvoid loop(){Serial.print("PB0=");Serial.print(digitalRead(PB0));Serial.print(" PB1=");Serial.println(digitalRead(PB1));delay(500);}\n';

const RTC_CODE = '#include <Wire.h>\n#include <RTClib.h>\nRTC_DS1307 rtc;\nvoid setup(){Serial.begin(9600);Serial.println("RTC_READY");Wire.setSDA(PB7);Wire.setSCL(PB6);Wire.begin();rtc.begin();rtc.adjust(DateTime(2026,10,7,12,0,0));}\nvoid loop(){DateTime n=rtc.now();Serial.print("RTC_NOW:");Serial.print(n.hour());Serial.print(":");Serial.print(n.minute());Serial.print(":");Serial.println(n.second());delay(1000);}\n';

test.describe('F4 GPIO-in + DS1307 (per-chip ports)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of TYPES) {
    test(`reads wired HIGH and LOW (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [
          { from: `${i}:3V3`, to: `${i}:PB0` },
          { from: `${i}:GND.1`, to: `${i}:PB1` },
        ],
        code,
      }), { t: type, i: id, code: GPIOIN_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'GPIOIN_READY', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}GPIOIN verdict:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}GPIOIN serial:`, (verdict.serial || '').slice(0, 300));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('PB0=1');
      expect(verdict.serial || '').toContain('PB1=0');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`DS1307 set/read over I2C1 (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'rtc1', type: 'openhw-ds1307-rtc', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: `${i}:PB7`, to: 'rtc1:SDA' },
          { from: `${i}:PB6`, to: 'rtc1:SCL' },
          { from: `${i}:3V3`, to: 'rtc1:VCC' },
          { from: `${i}:SWD_GND`, to: 'rtc1:GND' },
        ],
        code,
      }), { t: type, i: id, code: RTC_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'RTC_NOW:', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}RTC reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const stamps = [...(verdict.serial || '').matchAll(/RTC_NOW:(\d+):(\d+):(\d+)/g)];
      console.log(`${tag}RTC stamps:`, JSON.stringify(stamps.slice(0, 2).map((m) => m[0])));
      expect(stamps.length).toBeGreaterThan(1);
      expect(Number(stamps[0][1])).toBe(12);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
