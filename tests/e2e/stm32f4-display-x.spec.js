import { test, expect } from '@playwright/test';

// F4 display remainder on the remaining flag-true chips (Disco F407 +
// 407VE), plus an SPI ILI9341 TFT cell for every F4 board. No runner
// changes: the ltdc-display sink binds (dcmi / qspi / fsmc cells), the
// FSMC 8080 handler is chip-agnostic.
//   DCMI/FSMC: same guest pokes + sink assertions as the F429 cells.
//     Real F407 silicon has both (DCMI + FSMC/FSMC-like FMC) — honest.
//   QSPI: same indirect+mmap compare. Carries the MODEL-EXTENSION label:
//     no QUADSPI exists on ANY F4 silicon (F7-first); the cell proves the
//     engine's flash-image plumbing, like the F429 original.
//   CUT (silicon honesty, 2026-10-09): LTDC + SAI subtests removed from
//     this file. Real STM32F407 silicon has NEITHER LTDC NOR SAI1 (ST
//     RM0090/DS_G407 peripheral list; LTDC is F429/F439-only, SAI is
//     F446/F469/F7/H7-first). The engine CHIPS table claims
//     ltdc:true/sai:[1] on stm32f407/407ve (site/stm32f4.js:92-101) —
//     model-only passes there would masquerade as hardware proof, so the
//     LTDC gradient + SAI ramp cells live on F429 only (see
//     stm32f4-ltdc.spec.js / stm32f4-sai.spec.js).
//   ILI9341: the ESP32-proven raw-SPI recipe (reset pulse, init, CASET/
//     PASET, RAMWR fill) on SPI1 PA7/PA5 + PB0(CS)/PB1(DC)/PA9(RST).
//     Proof is model-side (writeCount + vramFill), same shared SPI bridge.
// SINK BINDING: each ltdc-display sink MUST carry attrs.cell
// ('dcmi'/'qspi'/'fsmc') — without it the runner binds nothing and the
// cell is RED-by-construction (f4Cell='' → no cameraFrame/qspiImage/
// fsmcDevices tap, DCMI_SRC/QSPI_MMAP/FSMC_PX markers never fire).
const DISP_TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
];

const TFT_TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'F401', type: 'openhw-stm32f401', id: 'f401' },
  { tag: 'F411', type: 'openhw-stm32f411', id: 'f411' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

const DCMI_CODE = '#define DCMI_BASE 0x50050000UL\n#define DCR(o) (*(volatile uint32_t*)(DCMI_BASE + (o)))\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("DCMI_READY");\n  (*(volatile uint32_t*)0x40023834UL) |= 1UL;\n  DCR(0x0C) = 0x1FUL;\n}\nvoid loop() {\n  DCR(0x10) = 0x1FUL;\n  DCR(0x00) = 0; DCR(0x00) = 1;\n  unsigned long to = 3000000UL, v = 0;\n  while (to--) { v = DCR(0x28); if (v & 0xFFUL) break; }\n  unsigned long sum = 0;\n  if (v & 0xFFUL) { sum = v & 0xFFUL; for (int i = 1; i < 16; i++) sum += DCR(0x28) & 0xFFUL; }\n  Serial.print("DCMI_SUM:"); Serial.println(sum, HEX);\n  if (sum == 0x178UL) Serial.println("DCMI_OK");\n  delay(2000);\n}\n';

const QSPI_CODE = '#define QSPI_BASE 0xA0001000UL\n#define QR(o) (*(volatile uint32_t*)(QSPI_BASE + (o)))\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("QSPI_READY");\n  QR(0x00) = 1;\n}\nvoid loop() {\n  unsigned long ind[4], mm[4];\n  for (int i = 0; i < 4; i++) {\n    QR(0x04) = 0;\n    QR(0x18) = (unsigned long)(i * 4);\n    QR(0x10) = 3;\n    QR(0x14) = (1UL<<28)|(3UL<<24);\n    ind[i] = QR(0x20);\n    unsigned long to = 1000000UL;\n    while ((QR(0x08) & 2UL) == 0 && to--) {}\n    QR(0x0C) = 2UL;\n  }\n  QR(0x14) = (3UL<<28)|(3UL<<24);\n  volatile unsigned short *mp = (volatile unsigned short *)0x90000000UL;\n  for (int i = 0; i < 4; i++) mm[i] = ((unsigned long)mp[i*2+1] << 16) | mp[i*2];\n  int ok = 1; for (int i = 0; i < 4; i++) if (ind[i] != mm[i]) ok = 0;\n  Serial.print("QSPI_W0:"); Serial.println(ind[0], HEX);\n  Serial.print("QSPI_IND:");\n  for (int i = 0; i < 4; i++) { Serial.print(ind[i], HEX); Serial.print(i < 3 ? "," : ""); }\n  Serial.println();\n  Serial.print("QSPI_MM:");\n  for (int i = 0; i < 4; i++) { Serial.print(mm[i], HEX); Serial.print(i < 3 ? "," : ""); }\n  Serial.println();\n  if (ok) Serial.println("QSPI_OK");\n  delay(2000);\n}\n';

const FSMC_CODE = '#define RCC_AHB3ENR (*(volatile uint32_t*)0x40023838UL)\n#define FSMC_BCR1 (*(volatile uint32_t*)0xA0000000UL)\n#define FSMC_BTR1 (*(volatile uint32_t*)0xA0000004UL)\n#define LCD_CMD (*(volatile unsigned short*)0x60000000UL)\n#define LCD_DATA (*(volatile unsigned short*)(0x60000000UL + (1UL<<17)))\n#define BANK4_CELL (*(volatile unsigned short*)0x90000000UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("FSMC_READY");\n  RCC_AHB3ENR |= 1UL;\n  FSMC_BCR1 = (1UL<<0)|(1UL<<4)|(1UL<<12);\n  FSMC_BTR1 = 0x1053UL;\n}\nvoid loop() {\n  LCD_CMD = 0x2A; LCD_DATA = 0x0000; LCD_DATA = 0x00EF;\n  LCD_CMD = 0x2C;\n  for (int i = 0; i < 64; i++) LCD_DATA = (unsigned short)(0xF800 + i);\n  LCD_CMD = 0x04;\n  delay(50);\n  unsigned short id = LCD_DATA;\n  Serial.print("FSMC_ID:"); Serial.println(id, HEX);\n  if (id == 0x9341) Serial.println("FSMC read OK");\n  BANK4_CELL = 0xDEAD;\n  if (BANK4_CELL == 0) Serial.println("FSMC_BANK4_OK");\n  delay(2000);\n}\n';

const TFT_CODE = '#include <SPI.h>\n#define CS PB0\n#define DC PB1\n#define RST PA9\nvoid cmd(uint8_t c){digitalWrite(DC,LOW);digitalWrite(CS,LOW);SPI.transfer(c);digitalWrite(CS,HIGH);}\nvoid dat(uint8_t d){digitalWrite(DC,HIGH);digitalWrite(CS,LOW);SPI.transfer(d);digitalWrite(CS,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("TFT_READY");pinMode(CS,OUTPUT);pinMode(DC,OUTPUT);pinMode(RST,OUTPUT);digitalWrite(CS,HIGH);digitalWrite(RST,HIGH);delay(20);digitalWrite(RST,LOW);delay(20);digitalWrite(RST,HIGH);delay(150);SPI.begin();SPI.beginTransaction(SPISettings(8000000,MSBFIRST,SPI_MODE0));cmd(0x01);delay(130);cmd(0x11);delay(130);cmd(0x3A);dat(0x55);cmd(0x36);dat(0x48);cmd(0x2A);dat(0);dat(0);dat(0);dat(239);cmd(0x2B);dat(0);dat(0);dat(1);dat(63);cmd(0x29);delay(20);cmd(0x2C);digitalWrite(DC,HIGH);digitalWrite(CS,LOW);for(int i=0;i<240*10;i++){SPI.transfer(0xF8);SPI.transfer(0x00);}digitalWrite(CS,HIGH);Serial.println("TFT_DRAWN");}\nvoid loop(){Serial.println("TFT_TICK");delay(2000);}\n';

test.describe('F4 display remainder (DCMI/QSPI/FSMC + TFT)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of DISP_TYPES) {
    // CUT: LTDC gradient subtest removed — real F407 silicon has no LTDC
    // (F429/F439-only); the engine CHIPS flag overclaims. F429 LTDC proof
    // lives in stm32f4-ltdc.spec.js.
    test(`DCMI capture drains the fed pattern (${type})`, async ({ page }) => {
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'lcd1', type: 'openhw-ltdc-display', attrs: { cell: 'dcmi' }, x: 450, y: 120 },
        ],
        wires: [
          { from: `${i}:3V3`, to: 'lcd1:VCC' },
          { from: `${i}:GND.1`, to: 'lcd1:GND' },
        ],
        code,
      }), { t: type, i: id, code: DCMI_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 120000, selectTelemetry: ['lcd1'], serialNeedle: 'DCMI_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}DCMI reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('DCMI_SUM:178');
      expect(verdict.serial || '').toContain('DCMI_SRC:PASS');
      const sink = (verdict.liveOop || {}).lcd1;
      expect(sink).toBeTruthy();
      expect(Number(sink.fbW)).toBe(4);
      expect(Number(sink.fbH)).toBe(4);
      expect(Number(sink.litPixels)).toBe(16);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`QSPI flash readback matches the sink (${type}) [MODEL-EXTENSION: no QSPI on F4 silicon]`, async ({ page }) => {
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'lcd1', type: 'openhw-ltdc-display', attrs: { cell: 'qspi' }, x: 450, y: 120 },
        ],
        wires: [
          { from: `${i}:3V3`, to: 'lcd1:VCC' },
          { from: `${i}:GND.1`, to: 'lcd1:GND' },
        ],
        code,
      }), { t: type, i: id, code: QSPI_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 120000, selectTelemetry: ['lcd1'], serialNeedle: 'QSPI_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}QSPI reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('QSPI_W0:8010000');
      expect(verdict.serial || '').toContain('QSPI_MMAP:PASS');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`FSMC 8080 burst reaches the sink (${type})`, async ({ page }) => {
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'lcd1', type: 'openhw-ltdc-display', attrs: { cell: 'fsmc' }, x: 450, y: 120 },
        ],
        wires: [
          { from: `${i}:3V3`, to: 'lcd1:VCC' },
          { from: `${i}:GND.1`, to: 'lcd1:GND' },
        ],
        code,
      }), { t: type, i: id, code: FSMC_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 120000, selectTelemetry: ['lcd1'], serialNeedle: 'FSMC read OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}FSMC reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('FSMC_ID:9341');
      expect(verdict.serial || '').toContain('FSMC_BANK4_OK');
      expect(verdict.serial || '').toContain('FSMC_PX:64');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
    // CUT: SAI ramp subtest removed — real F407 silicon has no SAI
    // (F446/F469/F7/H7-first); the engine CHIPS sai:[1] flag overclaims.
    // F429 SAI proof lives in stm32f4-sai.spec.js.
  }

  for (const { tag, type, id } of TFT_TYPES) {
    test(`ILI9341 shows the firmware fill over SPI1 (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
          { id: 'tft1', type: 'openhw-ili9341', attrs: {}, x: 450, y: 120 },
        ],
        wires: [
          { from: `${i}:PB0`, to: 'tft1:CS' },
          { from: `${i}:PA9`, to: 'tft1:RESET' },
          { from: `${i}:PB1`, to: 'tft1:DC' },
          { from: `${i}:PA7`, to: 'tft1:MOSI' },
          { from: `${i}:PA5`, to: 'tft1:SCK' },
          { from: `${i}:PA6`, to: 'tft1:MISO' },
          { from: `${i}:3V3`, to: 'tft1:LED' },
          { from: `${i}:3V3`, to: 'tft1:VCC' },
          { from: `${i}:GND.1`, to: 'tft1:GND' },
        ],
        code,
      }), { t: type, i: id, code: TFT_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 45000, selectTelemetry: ['tft1'], serialNeedle: 'TFT_DRAWN', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}TFT reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const tft = (verdict.telemetry || []).find((t) => t.id === 'tft1');
      expect(tft).toBeTruthy();
      const custom = tft.details?.custom || tft.details?.metrics?.custom || {};
      console.log(`${tag}TFT custom:`, JSON.stringify(custom).slice(0, 300));
      expect(Number(custom.writeCount ?? 0)).toBeGreaterThan(1000);
      expect(Number(custom.vramFillPercentage ?? 0)).toBeGreaterThan(0);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
