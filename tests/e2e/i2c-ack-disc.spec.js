import { test, expect } from '@playwright/test';

// I2C ACK discriminator: firmware reports Wire.endTransmission() status
// over serial. 0 = a model ACKed the address (runner→model path works);
// 2 = address NACK (nothing claimed 0x27); other = bus error.
test.describe('I2C ACK discriminator (live)', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('endTransmission status to 0x27', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'lcd1', type: 'openhw-lcd2004-i2c', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:A4', to: 'lcd1:SDA' },
          { from: 'uno1:A5', to: 'lcd1:SCL' },
          { from: 'uno1:5V', to: 'lcd1:VCC' },
          { from: 'uno1:gnd_1', to: 'lcd1:GND' },
        ],
        code: '#include <Wire.h>\nvoid setup(){Serial.begin(9600);Serial.println("I2C_READY");Wire.begin();Wire.beginTransmission(0x27);Wire.write(0x4D);Wire.write(0x49);Wire.write(0x8D);Wire.write(0x89);byte e=Wire.endTransmission();Serial.print("E4:");Serial.println(e);}\nvoid loop(){Wire.beginTransmission(0x27);Wire.write(0x48);byte e=Wire.endTransmission();Serial.print("E1:");Serial.println(e);delay(1500);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['lcd1'], serialNeedle: 'I2C_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('I2C-ACK serial:', JSON.stringify((verdict.serial || '').slice(0, 400)));
    const t0 = (verdict.telemetry || [])[0] || {};
    const mc = (t0.details || {}).metrics?.custom || (t0.details || {}).custom || null;
    console.log('I2C-RAWSEQ custom:', JSON.stringify(mc).slice(0, 300));
    console.log('I2C-RAWSEQ lines:', JSON.stringify(((t0.details || {}).state || {}).lines || null));
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
