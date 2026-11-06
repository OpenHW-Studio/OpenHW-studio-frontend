import { test, expect } from '@playwright/test';

// F1 + DS1307 RTC (RTClib): set a fixed time, read it back.
// Burst register reads over I2C1 (proven MPU pattern).
test.describe('STM32F1 I2C RTC (bluepill DS1307)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('sets and reads back time over I2C1', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'rtc1', type: 'openhw-ds1307-rtc', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'bp1:PB7', to: 'rtc1:SDA' },
        { from: 'bp1:PB6', to: 'rtc1:SCL' },
        { from: 'bp1:SWD_3V3', to: 'rtc1:VCC' },
        { from: 'bp1:SWD_GND', to: 'rtc1:GND' },
      ],
      code: '#include <Wire.h>\n#include <RTClib.h>\nRTC_DS1307 rtc;\nvoid setup(){Serial.begin(9600);Serial.println("RTC_READY");Wire.begin();rtc.begin();rtc.adjust(DateTime(2026,10,7,12,0,0));}\nvoid loop(){DateTime n=rtc.now();Serial.print("RTC_NOW:");Serial.print(n.hour());Serial.print(":");Serial.print(n.minute());Serial.print(":");Serial.println(n.second());delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'RTC_NOW:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('RTC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const stamps = [...(verdict.serial || '').matchAll(/RTC_NOW:(\d+):(\d+):(\d+)/g)];
    console.log('RTC stamps:', JSON.stringify(stamps.slice(0, 3).map((m) => m[0])));
    expect(stamps.length).toBeGreaterThan(1);
    expect(Number(stamps[0][1])).toBe(12);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
