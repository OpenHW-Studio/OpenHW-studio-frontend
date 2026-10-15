import { test, expect } from '@playwright/test';

// F1 + BMP180 (raw Wire, no lib): chip ID + temp/pressure burst.
// Same proven burst-read pattern as the MPU6050 row.
test.describe('STM32F1 I2C sensor (bluepill BMP180)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('reads chip ID and temp/pressure burst over I2C1', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/Bridge.*TR ev|SINK diag/i.test(t)) console.log('CAPTURED-TR:', t.slice(0, 160));
      } catch { /* ignore */ }
    });
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'bmp1', type: 'openhw-bmp180', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'bp1:PB7', to: 'bmp1:SDA' },
        { from: 'bp1:PB6', to: 'bmp1:SCL' },
        { from: 'bp1:SWD_3V3', to: 'bmp1:VIN' },
        { from: 'bp1:SWD_GND', to: 'bmp1:GND' },
      ],
      code: '#include <Wire.h>\nvoid setup(){Serial.begin(9600);Serial.println("BMP_READY");Wire.begin();Wire.beginTransmission(0x77);Wire.write(0xD0);Wire.endTransmission(false);Wire.requestFrom(0x77,2);int id=Wire.read();Wire.read();Serial.print("BMP_ID:");Serial.println(id,HEX);}\nvoid loop(){Wire.beginTransmission(0x77);Wire.write(0xF4);Wire.write(0x2E);Wire.endTransmission();delay(50);Wire.beginTransmission(0x77);Wire.write(0xF6);Wire.endTransmission(false);Wire.requestFrom(0x77,2);int ut=Wire.read()<<8|Wire.read();Serial.print("BMP_UT:");Serial.println(ut);delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'BMP_UT:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('BMP reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    console.log('BMP id line:', JSON.stringify((verdict.serial || '').match(/BMP_ID:[0-9A-F]*/)?.[0]));
    expect((verdict.serial || '').match(/BMP_ID:[0-9A-F]*/)?.[0]).toBe('BMP_ID:55');
    const uts = [...(verdict.serial || '').matchAll(/BMP_UT:(\d+)/g)].map((m) => Number(m[1]));
    console.log('BMP UT samples:', JSON.stringify(uts.slice(0, 4)));
    expect(uts.length).toBeGreaterThan(2);
    // UT = temp*160+32760: 25C -> 36760. Stable + room-plausible
    // proves the burst path (0xFFFF dry / 0x0000 dead both fail here).
    for (const v of uts.slice(0, 4)) expect(v > 30000 && v < 42000).toBe(true);
    expect(new Set(uts.slice(0, 4)).size).toBe(1);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
