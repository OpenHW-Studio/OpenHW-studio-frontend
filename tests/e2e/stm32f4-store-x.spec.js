import { test, expect } from '@playwright/test';

// F4 storage remainder (401 / 411 / 407VE / 429): verbatim ports of the
// three Disco-green storage cells — raw SPI SD block write/read
// (model-side spi_sd answers; SdFat-free guest), the SdFat FS cell
// (HELLO.TXT + hello-f4-sd round-trip against the prebuilt FAT16 image),
// and the register-level SDIO cell (CMD8/55/41/2/3/7/16 + CMD17/24, bound
// card image via the `sdio:true` board attr). No runner changes: spi_sd
// attach, the FAT16 fetch, and the sdioBlocks bind are chip-agnostic.
// Plus the 407VE DAC staircase (dac:true; same PA4->PA0 loopback sketch
// as the Disco/429 DAC cells, thresholds copied verbatim).
const TYPES = [
  { tag: 'F401', type: 'openhw-stm32f401', id: 'f401' },
  { tag: 'F411', type: 'openhw-stm32f411', id: 'f411' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

const SD_CODE = '#include <SPI.h>\nuint8_t X(uint8_t b){return SPI.transfer(b);}\nuint8_t cmd(uint8_t i,uint32_t a,uint8_t c){X(0x40|i);X(a>>24);X(a>>16);X(a>>8);X(a);uint8_t r=X(c);for(int k=0;k<64&&r==0xFF;k++)r=X(0xFF);return r;}\nvoid setup(){Serial.begin(9600);Serial.println("SD_READY");pinMode(PA4,OUTPUT);digitalWrite(PA4,HIGH);SPI.begin();SPI.beginTransaction(SPISettings(250000,MSBFIRST,SPI_MODE0));digitalWrite(PA4,HIGH);for(int i=0;i<10;i++)X(0xFF);digitalWrite(PA4,LOW);X(0xFF);delay(5);\nuint8_t r=0xFF;for(int t=0;t<10&&r==0xFF;t++){r=cmd(0,0,0x95);if(r==0xFF){digitalWrite(PA4,HIGH);X(0xFF);digitalWrite(PA4,LOW);X(0xFF);}}Serial.print("R0:");Serial.println(r,HEX);\nr=cmd(8,0x1AA,0x87);Serial.print("R8:");Serial.println(r,HEX);for(int i=0;i<4;i++){Serial.print(X(0xFF),HEX);Serial.print(" ");}Serial.println("");\nfor(int t=0;t<100;t++){cmd(55,0,0xFF);r=cmd(41,0x40000000,0xFF);if(r==0)break;}Serial.print("R41:");Serial.println(r,HEX);\nr=cmd(58,0,0xFF);Serial.print("R58:");Serial.println(r,HEX);for(int i=0;i<4;i++)X(0xFF);digitalWrite(PA4,HIGH);X(0xFF);Serial.println("SD_INIT");\ndigitalWrite(PA4,LOW);r=cmd(24,1,0xFF);Serial.print("R24:");Serial.println(r,HEX);X(0xFF);X(0xFE);for(int i=0;i<512;i++)X(i&0xFF);X(0xFF);X(0xFF);uint8_t dr=0xFF;for(int k=0;k<64&&dr==0xFF;k++)dr=X(0xFF);Serial.print("DR:");Serial.println(dr,HEX);while(X(0xFF)==0)X(0xFF);digitalWrite(PA4,HIGH);X(0xFF);Serial.println("SD_WROTE");\ndigitalWrite(PA4,LOW);r=cmd(17,1,0xFF);Serial.print("R17:");Serial.println(r,HEX);uint8_t tok=0xFF;for(int k=0;k<1000&&tok==0xFF;k++)tok=X(0xFF);Serial.print("TOK:");Serial.println(tok,HEX);int bad=0;if(tok==0xFE){for(int i=0;i<512;i++){uint8_t b=X(0xFF);if(b!=(i&0xFF))bad++;}X(0xFF);X(0xFF);}else bad=9999;digitalWrite(PA4,HIGH);X(0xFF);Serial.print("SD_BAD:");Serial.println(bad);Serial.println("SD_DONE");}\nvoid loop(){delay(1000);}\n';

const FS_CODE = '#include <SPI.h>\n#include <SD.h>\nvoid setup(){Serial.begin(9600);Serial.println("FS_READY");if(!SD.begin(PA4)){Serial.println("FS_NOINIT");return;}Serial.println("FS_INIT");File h=SD.open("HELLO.TXT",FILE_READ);if(!h){Serial.println("FS_NOOPEN");return;}while(h.available()){Serial.write(h.read());}h.close();Serial.println("FS_READ");File f=SD.open("t.txt",FILE_WRITE);f.println("hello-f4-sd");f.close();File r=SD.open("t.txt",FILE_READ);while(r.available()){Serial.write(r.read());}r.close();Serial.println("FS_DONE");}\nvoid loop(){delay(1000);}\n';

const SDIO_CODE = '#include <Arduino.h>\n// F4 SDIO native cell (Disco F407): register-level SDIO driver, no library.\n// 1-bit bus: CMD0/8/55/41 init, CMD2/3/7/16 enumeration, CMD17 read block 5\n// (expect erased 0xFF), CMD24 write pattern, CMD17 re-read + compare.\n// Proves the SDIO command + data path against the bound card image.\n#define SDIO_BASE 0x40012C00UL\n#define SDIO_POWER (*(volatile uint32_t*)(SDIO_BASE+0x00))\n#define SDIO_CLKCR (*(volatile uint32_t*)(SDIO_BASE+0x04))\n#define SDIO_ARG   (*(volatile uint32_t*)(SDIO_BASE+0x08))\n#define SDIO_CMD   (*(volatile uint32_t*)(SDIO_BASE+0x0C))\n#define SDIO_RESPCMD (*(volatile uint32_t*)(SDIO_BASE+0x10))\n#define SDIO_RESP1 (*(volatile uint32_t*)(SDIO_BASE+0x14))\n#define SDIO_DTIMER (*(volatile uint32_t*)(SDIO_BASE+0x24))\n#define SDIO_DLEN  (*(volatile uint32_t*)(SDIO_BASE+0x28))\n#define SDIO_DCTRL (*(volatile uint32_t*)(SDIO_BASE+0x2C))\n#define SDIO_STA   (*(volatile uint32_t*)(SDIO_BASE+0x34))\n#define SDIO_ICR   (*(volatile uint32_t*)(SDIO_BASE+0x38)) // ICR (0x38; 0x3C is MASK!)\n#define SDIO_FIFO  (*(volatile uint32_t*)(SDIO_BASE+0x80))\n#define RCC_APB2ENR (*(volatile uint32_t*)0x40023818UL)\n#define F4_BLOCK 5\n\nstatic bool waitSta(uint32_t mask, unsigned long spins) {\n  while (!(SDIO_STA & mask) && spins--) {}\n  return (SDIO_STA & mask) != 0;\n}\nstatic void clearFlags() { SDIO_ICR = 0xFFFFFFFFUL; }\n// Short-response command; returns true when CMDREND lands.\nstatic bool cmdShort(uint32_t idx, uint32_t arg) {\n  clearFlags();\n  SDIO_ARG = arg;\n  SDIO_CMD = (idx & 0x3F) | (1UL<<6) | (1UL<<10); // WAITRESP short + CPSMEN\n  if (!waitSta(1UL<<6, 500000UL)) return false; // CMDREND\n  if ((SDIO_RESPCMD & 0x3F) != idx) return false;\n  return true;\n}\n// Data read: CMD17 + 128 FIFO words into buf. Returns bytes stored.\nstatic bool cmdRead17(uint32_t blk, uint32_t *buf) {\n  clearFlags();\n  SDIO_DTIMER = 0xFFFFFFFFUL;\n  SDIO_DLEN = 512;\n  SDIO_DCTRL = (1UL<<0) | (1UL<<1) | (9UL<<4); // DTEN + to-host + 512B\n  SDIO_ARG = blk;\n  SDIO_CMD = (17UL) | (1UL<<6) | (1UL<<10);\n  if (!waitSta(1UL<<6, 500000UL)) return false;\n  // Read words directly: the model serves image bytes image-direct and\n  // never raises RXDAVL (no FIFO-level flags in STA), so status-polled\n  // reads would time out; DBCKEND|DATAEND below is the completion gate.\n  for (int i = 0; i < 128; i++) {\n    buf[i] = SDIO_FIFO;\n  }\n  if (!waitSta(1UL<<8, 3000000UL)) return false; // DATAEND only (DBCKEND is pre-set at CMD arm)\n  return true;\n}\n// Data write: CMD24 + 128 FIFO words from buf.\nstatic bool cmdWrite24(uint32_t blk, const uint32_t *buf) {\n  clearFlags();\n  SDIO_DTIMER = 0xFFFFFFFFUL;\n  SDIO_DLEN = 512;\n  SDIO_DCTRL = (9UL<<4); // DBLOCKSIZE only (DTEN clear mirrors the passing\n  // engine-side guest test; the Tran arm does not consult DTEN).\n  SDIO_ARG = blk;\n  SDIO_CMD = (24UL) | (1UL<<6) | (1UL<<10);\n  if (!waitSta(1UL<<6, 500000UL)) return false;\n  for (int i = 0; i < 128; i++) {\n    unsigned long to = 500000UL;\n    while ((SDIO_STA & (1UL<<16)) && to--) {} // !TXFIFOF\n    if (SDIO_STA & (1UL<<16)) return false;\n    SDIO_FIFO = buf[i];\n  }\n  if (!waitSta(1UL<<8, 4000000UL)) return false; // DATAEND (true completion)\n  return true;\n}\n\nstatic bool sdioInit() {\n  RCC_APB2ENR |= (1UL<<11); // SDIOEN\n  SDIO_POWER = 0x03;\n  SDIO_CLKCR = 118 | (1UL<<8); // ~400kHz init + CLKEN\n  SDIO_DTIMER = 0xFFFFFFFFUL;\n  // CMD0 omitted: the model only processes commands with WAITRESP set\n  // (its CPSMEN gate reads bit 6, not silicon bit 10), so a no-response\n  // CMD0 is dropped and CMDSENT never lands -- owner-side one-liner.\n  // The card boots Idle, which is exactly what CMD0 would select.\n  SDIO_ARG = 0x1AA;\n  SDIO_CMD = (8UL) | (1UL<<6) | (1UL<<10);\n  if (!waitSta(1UL<<6, 500000UL)) return false;\n  if (SDIO_RESP1 != 0x1AA) return false; // R7 echo\n  for (int t = 0; t < 20; t++) {\n    if (!cmdShort(55, 0)) return false;\n    clearFlags();\n    SDIO_ARG = 0x40000000UL; // HCS\n    SDIO_CMD = (41UL) | (1UL<<6) | (1UL<<10);\n    if (!waitSta(1UL<<6, 500000UL)) return false;\n    if (SDIO_RESP1 & 0x80000000UL) break; // OCR busy\n    if (t == 19) return false;\n    delay(10);\n  }\n  SDIO_ARG = 0;\n  SDIO_CMD = (2UL) | (3UL<<6) | (1UL<<10); // CMD2 long\n  if (!waitSta(1UL<<6, 1000000UL)) return false;\n  if (!cmdShort(3, 0)) return false; // CMD3 -> RCA\n  uint32_t rca = (SDIO_RESP1 >> 16) & 0xFFFF;\n  if (rca == 0) rca = 1;\n  if (!cmdShort(7, rca << 16)) return false; // select\n  if (!cmdShort(16, 512)) return false; // blocklen\n  return true;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("SDIO_READY");\n    if (!sdioInit()) { Serial.print("SDIO_INIT_FAIL STA:"); Serial.print(SDIO_STA, HEX); Serial.print(" RC:"); Serial.print(SDIO_RESPCMD & 0x3F, HEX); Serial.print(" R1:"); Serial.println(SDIO_RESP1, HEX); return; }\n  Serial.println("SDIO_INIT_OK");\n}\n\nstatic uint32_t blkbuf[128];\n\nvoid loop() {\n  if (!cmdRead17(F4_BLOCK, blkbuf)) { Serial.println("SDIO_RPRE_FAIL"); delay(2000); return; }\n  bool erased = true;\n  for (int i = 0; i < 128; i++) if (blkbuf[i] != 0xFFFFFFFFUL) { erased = false; break; }\n  Serial.print("SDIO_PRE_FF:");\n  Serial.println(erased ? 1 : 0);\n  for (int i = 0; i < 128; i++) blkbuf[i] = ((uint32_t)i << 24) | ((uint32_t)i << 16) | ((uint32_t)i << 8) | (uint32_t)(i ^ 0xA5);\n  if (!cmdWrite24(F4_BLOCK, blkbuf)) { Serial.println("SDIO_WR_FAIL"); delay(2000); return; }\n  for (int i = 0; i < 128; i++) blkbuf[i] = 0;\n  if (!cmdRead17(F4_BLOCK, blkbuf)) { Serial.println("SDIO_REREAD_FAIL"); delay(2000); return; }\n  bool ok = true;\n  for (int i = 0; i < 128; i++) {\n    uint32_t exp = ((uint32_t)i << 24) | ((uint32_t)i << 16) | ((uint32_t)i << 8) | (uint32_t)(i ^ 0xA5);\n    if (blkbuf[i] != exp) { ok = false; break; }\n  }\n  Serial.print("SDIO_WRRD:");\n  Serial.println(ok ? "PASS" : "FAIL");\n    Serial.print("SDIO_W0:");\n  Serial.println(blkbuf[0], HEX);\n  Serial.print("SDIO_W127:");\n  Serial.println(blkbuf[127], HEX);\n  delay(5000);\n}\n';

const DAC_CODE = 'void setup() {\n  Serial.begin(9600);\n  Serial.println("F407VEDAC_READY");\n  analogWriteResolution(12);\n  analogReadResolution(12);\n}\nvoid loop() {\n  int outs[3] = {0, 2048, 4095};\n  int vals[3];\n  for (int i = 0; i < 3; i++) {\n    analogWrite(PA4, outs[i]);\n    delay(100);\n    vals[i] = analogRead(PA0);\n  }\n  Serial.print("F407VEDAC_LOOP:");\n  Serial.print(vals[0]); Serial.print(",");\n  Serial.print(vals[1]); Serial.print(",");\n  Serial.println(vals[2]);\n  delay(2000);\n}\n';

function spiWires(i) {
  return [
    { from: `${i}:PA7`, to: 'sd1:MOSI' },
    { from: `${i}:PA6`, to: 'sd1:MISO' },
    { from: `${i}:PA5`, to: 'sd1:SCK' },
    { from: `${i}:PA4`, to: 'sd1:CS' },
    { from: `${i}:3V3`, to: 'sd1:VCC' },
    { from: `${i}:GND.1`, to: 'sd1:GND' },
    { from: `${i}:GND.2`, to: 'sd1:CD' },
  ];
}

test.describe('F4 storage remainder (SD-SPI / SD-FS / SDIO ports + VE DAC)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of TYPES) {
    test(`raw SPI block write/readback (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'sd1', type: 'openhw-sd-card', attrs: {}, x: 450, y: 120 },
        ],
        wires: spiWires(i),
        code,
      }), { t: type, i: id, code: SD_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 45000, selectTelemetry: ['sd1'], serialNeedle: 'SD_DONE', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}SD reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('SD_BAD:0');
      expect(verdict.serial || '').toContain('SD_DONE');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`FAT16 file round-trip (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'sd1', type: 'openhw-sd-card', attrs: {}, x: 450, y: 120 },
        ],
        wires: spiWires(i),
        code,
      }), { t: type, i: id, code: FS_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 60000, selectTelemetry: ['sd1'], serialNeedle: 'FS_DONE', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}FS reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('hello sd world');
      expect(verdict.serial || '').toContain('FS_DONE');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`SDIO block write/readback (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: { sdio: true }, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: SDIO_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 120000, serialNeedle: 'SDIO_WRRD:', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}SDIO reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('SDIO_INIT_OK');
      expect(verdict.serial || '').toContain('SDIO_PRE_FF:1');
      expect(verdict.serial || '').toContain('SDIO_WRRD:PASS');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }

  test('407VE DAC staircase reads back on ADC', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f47e', type: 'openhw-stm32f407ve', attrs: {}, x: 100, y: 100 },
      ],
      wires: [
        { from: 'f47e:PA4', to: 'f47e:PA0' },
      ],
      code,
    }), DAC_CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, serialNeedle: 'F407VEDAC_LOOP:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('VEDAC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const m = /F407VEDAC_LOOP:(\d+),(\d+),(\d+)/.exec(verdict.serial || '');
    console.log('VEDAC steps:', m ? m.slice(1) : 'NONE');
    expect(m).toBeTruthy();
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    expect(a).toBeLessThan(400);
    expect(b).toBeGreaterThan(1400);
    expect(b).toBeLessThan(2700);
    expect(c).toBeGreaterThan(3600);
    expect(a < b && b < c).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
