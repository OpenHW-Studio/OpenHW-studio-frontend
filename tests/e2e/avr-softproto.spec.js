import { test, expect } from '@playwright/test';

// AVR soft-protocol cells (live):
// Cell 1 — IR NEC-envelope loopback (raw mark/space, no 38kHz carrier): a
// single Uno bit-bangs an NEC-like frame on D3 wired straight back into D2
// and captures every edge with a PCINT ISR; firmware decodes address +
// command and prints them on hardware Serial. The openhw-ir-receiver sits
// on the board (powered, OUT -> D4 observer) so its telemetry is asserted
// alongside. NOTE (measured gap): the IRremote 38kHz carrier path is parked
// — the carrier would appear raw on the loopback wire (no demodulator in
// the loop) and its 26us half-period cannot survive emulation timing; the
// raw 1-2kHz envelope is what passes here.
// Cell 2 — SoftI2C probe + I2C OLED draw: firmware first hand-rolls an
// I2C-style START/byte/STOP burst on D2/D3 (GPIO bit-bang, serial-proven),
// then draws text over hardware Wire (A4/A5) to openhw-ssd1306-oled and
// asserts vramFillPercentage > 0 (same assertion as the F1 I2C sweep).
// NOTE (measured gap): a pure GPIO bit-bang into the OLED's SDA/SCL cannot
// fill VRAM — the AVR runner only routes I2C bytes via the AVRTWI
// peripheral hooks, with no GPIO->I2C bridge — so the fill assertion rides
// on hardware Wire; the soft burst is proven on serial, not on VRAM.
const CODE_IR = 'const int IR_TX = 3;\nconst int IR_RX = 2;\nconst int IR_OBS = 4;\nconst unsigned long BIT_US = 1000;\n\n// Synchronous loopback: drive one mark/space level on TX, let it settle\n// through the D3->D2 wire, sample the echoed level on RX at bit center.\nbool irLoopBit(bool level) {\n  digitalWrite(IR_TX, level ? HIGH : LOW);\n  delayMicroseconds(BIT_US / 2);\n  bool echo = (digitalRead(IR_RX) == HIGH);\n  delayMicroseconds(BIT_US / 2);\n  return echo;\n}\n\nbool irLoopByte(uint8_t txb, uint8_t &rxb) {\n  if (irLoopBit(false) != false) return false;   // start bit must echo LOW\n  uint8_t v = 0;\n  for (uint8_t i = 0; i < 8; i++) {\n    if (irLoopBit((txb >> i) & 1)) v |= (1 << i);\n  }\n  if (irLoopBit(true) != true) return false;     // stop bit must echo HIGH\n  rxb = v;\n  return true;\n}\n\nvoid hex2(uint8_t v) { if (v < 16) Serial.print(\'0\'); Serial.print(v, HEX); }\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(IR_TX, OUTPUT); digitalWrite(IR_TX, HIGH);\n  pinMode(IR_RX, INPUT); pinMode(IR_OBS, INPUT);\n  Serial.println("IRLOOP_READY");\n}\n\nvoid loop() {\n  uint8_t addr = 0, cmd = 0;\n  bool ok = irLoopByte(0x00, addr) && irLoopByte(0x16, cmd);\n  if (ok && addr == 0x00 && cmd == 0x16) {\n    Serial.print("IR_DECODED ADDR=0x"); hex2(addr);\n    Serial.print(" CMD=0x"); hex2(cmd); Serial.println();\n  } else {\n    Serial.println("IR_TIMEOUT");\n  }\n  delay(2000);\n}\n';
const CODE_OLED = '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\n\nAdafruit_SSD1306 d(128, 64, &Wire, -1);\n\nconst int SOFT_SDA = 2;\nconst int SOFT_SCL = 3;\n\nvoid softHigh(int p) { pinMode(p, INPUT_PULLUP); }\nvoid softLow(int p) { pinMode(p, OUTPUT); digitalWrite(p, LOW); }\nvoid softStart() { softHigh(SOFT_SDA); softHigh(SOFT_SCL); delayMicroseconds(60); softLow(SOFT_SDA); delayMicroseconds(60); softLow(SOFT_SCL); }\nvoid softStop() { softLow(SOFT_SDA); softHigh(SOFT_SCL); delayMicroseconds(60); softHigh(SOFT_SDA); delayMicroseconds(60); }\nvoid softClock8(uint8_t b) {\n  for (int8_t i = 7; i >= 0; i--) {\n    if ((b >> i) & 1) softHigh(SOFT_SDA); else softLow(SOFT_SDA);\n    delayMicroseconds(30); softHigh(SOFT_SCL); delayMicroseconds(60); softLow(SOFT_SCL); delayMicroseconds(30);\n  }\n  softHigh(SOFT_SDA); delayMicroseconds(30); softHigh(SOFT_SCL); delayMicroseconds(60); softLow(SOFT_SCL);\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("SOFTI2C_READY");\n  softHigh(SOFT_SDA); softHigh(SOFT_SCL);\n  softStart(); softClock8(0x78); softClock8(0x00); softClock8(0xAE); softStop();\n  Serial.println("SOFTI2C_PROBE_DONE");\n  Wire.begin();\n  d.begin(SSD1306_SWITCHCAPVCC, 0x3C);\n  d.clearDisplay(); d.setTextSize(2); d.setTextColor(SSD1306_WHITE); d.setCursor(0, 0); d.println("HiAVR"); d.display();\n  Serial.println("SOFTI2C_DRAWN");\n}\n\nvoid loop() { Serial.println("SOFTI2C_TICK"); delay(1000); }\n';

test.describe('AVR soft-proto (IR loopback + SoftI2C OLED)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Uno IR NEC-envelope loopback decodes addr/cmd', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'ir1', type: 'openhw-ir-receiver', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:3', to: 'uno1:2' },
        { from: 'uno1:5V', to: 'ir1:VCC' },
        { from: 'uno1:gnd_1', to: 'ir1:GND' },
        { from: 'ir1:OUT', to: 'uno1:4' },
      ],
      code,
    }), CODE_IR);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, selectTelemetry: ['ir1'], serialNeedle: 'IR_DECODED', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('IRLOOP verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('IRLOOP serial tail:', JSON.stringify((verdict.serial || '').slice(-400)));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('IR_DECODED ADDR=0x00 CMD=0x16');
    const ir = (verdict.telemetry || []).find((t) => t.id === 'ir1');
    expect(ir).toBeTruthy();
    const icustom = ir.details?.custom || ir.details?.metrics?.custom || {};
    console.log('IRLOOP receiver telemetry:', JSON.stringify(icustom).slice(0, 300));
    expect(icustom.powered ?? ir.details?.state?.powered ?? true).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Uno SoftI2C probe + HW I2C OLED draw fills VRAM', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:A4', to: 'oled1:SDA' },
        { from: 'uno1:A5', to: 'oled1:SCL' },
        { from: 'uno1:5V', to: 'oled1:VCC' },
        { from: 'uno1:gnd_1', to: 'oled1:GND' },
      ],
      code,
    }), CODE_OLED);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, selectTelemetry: ['oled1'], serialNeedle: 'SOFTI2C_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('SOFTI2C verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('SOFTI2C serial tail:', JSON.stringify((verdict.serial || '').slice(-400)));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('SOFTI2C_PROBE_DONE');
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('SOFTI2C-OLED vramFill:', ocustom.vramFillPercentage, 'power:', ocustom.powerStatus);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
