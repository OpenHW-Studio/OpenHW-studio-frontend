import { test, expect } from '@playwright/test';

// GD32 bring-up: guest-register core cells for all three GD32 board types.
// Verbatim mirrors of the stm32f1-dma / stm32f1-crc / stm32f1-sys cells
// (DMA1 M2M copy with TCIF1 + exact checksum, CRC_DR silicon value
// FB5C7298, IWDG fire / EXTI-SWIER / BKP_DR1 magic): pin-independent,
// zero runner involvement — board ids only, no runner changes.
const TYPES = [
  { tag: 'GC8', type: 'openhw-stm32-gd32f103c8' },
  { tag: 'GCB', type: 'openhw-stm32-gd32f103cb' },
  { tag: 'GRB', type: 'openhw-stm32-gd32f103rb' },
];

const DMA_CODE = (tag) =>
  '#define RCC_AHBENR (*(volatile uint32_t*)0x40021014UL)\n#define DMA1_ISR (*(volatile uint32_t*)0x40020000UL)\n#define DMA1_IFCR (*(volatile uint32_t*)0x40020004UL)\n#define DMA1_CCR1 (*(volatile uint32_t*)0x40020008UL)\n#define DMA1_CNDTR1 (*(volatile uint32_t*)0x4002000CUL)\n#define DMA1_CPAR1 (*(volatile uint32_t*)0x40020010UL)\n#define DMA1_CMAR1 (*(volatile uint32_t*)0x40020014UL)\nstatic uint32_t src[16];\nstatic uint32_t dst[16];\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("' + tag + 'DMA_READY");\n  for (int i = 0; i < 16; i++) { src[i] = 0x1000UL + (uint32_t)i; dst[i] = 0; }\n  RCC_AHBENR |= 1UL;\n  DMA1_IFCR = 0xFUL;\n  DMA1_CPAR1 = (uint32_t)src;\n  DMA1_CMAR1 = (uint32_t)dst;\n  DMA1_CNDTR1 = 16UL;\n  DMA1_CCR1 = (1UL<<14)|(1UL<<7)|(1UL<<6)|(2UL<<8)|(2UL<<10)|(1UL<<0);\n}\nvoid loop() {\n  unsigned long to = 0;\n  while (!(DMA1_ISR & 0x2UL) && ++to < 4000000UL) {}\n  if (!(DMA1_ISR & 0x2UL)) { Serial.println("' + tag + 'DMA_TIMEOUT"); delay(2000); return; }\n  unsigned long sum = 0; int bad = 0;\n  for (int i = 0; i < 16; i++) { if (dst[i] != 0x1000UL + (uint32_t)i) bad++; sum += dst[i]; }\n  Serial.print("' + tag + 'DMA_SUM:"); Serial.println(sum);\n  Serial.print("' + tag + 'DMA_BAD:"); Serial.println(bad);\n  if (bad == 0 && sum == 65656UL) Serial.println("' + tag + 'DMA_OK");\n  else Serial.println("' + tag + 'DMA_MISMATCH");\n  delay(2000);\n}\n';

const CRC_CODE = (tag) => '#define RCC_AHBENR (*(volatile uint32_t*)0x40021014UL)\n#define CRC_DR (*(volatile uint32_t*)0x40023000UL)\n#define CRC_CR (*(volatile uint32_t*)0x40023008UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("' + tag + 'CRC_READY");\n  RCC_AHBENR |= (1UL << 6);\n  CRC_CR = 1UL;\n  CRC_DR = 0xDEADBEEFUL;\n  CRC_DR = 0x12345678UL;\n  CRC_DR = 0x00FF00FFUL;\n  uint32_t r = CRC_DR;\n  Serial.print("F1CRC_HEX:");\n  Serial.println(r, HEX);\n  Serial.print("F1CRC_DEC:");\n  Serial.println(r);\n  if (r == 0xFB5C7298UL) Serial.println("' + tag + 'CRC_OK");\n  else Serial.println("' + tag + 'CRC_MISMATCH");\n}\nvoid loop() {\n  Serial.println("F1CRC_TICK");\n  delay(1000);\n}\n';

const WDG_CODE = (tag) =>
  '#define IWDG_KR (*(volatile uint32_t*)0x40003000UL)\n#define IWDG_PR (*(volatile uint32_t*)0x40003004UL)\n#define IWDG_RLR (*(volatile uint32_t*)0x40003008UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("' + tag + 'WDG_READY");\n  IWDG_KR = 0xCCCCUL;\n  IWDG_KR = 0x5555UL;\n  IWDG_PR = 0UL;\n  IWDG_RLR = 0xFFFUL;\n  IWDG_KR = 0xAAAAUL;\n}\nvoid loop() {\n  static int phase = 0;\n  static int n = 0;\n  if (phase == 0) {\n    IWDG_KR = 0xAAAAUL;\n    Serial.print("' + tag + 'WDG_TICK:"); Serial.println(n);\n    if (++n >= 3) { phase = 1; Serial.println("' + tag + 'WDG_ARMED"); }\n    delay(3);\n  } else {\n    Serial.println("' + tag + 'WDG_SPIN");\n    delay(3);\n  }\n}\n';

const EXTI_CODE = (tag) => '#include <Arduino.h>\n#define EXTI_IMR (*(volatile uint32_t*)0x40010400UL)\n#define EXTI_SWIER (*(volatile uint32_t*)0x40010410UL)\nvolatile bool fired = false;\nvoid isr() { fired = true; }\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("' + tag + 'EXTI_READY");\n  attachInterrupt(PB0, isr, RISING);\n  EXTI_IMR |= 1UL;\n  EXTI_SWIER |= 1UL;\n  Serial.println("' + tag + 'EXTI_TRIG");\n}\nvoid loop() {\n  if (fired) { Serial.println("' + tag + 'EXTI_FIRED"); fired = false; }\n  delay(500);\n}\n';

const BKP_CODE = (tag) => '#define RCC_APB1ENR (*(volatile uint32_t*)0x4002101CUL)\n#define PWR_CR (*(volatile uint32_t*)0x40007000UL)\n#define BKP_DR1 (*(volatile uint32_t*)0x40006C04UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("' + tag + 'BKP_READY");\n  RCC_APB1ENR |= (1UL<<27)|(1UL<<28);\n  PWR_CR |= (1UL<<8);\n  BKP_DR1 = 0xCAFEUL;\n  uint32_t r = BKP_DR1;\n  Serial.print("' + tag + 'BKP_HEX:"); Serial.println(r, HEX);\n  if (r == 0xCAFEUL) Serial.println("' + tag + 'BKP_OK");\n  else Serial.println("' + tag + 'BKP_MISMATCH");\n}\nvoid loop() { delay(2000); }\n';

test.describe('GD32 core cells (DMA/CRC/WDG/EXTI/BKP)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type } of TYPES) {
    test(`DMA1 moves 16 words and raises TCIF1 (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: DMA_CODE(tag) });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 30000, serialNeedle: needle, telemetryMode: 'detail',
      }), `${tag}DMA_OK`);
      expect(verdict.ok).toBe(true);
      console.log(`${tag}DMA reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}DMA serial:`, (verdict.serial || '').slice(0, 300));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain(`${tag}DMA_SUM:65656`);
      expect(verdict.serial || '').toContain(`${tag}DMA_BAD:0`);
      expect(verdict.serial || '').not.toContain('DMA_TIMEOUT');
      expect(verdict.serial || '').not.toContain('DMA_MISMATCH');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`CRC_DR of 3 words equals the silicon value FB5C7298 (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: CRC_CODE(tag) });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 30000, serialNeedle: needle, telemetryMode: 'detail',
      }), `${tag}CRC_OK`);
      expect(verdict.ok).toBe(true);
      console.log(`${tag}CRC reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}CRC serial:`, (verdict.serial || '').slice(0, 400));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toMatch(/F1CRC_HEX:FB5C7298/i);
      expect(verdict.serial || '').toContain('F1CRC_DEC:4217139864');
      expect(verdict.serial || '').not.toContain('CRC_MISMATCH');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`IWDG fires after petting stops (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: WDG_CODE(tag) });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 45000, serialNeedle: needle, telemetryMode: 'detail',
      }), `${tag}WDG_ARMED`);
      expect(verdict.ok).toBe(true);
      console.log(`${tag}WDG reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}WDG serial:`, (verdict.serial || '').slice(-400));
      expect(verdict.pass).toBe(true);
      const serial = verdict.serial || '';
      expect(serial).toContain(`${tag}WDG_ARMED`);
      const preTicks = (serial.match(new RegExp(`${tag}WDG_TICK:`, 'g')) || []).length;
      console.log(`${tag}WDG preTicks:`, preTicks);
      expect(preTicks).toBeGreaterThanOrEqual(3);
      const armedAt = serial.indexOf(`${tag}WDG_ARMED`);
      const after = serial.slice(armedAt);
      const spinsAfter = (after.match(new RegExp(`${tag}WDG_SPIN`, 'g')) || []).length;
      const readyCount = (serial.match(new RegExp(`${tag}WDG_READY`, 'g')) || []).length;
      console.log(`${tag}WDG spinsAfter:`, spinsAfter, 'readyCount:', readyCount);
      expect(spinsAfter < 8 || readyCount >= 2).toBe(true);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`EXTI software trigger reaches the ISR (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: EXTI_CODE(tag) });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: needle, telemetryMode: 'detail',
      }), `${tag}EXTI_FIRED`);
      expect(verdict.ok).toBe(true);
      console.log(`${tag}EXTI reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}EXTI serial:`, (verdict.serial || '').slice(0, 300));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain(`${tag}EXTI_TRIG`);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`BKP_DR1 keeps its magic (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'gd1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: BKP_CODE(tag) });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((needle) => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: needle, telemetryMode: 'detail',
      }), `${tag}BKP_OK`);
      expect(verdict.ok).toBe(true);
      console.log(`${tag}BKP reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}BKP serial:`, (verdict.serial || '').slice(0, 400));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toMatch(new RegExp(`${tag}BKP_HEX:CAFE\\r?\\n`, 'i'));
      expect(verdict.serial || '').not.toContain('BKP_MISMATCH');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
