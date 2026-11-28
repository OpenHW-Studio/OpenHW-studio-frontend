import { test, expect } from '@playwright/test';

// SPI delivery discriminators via pure serial evidence (no telemetry):
// 1. MFRC522 VersionReg (0x37) must read 0x92 — proves bytes reach the
//    component model and MISO returns model data, end to end.
// 2. Loopback (MOSI shorted to MISO) echoes 0x9F — proves transfer
//    completion + MISO path even with no component involved.
test.describe('SPI delivery discriminators (live serial proof)', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('MFRC522 VersionReg reads 0x92', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
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
        code: '#include <SPI.h>\nvoid setup(){Serial.begin(9600);Serial.println("SPI_READY");SPI.begin();pinMode(10,OUTPUT);digitalWrite(10,HIGH);pinMode(9,OUTPUT);digitalWrite(9,HIGH);}\nbyte reg(uint8_t r){digitalWrite(10,LOW);SPI.transfer(((r<<1)&0x7E)|0x80);byte v=SPI.transfer(0x00);digitalWrite(10,HIGH);return v;}\nvoid loop(){byte v=reg(0x37);Serial.print("VER:");Serial.println(v,HEX);delay(1500);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['rfid1'], serialNeedle: 'SPI_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('MFRC522-VER serial:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    expect((verdict.serial || '').includes('VER:92')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('MOSI-MISO loopback echoes 0x9F', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        ],
        wires: [
          { from: 'uno1:11', to: 'uno1:12' },
        ],
        code: '#include <SPI.h>\nvoid setup(){Serial.begin(9600);Serial.println("LB_READY");SPI.begin();pinMode(10,OUTPUT);digitalWrite(10,HIGH);}\nvoid loop(){digitalWrite(10,LOW);byte r=SPI.transfer(0x9F);digitalWrite(10,HIGH);Serial.print("ECHO:");Serial.println(r,HEX);delay(1500);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, serialNeedle: 'LB_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    console.log('LOOPBACK serial:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    expect((verdict.serial || '').includes('ECHO:9F')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
