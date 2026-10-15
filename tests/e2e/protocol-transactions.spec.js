import { test, expect } from '@playwright/test';

// Live I2C/SPI transaction rows beyond the display spec (plan §8 + §11):
// LCD2004 (I2C addr 0x27) driven with raw Wire writes + MFRC522 (SPI)
// driven with raw SPI transfers. Both use real backend firmware, no
// external libs. Verifies: circuit builds, sim runs, serial handshake,
// per-device telemetry entries exist (with bus activity reflected in
// details where the component reports it).
test.describe('Protocol transactions (I2C LCD + SPI RFID, live)', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('LCD2004 (I2C 0x27): raw Wire writes + telemetry entry', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
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
        code: '#include <Wire.h>\nvoid setup(){Serial.begin(9600);Serial.println("LCD_READY");Wire.begin();}\nvoid loop(){Wire.beginTransmission(0x27);Wire.write(0x48);Wire.write(0x69);Wire.endTransmission();Serial.println("LCD_TICK");delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['lcd1'], serialNeedle: 'LCD_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('LCD verdict:', JSON.stringify({
      pass: verdict.pass,
      reasons: verdict.reasons,
      serialHead: (verdict.serial || '').slice(0, 300),
      telemetry: (verdict.telemetry || []).map((t) => ({ id: t.id, type: t.type, status: t.status, summary: String(t.summary || '').slice(0, 220) })),
    }, null, 1));
    expect(verdict.pass).toBe(true);
    expect((verdict.serial || '').includes('LCD_TICK')).toBe(true);
    const lcdEntry = (verdict.telemetry || []).find((t) => t.id === 'lcd1');
    expect(lcdEntry).toBeTruthy();
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(3000);
    expect(errors.filter((e) => /OpenHWE2E|lcd2004|LCD/i.test(e))).toEqual([]);
  });

  test('MFRC522 (SPI): raw transfers + telemetry entry', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'rfid1', type: 'openhw-mfrc522', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:11', to: 'rfid1:MOSI' },
          { from: 'uno1:12', to: 'rfid1:MISO' },
          { from: 'uno1:13', to: 'rfid1:SCK' },
          { from: 'uno1:10', to: 'rfid1:SDA' },
          { from: 'uno1:9', to: 'rfid1:RST' },
          { from: 'uno1:3v3', to: 'rfid1:3V3' },
          { from: 'uno1:gnd_1', to: 'rfid1:GND' },
        ],
        code: '#include <SPI.h>\nvoid setup(){Serial.begin(9600);Serial.println("RFID_READY");SPI.begin();pinMode(10,OUTPUT);digitalWrite(10,HIGH);pinMode(9,OUTPUT);digitalWrite(9,HIGH);}\nvoid loop(){digitalWrite(10,LOW);SPI.transfer(0x37);SPI.transfer(0x00);digitalWrite(10,HIGH);Serial.println("RFID_TICK");delay(1000);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['rfid1'], serialNeedle: 'RFID_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('RFID verdict:', JSON.stringify({
      pass: verdict.pass,
      reasons: verdict.reasons,
      serialHead: (verdict.serial || '').slice(0, 300),
      telemetry: (verdict.telemetry || []).map((t) => ({ id: t.id, type: t.type, status: t.status, summary: String(t.summary || '').slice(0, 220) })),
    }, null, 1));
    expect(verdict.pass).toBe(true);
    expect((verdict.serial || '').includes('RFID_TICK')).toBe(true);
    const rfidEntry = (verdict.telemetry || []).find((t) => t.id === 'rfid1');
    expect(rfidEntry).toBeTruthy();
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(3000);
    expect(errors.filter((e) => /OpenHWE2E|mfrc522|MFRC522|rfid/i.test(e))).toEqual([]);
  });
});
