import { test, expect } from '@playwright/test';

// F1 SPI MISO (slave -> master READ) cells — the cell that closes the
// "SPI: PARTIAL (TX/write-only; MISO-read gap)" column on the F1 boards.
//
// ROOT CAUSE of the gap (engine + runner, both proven, see the notes in
// HANDOVER-LANE-f1.md and scripts/f1-spi-miso-engine-probe.mjs):
//   The F1 engine's SPI peripheral only consults the MISO injection queue
//   when an ext device is attached to the bus. Its DR-write handler reads
//   the injected byte INSIDE the `if let Some(ref d) = device` branch and
//   falls back to a hard 0xFF with no device (engine src/peripherals/
//   spi.rs, the 0x000C write arm). The F1 runner attached only I2C
//   devices, so EVERY SPI read on the F1 clocked in 0xFF — a guest could
//   not read a single byte from an SPI slave.
//   Fix (runner-side, F1 lane): attach the engine's own SPI NOR-flash
//   model to SPI1 (stm32f1-runner.ts, the "SPI bus anchor" block). The
//   model answers the JEDEC ID (0x9F) and data reads (0x03) IN-CLOCK, and
//   its presence also re-enables the injection queue for the JS slave
//   models.
//
// CELL 1 — MFRC522 (real SPI slave, JS model, visible in the circuit):
//   The guest reads the MFRC522 VersionReg (0x37), which must be 0x92
//   (the same discriminator the AVR row uses in
//   tests/e2e/spi-delivery-disc.spec.js). The MFRC522 holds the register
//   value on MISO for every data clock, so the VALUE the guest reads is
//   the silicon value. The F1's JS-model path delivers the response on
//   the clock AFTER the byte that caused it (the runner injects
//   post-transfer), so the cell primes the pipe with one transfer and
//   asserts the value on the next one.
//
// CELL 2 — SPI NOR flash (engine-native device, all six F1 boards):
//   The guest reads the flash's JEDEC ID (C8 40 16) and one data byte
//   from address 0x10 (0xA5). The data byte lands on the clock right
//   after the 24-bit address — exactly like a real W25Q.

const BOARDS = [
  { tag: 'BP', type: 'openhw-stm32-bluepill' },
  { tag: 'MAPLE', type: 'openhw-stm32-maple-mini' },
  { tag: 'CB', type: 'openhw-stm32f103cb' },
  { tag: 'GD32C8', type: 'openhw-stm32-gd32f103c8' },
  { tag: 'GD32CB', type: 'openhw-stm32-gd32f103cb' },
  { tag: 'GD32RB', type: 'openhw-stm32-gd32f103rb' },
];

// MFRC522 register read: address byte = (reg << 1) | 0x80 (bit7 = read).
const RFID_CODE = `#include <SPI.h>
#define CS PA4
uint8_t regRead(uint8_t reg) {
  digitalWrite(CS, LOW);
  SPI.transfer(((reg << 1) & 0x7E) | 0x80);
  uint8_t v = SPI.transfer(0x00);
  digitalWrite(CS, HIGH);
  return v;
}
void setup() {
  Serial.begin(9600);
  pinMode(CS, OUTPUT); digitalWrite(CS, HIGH);
  SPI.begin();
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  delay(50);
  Serial.println("MISO_READY");
}
void loop() {
  // Priming transfer: the F1 delivers a slave's response on the clock
  // AFTER the byte that caused it, so the first transfer of a session
  // only warms the pipe.
  uint8_t prime = regRead(0x37);
  delay(20);
  uint8_t ver = regRead(0x37);
  Serial.print("PRIME:"); Serial.println(prime, HEX);
  Serial.print("VER:"); Serial.println(ver, HEX);
  if (ver == 0x92) Serial.println("MISO_OK");
  delay(300);
}
`;

// Engine-native SPI NOR flash: JEDEC ID (0x9F) + one data byte (0x03).
const FLASH_CODE = `#include <SPI.h>
#define CS PA4
void setup() {
  Serial.begin(9600);
  pinMode(CS, OUTPUT); digitalWrite(CS, HIGH);
  SPI.begin();
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  delay(50);
  Serial.println("MISO_READY");
}
void loop() {
  digitalWrite(CS, LOW);
  uint8_t id0 = SPI.transfer(0x9F);
  uint8_t id1 = SPI.transfer(0x00);
  uint8_t id2 = SPI.transfer(0x00);
  digitalWrite(CS, HIGH);
  digitalWrite(CS, LOW);
  SPI.transfer(0x03); SPI.transfer(0x00); SPI.transfer(0x00); SPI.transfer(0x10);
  uint8_t data = SPI.transfer(0x00);
  digitalWrite(CS, HIGH);
  Serial.print("JEDEC:");
  Serial.print(id0, HEX); Serial.print(id1, HEX); Serial.print(id2, HEX);
  Serial.println("");
  Serial.print("DATA:"); Serial.println(data, HEX);
  if (id0 == 0xC8 && id1 == 0x40 && id2 == 0x16 && data == 0xA5) Serial.println("MISO_OK");
  delay(300);
}
`;

test.describe('F1 SPI MISO (guest reads an SPI slave)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Blue Pill reads the MFRC522 VersionReg (0x92) over SPI1', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'rfid1', type: 'openhw-mfrc522', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'bp1:PA7', to: 'rfid1:MOSI' },
        { from: 'bp1:PA6', to: 'rfid1:MISO' },
        { from: 'bp1:PA5', to: 'rfid1:SCK' },
        { from: 'bp1:PA4', to: 'rfid1:SDA' },
        { from: 'bp1:SWD_3V3', to: 'rfid1:3V3' },
        { from: 'bp1:SWD_GND', to: 'rfid1:GND' },
      ],
      code,
    }), RFID_CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['rfid1'], serialNeedle: 'MISO_OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1MISO reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1MISO serial:', (verdict.serial || '').slice(0, 400));
    expect(verdict.pass).toBe(true);
    // The OBSERVED bytes: the guest read 0x92 out of the MFRC522.
    expect(verdict.serial || '').toMatch(/VER:92\r?\n/i);
    expect(verdict.serial || '').toContain('MISO_OK');
    // The slave's side: the model decoded the address byte + data clock.
    const rfid = (verdict.liveOop || {}).rfid1;
    console.log('F1MISO rfid liveOop:', JSON.stringify(rfid));
    expect(rfid).toBeTruthy();
    expect(Number(rfid.spiRxBytes)).toBeGreaterThan(0);
    expect(rfid.lastFrame).toEqual([0xEE, 0x00]);
    expect(Number(rfid.powered)).toBe(1);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  for (const { tag, type } of BOARDS) {
    test(`SPI NOR flash JEDEC ID + data byte over SPI1 (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          // spiFlash attr: attach the engine's own SPI NOR-flash model to
          // SPI1 (the F1 engine only has a live MISO path with a device
          // attached — see the file header).
          { id: 'bp1', type: t, attrs: { spiFlash: '0xC84016' }, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: FLASH_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 16000, serialNeedle: 'MISO_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}FLASH reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}FLASH serial:`, (verdict.serial || '').slice(0, 300));
      expect(verdict.pass).toBe(true);
      // OBSERVED bytes off the wire: the JEDEC ID triple + the data byte.
      expect(verdict.serial || '').toMatch(/JEDEC:C84016\r?\n/i);
      expect(verdict.serial || '').toMatch(/DATA:A5\r?\n/i);
      expect(verdict.serial || '').toContain('MISO_OK');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
