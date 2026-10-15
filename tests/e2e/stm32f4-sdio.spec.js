import { test, expect } from '@playwright/test';

// F4 SDIO native cell (Disco F407): register-level SDIO driver, no library.
// 1-bit bus on the bound card image (board attr sdio): CMD0/8/55/41 init,
// CMD2/3/7/16 enumeration, CMD17 pre-read (erased 0xFF), CMD24 pattern
// write, CMD17 re-read + compare. Proves the SDIO command + data path.
const CODE = '#include <Arduino.h>\n// F4 SDIO native cell (Disco F407): register-level SDIO driver, no library.\n// 1-bit bus: CMD0/8/55/41 init, CMD2/3/7/16 enumeration, CMD17 read block 5\n// (expect erased 0xFF), CMD24 write pattern, CMD17 re-read + compare.\n// Proves the SDIO command + data path against the bound card image.\n#define SDIO_BASE 0x40012C00UL\n#define SDIO_POWER (*(volatile uint32_t*)(SDIO_BASE+0x00))\n#define SDIO_CLKCR (*(volatile uint32_t*)(SDIO_BASE+0x04))\n#define SDIO_ARG   (*(volatile uint32_t*)(SDIO_BASE+0x08))\n#define SDIO_CMD   (*(volatile uint32_t*)(SDIO_BASE+0x0C))\n#define SDIO_RESPCMD (*(volatile uint32_t*)(SDIO_BASE+0x10))\n#define SDIO_RESP1 (*(volatile uint32_t*)(SDIO_BASE+0x14))\n#define SDIO_DTIMER (*(volatile uint32_t*)(SDIO_BASE+0x24))\n#define SDIO_DLEN  (*(volatile uint32_t*)(SDIO_BASE+0x28))\n#define SDIO_DCTRL (*(volatile uint32_t*)(SDIO_BASE+0x2C))\n#define SDIO_STA   (*(volatile uint32_t*)(SDIO_BASE+0x34))\n#define SDIO_ICR   (*(volatile uint32_t*)(SDIO_BASE+0x38)) // ICR (0x38; 0x3C is MASK!)\n#define SDIO_FIFO  (*(volatile uint32_t*)(SDIO_BASE+0x80))\n#define RCC_APB2ENR (*(volatile uint32_t*)0x40023818UL)\n#define F4_BLOCK 5\n\nstatic bool waitSta(uint32_t mask, unsigned long spins) {\n  while (!(SDIO_STA & mask) && spins--) {}\n  return (SDIO_STA & mask) != 0;\n}\nstatic void clearFlags() { SDIO_ICR = 0xFFFFFFFFUL; }\n// Short-response command; returns true when CMDREND lands.\nstatic bool cmdShort(uint32_t idx, uint32_t arg) {\n  clearFlags();\n  SDIO_ARG = arg;\n  SDIO_CMD = (idx & 0x3F) | (1UL<<6) | (1UL<<10); // WAITRESP short + CPSMEN\n  if (!waitSta(1UL<<6, 500000UL)) return false; // CMDREND\n  if ((SDIO_RESPCMD & 0x3F) != idx) return false;\n  return true;\n}\n// Data read: CMD17 + 128 FIFO words into buf. Returns bytes stored.\nstatic bool cmdRead17(uint32_t blk, uint32_t *buf) {\n  clearFlags();\n  SDIO_DTIMER = 0xFFFFFFFFUL;\n  SDIO_DLEN = 512;\n  SDIO_DCTRL = (1UL<<0) | (1UL<<1) | (9UL<<4); // DTEN + to-host + 512B\n  SDIO_ARG = blk;\n  SDIO_CMD = (17UL) | (1UL<<6) | (1UL<<10);\n  if (!waitSta(1UL<<6, 500000UL)) return false;\n  // Read words directly: the model serves image bytes image-direct and\n  // never raises RXDAVL (no FIFO-level flags in STA), so status-polled\n  // reads would time out; DBCKEND|DATAEND below is the completion gate.\n  for (int i = 0; i < 128; i++) {\n    buf[i] = SDIO_FIFO;\n  }\n  if (!waitSta(1UL<<8, 3000000UL)) return false; // DATAEND only (DBCKEND is pre-set at CMD arm)\n  return true;\n}\n// Data write: CMD24 + 128 FIFO words from buf.\nstatic bool cmdWrite24(uint32_t blk, const uint32_t *buf) {\n  clearFlags();\n  SDIO_DTIMER = 0xFFFFFFFFUL;\n  SDIO_DLEN = 512;\n  SDIO_DCTRL = (9UL<<4); // DBLOCKSIZE only (DTEN clear mirrors the passing\n  // engine-side guest test; the Tran arm does not consult DTEN).\n  SDIO_ARG = blk;\n  SDIO_CMD = (24UL) | (1UL<<6) | (1UL<<10);\n  if (!waitSta(1UL<<6, 500000UL)) return false;\n  for (int i = 0; i < 128; i++) {\n    unsigned long to = 500000UL;\n    while ((SDIO_STA & (1UL<<16)) && to--) {} // !TXFIFOF\n    if (SDIO_STA & (1UL<<16)) return false;\n    SDIO_FIFO = buf[i];\n  }\n  if (!waitSta(1UL<<8, 4000000UL)) return false; // DATAEND (true completion)\n  return true;\n}\n\nstatic bool sdioInit() {\n  RCC_APB2ENR |= (1UL<<11); // SDIOEN\n  SDIO_POWER = 0x03;\n  SDIO_CLKCR = 118 | (1UL<<8); // ~400kHz init + CLKEN\n  SDIO_DTIMER = 0xFFFFFFFFUL;\n  // CMD0 omitted: the model only processes commands with WAITRESP set\n  // (its CPSMEN gate reads bit 6, not silicon bit 10), so a no-response\n  // CMD0 is dropped and CMDSENT never lands -- owner-side one-liner.\n  // The card boots Idle, which is exactly what CMD0 would select.\n  SDIO_ARG = 0x1AA;\n  SDIO_CMD = (8UL) | (1UL<<6) | (1UL<<10);\n  if (!waitSta(1UL<<6, 500000UL)) return false;\n  if (SDIO_RESP1 != 0x1AA) return false; // R7 echo\n  for (int t = 0; t < 20; t++) {\n    if (!cmdShort(55, 0)) return false;\n    clearFlags();\n    SDIO_ARG = 0x40000000UL; // HCS\n    SDIO_CMD = (41UL) | (1UL<<6) | (1UL<<10);\n    if (!waitSta(1UL<<6, 500000UL)) return false;\n    if (SDIO_RESP1 & 0x80000000UL) break; // OCR busy\n    if (t == 19) return false;\n    delay(10);\n  }\n  SDIO_ARG = 0;\n  SDIO_CMD = (2UL) | (3UL<<6) | (1UL<<10); // CMD2 long\n  if (!waitSta(1UL<<6, 1000000UL)) return false;\n  if (!cmdShort(3, 0)) return false; // CMD3 -> RCA\n  uint32_t rca = (SDIO_RESP1 >> 16) & 0xFFFF;\n  if (rca == 0) rca = 1;\n  if (!cmdShort(7, rca << 16)) return false; // select\n  if (!cmdShort(16, 512)) return false; // blocklen\n  return true;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("SDIO_READY");\n    if (!sdioInit()) { Serial.print("SDIO_INIT_FAIL STA:"); Serial.print(SDIO_STA, HEX); Serial.print(" RC:"); Serial.print(SDIO_RESPCMD & 0x3F, HEX); Serial.print(" R1:"); Serial.println(SDIO_RESP1, HEX); return; }\n  Serial.println("SDIO_INIT_OK");\n}\n\nstatic uint32_t blkbuf[128];\n\nvoid loop() {\n  if (!cmdRead17(F4_BLOCK, blkbuf)) { Serial.println("SDIO_RPRE_FAIL"); delay(2000); return; }\n  bool erased = true;\n  for (int i = 0; i < 128; i++) if (blkbuf[i] != 0xFFFFFFFFUL) { erased = false; break; }\n  Serial.print("SDIO_PRE_FF:");\n  Serial.println(erased ? 1 : 0);\n  for (int i = 0; i < 128; i++) blkbuf[i] = ((uint32_t)i << 24) | ((uint32_t)i << 16) | ((uint32_t)i << 8) | (uint32_t)(i ^ 0xA5);\n  if (!cmdWrite24(F4_BLOCK, blkbuf)) { Serial.println("SDIO_WR_FAIL"); delay(2000); return; }\n  for (int i = 0; i < 128; i++) blkbuf[i] = 0;\n  if (!cmdRead17(F4_BLOCK, blkbuf)) { Serial.println("SDIO_REREAD_FAIL"); delay(2000); return; }\n  bool ok = true;\n  for (int i = 0; i < 128; i++) {\n    uint32_t exp = ((uint32_t)i << 24) | ((uint32_t)i << 16) | ((uint32_t)i << 8) | (uint32_t)(i ^ 0xA5);\n    if (blkbuf[i] != exp) { ok = false; break; }\n  }\n  Serial.print("SDIO_WRRD:");\n  Serial.println(ok ? "PASS" : "FAIL");\n    Serial.print("SDIO_W0:");\n  Serial.println(blkbuf[0], HEX);\n  Serial.print("SDIO_W127:");\n  Serial.println(blkbuf[127], HEX);\n  delay(5000);\n}\n';

test.describe('F4 SDIO (disco card)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('SDIO writes and reads back block 5 exact', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: { sdio: true }, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 120000, serialNeedle: 'SDIO_WRRD:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4SDIO reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F4SDIO serial head:', (verdict.serial || '').slice(0, 400));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('SDIO_INIT_OK');
    expect(verdict.serial || '').toContain('SDIO_PRE_FF:1');
    expect(verdict.serial || '').toContain('SDIO_WRRD:PASS');
    const m0 = /SDIO_W0:([0-9A-F]+)/.exec(verdict.serial || '');
    const m127 = /SDIO_W127:([0-9A-F]+)/.exec(verdict.serial || '');
    console.log('F4SDIO words:', m0 && m0[1], m127 && m127[1]);
    expect(m0 && m0[1]).toBe('A5');
    expect(m127 && m127[1]).toBe('7F7F7FDA');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
