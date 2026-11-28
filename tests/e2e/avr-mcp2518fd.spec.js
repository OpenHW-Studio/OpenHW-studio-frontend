import { test, expect } from '@playwright/test';

// AVR hardware SPI → MCP2518FD internal loopback (live): Uno resets the
// controller via the 0x0000 SPI command, checks the CiCON reset value,
// requests internal-loopback mode (REQOP=2, polls OPMOD), writes a 16-byte
// CAN-FD payload through the simplified TX mailbox, sets TXREQ, polls RXIF,
// and reads the echoed frame back. Human-senses proof: byte-exact payload
// round-trip over real SPI transfers (no stubs). LIMIT: single node,
// internal loopback only — two-node bus arbitration is out of scope.
const CODE = '#include <SPI.h>\nconst int CS = 10;\nuint8_t payload[16] = {0xDE,0xAD,0xBE,0xEF,0xCA,0xFE,0x01,0x23,0x45,0x67,0x89,0xAB,0xCD,0xEF,0x5A,0xA5};\nvoid spiWrite(uint16_t addr, uint8_t *d, uint8_t n) {\n  digitalWrite(CS, LOW);\n  SPI.transfer(0x20 | ((addr >> 8) & 0x0F));\n  SPI.transfer(addr & 0xFF);\n  for (uint8_t i = 0; i < n; i++) SPI.transfer(d[i]);\n  digitalWrite(CS, HIGH);\n}\nvoid spiRead(uint16_t addr, uint8_t *o, uint8_t n) {\n  digitalWrite(CS, LOW);\n  SPI.transfer(0x30 | ((addr >> 8) & 0x0F));\n  SPI.transfer(addr & 0xFF);\n  for (uint8_t i = 0; i < n; i++) o[i] = SPI.transfer(0xFF);\n  digitalWrite(CS, HIGH);\n}\nvoid spiReset() {\n  digitalWrite(CS, LOW);\n  SPI.transfer(0x00);\n  SPI.transfer(0x00);\n  digitalWrite(CS, HIGH);\n}\nvoid printHex2(uint8_t b) {\n  if (b < 16) Serial.print("0");\n  Serial.print(b, HEX);\n}\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("CANFD_INIT");\n  pinMode(CS, OUTPUT);\n  digitalWrite(CS, HIGH);\n  SPI.begin();\n  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));\n  delay(20);\n  spiReset();\n  delay(10);\n  Serial.println("CANFD_RESET");\n  uint8_t cicon[4] = {0};\n  spiRead(0x000, cicon, 4);\n  Serial.print("CICON_RST:");\n  for (uint8_t i = 0; i < 4; i++) printHex2(cicon[i]);\n  Serial.println();\n  uint8_t mode = 0x02;\n  spiWrite(0x000, &mode, 1);\n  uint8_t op = 0xFF;\n  uint8_t tries = 0;\n  do {\n    spiRead(0x000, &op, 1);\n    tries++;\n    if (((op >> 4) & 0x07) == 2) break;\n    delay(1);\n  } while (tries < 50);\n  Serial.print("OPMOD:");\n  Serial.println((op >> 4) & 0x07, HEX);\n  if (((op >> 4) & 0x07) != 2) {\n    Serial.println("CANFD_MODE_FAIL");\n    return;\n  }\n  Serial.println("CANFD_LOOPBACK_MODE");\n  uint8_t txbuf[17];\n  txbuf[0] = 16;\n  for (uint8_t i = 0; i < 16; i++) txbuf[1 + i] = payload[i];\n  spiWrite(0x400, txbuf, 17);\n  uint8_t req = 0x01;\n  spiWrite(0x500, &req, 1);\n  Serial.println("CANFD_TXREQ");\n  uint8_t istat = 0;\n  uint16_t p = 0;\n  do {\n    spiRead(0x01C, &istat, 1);\n    p++;\n    if (istat & 0x01) break;\n    delay(1);\n  } while (p < 500);\n  Serial.print("RXIF:");\n  Serial.println(istat & 0x01 ? "1" : "0");\n  if (!(istat & 0x01)) {\n    Serial.println("CANFD_RX_TIMEOUT");\n    return;\n  }\n  uint8_t rlen = 0;\n  spiRead(0x480, &rlen, 1);\n  Serial.print("RXLEN:");\n  Serial.println(rlen);\n  uint8_t rx[64] = {0};\n  if (rlen > 0 && rlen <= 64) spiRead(0x481, rx, rlen);\n  uint8_t bad = 0;\n  if (rlen != 16) bad = 1;\n  else {\n    for (uint8_t i = 0; i < 16; i++) if (rx[i] != payload[i]) bad = 1;\n  }\n  if (bad == 0) {\n    Serial.print("CANFD_LOOPBACK_OK LEN=16 DATA=");\n    for (uint8_t i = 0; i < 16; i++) printHex2(rx[i]);\n    Serial.println();\n  } else {\n    Serial.print("CANFD_LOOPBACK_FAIL LEN=");\n    Serial.print(rlen);\n    Serial.print(" DATA=");\n    for (uint8_t i = 0; i < rlen && i < 64; i++) printHex2(rx[i]);\n    Serial.println();\n  }\n}\nvoid loop() {\n  delay(1000);\n}\n';

const PAYLOAD_HEX = 'DEADBEEFCAFE0123456789ABCDEF5AA5';
const PAYLOAD = [0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE, 0x01, 0x23,
  0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF, 0x5A, 0xA5];

test.describe('AVR SPI MCP2518FD loopback (CAN-FD echo)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Uno writes a CAN-FD frame via SPI, reads back byte-exact echo', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'can1', type: 'openhw-mcp2518fd', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:11', to: 'can1:MOSI' },
        { from: 'uno1:12', to: 'can1:MISO' },
        { from: 'uno1:13', to: 'can1:SCK' },
        { from: 'uno1:10', to: 'can1:CS' },
        { from: 'uno1:5V', to: 'can1:VCC' },
        { from: 'uno1:gnd_1', to: 'can1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, selectTelemetry: ['can1'], serialNeedle: 'CANFD_LOOPBACK_OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CANFD verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('CANFD serial tail:', JSON.stringify((verdict.serial || '').slice(-400)));
    expect(verdict.pass).toBe(true);
    const serial = String(verdict.serial || '');
    expect(serial).toContain(`CANFD_LOOPBACK_OK LEN=16 DATA=${PAYLOAD_HEX}`);
    const st = (verdict.liveOop || {}).can1 || {};
    console.log('CANFD liveOop:', JSON.stringify(st).slice(0, 400));
    expect(Number(st.txCount || 0)).toBe(1);
    expect(Number(st.rxCount || 0)).toBe(1);
    expect(Array.from(st.lastRx || [])).toEqual(PAYLOAD);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
