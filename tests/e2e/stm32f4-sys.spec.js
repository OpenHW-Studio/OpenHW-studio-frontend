import { test, expect } from '@playwright/test';

// F4 system blocks (Disco F407 / 407VE / 429) — guest-side proof, zero
// runner changes. Four narrow cells, one board loop:
//   IWDG: same pet-then-arm design as the F1 cell (IWDG @0x40003000 is
//     identical on F4). Fires -> core stops (is_watchdog_reset_requested)
//     or reboots; an unmodeled IWDG keeps spinning.
//   EXTI: attachInterrupt(PB0, RISING) + EXTI_SWIER trigger. NOTE the F4
//     EXTI base is 0x40013C00 (not the F1 0x40010400).
//   BKP: backup-domain write/readback of RTC_BKP0R @0x40002850 (PWR DBP +
//     PWREN on the F4 RCC_APB1ENR @0x40023840).
//   HASH: SHA-256("") via raw pokes (AHB2 HASHEN, INIT+ALGO=SHA-256,
//     16-word padding block, DCIS poll, HR0-7 compare against the FIPS
//     vector e3b0c442...7852b855). Proves the HASH engine, not just regs.
// CRYP/AES is NOT covered here (follow-up cell, same file pattern).
const TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

const WDG_CODE = (tag) =>
  '#define IWDG_KR (*(volatile uint32_t*)0x40003000UL)\n#define IWDG_PR (*(volatile uint32_t*)0x40003004UL)\n#define IWDG_RLR (*(volatile uint32_t*)0x40003008UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("' + tag + 'WDG_READY");\n  IWDG_KR = 0xCCCCUL;\n  IWDG_KR = 0x5555UL;\n  IWDG_PR = 0UL;\n  IWDG_RLR = 20000UL;\n  IWDG_KR = 0xAAAAUL;\n}\nvoid loop() {\n  static int phase = 0;\n  static int n = 0;\n  if (phase == 0) {\n    IWDG_KR = 0xAAAAUL;\n    Serial.print("' + tag + 'WDG_TICK:"); Serial.println(n);\n    if (++n >= 3) { phase = 1; Serial.println("' + tag + 'WDG_ARMED"); }\n    delay(300);\n  } else {\n    Serial.println("' + tag + 'WDG_SPIN");\n    delay(300);\n  }\n}\n';

const EXTI_CODE = '#include <Arduino.h>\n#define EXTI_IMR (*(volatile uint32_t*)0x40013C00UL)\n#define EXTI_SWIER (*(volatile uint32_t*)0x40013C10UL)\nvolatile bool fired = false;\nvoid isr() { fired = true; }\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("EXTI_READY");\n  attachInterrupt(PB0, isr, RISING);\n  EXTI_IMR |= 1UL;\n  EXTI_SWIER |= 1UL;\n  Serial.println("EXTI_TRIG");\n}\nvoid loop() {\n  if (fired) { Serial.println("EXTI_FIRED"); fired = false; }\n  delay(500);\n}\n';

const BKP_CODE = '#define RCC_APB1ENR (*(volatile uint32_t*)0x40023840UL)\n#define PWR_CR (*(volatile uint32_t*)0x40007000UL)\n#define RTC_BKP0R (*(volatile uint32_t*)0x40002850UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("BKP_READY");\n  RCC_APB1ENR |= (1UL<<28);\n  PWR_CR |= (1UL<<8);\n  RTC_BKP0R = 0xCAFE1234UL;\n  uint32_t r = RTC_BKP0R;\n  Serial.print("BKP_HEX:"); Serial.println(r, HEX);\n  if (r == 0xCAFE1234UL) Serial.println("BKP_OK");\n  else Serial.println("BKP_MISMATCH");\n}\nvoid loop() { delay(2000); }\n';

const HASH_CODE = '#define RCC_AHB2ENR (*(volatile uint32_t*)0x40023834UL)\n#define HASH_CR (*(volatile uint32_t*)0x50060400UL)\n#define HASH_DIN (*(volatile uint32_t*)0x50060404UL)\n#define HASH_SR (*(volatile uint32_t*)0x50060430UL)\n#define HASH_HR(i) (*(volatile uint32_t*)(0x5006040CUL + (i)*4UL))\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("HASH_READY");\n  RCC_AHB2ENR |= (1UL<<5);\n  HASH_CR = (1UL<<2)|(3UL<<7);\n  HASH_DIN = 0x80000000UL;\n  for (int i = 1; i < 16; i++) HASH_DIN = 0UL;\n  unsigned long to = 0;\n  while (!(HASH_SR & 0x2UL) && ++to < 8000000UL) {}\n  if (!(HASH_SR & 0x2UL)) { Serial.println("HASH_TIMEOUT"); return; }\n  static const uint32_t exp[8] = {0xE3B0C442UL,0x98FC1C14UL,0x9AFBF4C8UL,0x996FB924UL,0x27AE41E4UL,0x649B934CUL,0xA495991BUL,0x7852B855UL};\n  int bad = 0;\n  for (int i = 0; i < 8; i++) {\n    uint32_t h = HASH_HR(i);\n    Serial.print("HASH_HR"); Serial.print(i); Serial.print(":"); Serial.println(h, HEX);\n    if (h != exp[i]) bad++;\n  }\n  if (bad == 0) Serial.println("HASH_OK");\n  else Serial.println("HASH_MISMATCH");\n}\nvoid loop() { delay(2000); }\n';

test.describe('F4 system blocks (IWDG / EXTI-SWIER / BKP / HASH)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of TYPES) {
    test(`IWDG fires after petting stops (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: WDG_CODE(tag) });
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
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: EXTI_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'EXTI_FIRED', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}EXTI reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}EXTI serial:`, (verdict.serial || '').slice(0, 300));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('EXTI_TRIG');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`RTC_BKP0R keeps its magic (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: BKP_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'BKP_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}BKP reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toMatch(/BKP_HEX:CAFE1234/i);
      expect(verdict.serial || '').not.toContain('BKP_MISMATCH');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });

    test(`SHA-256 of the empty string (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: HASH_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 30000, serialNeedle: 'HASH_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}HASH reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}HASH serial:`, (verdict.serial || '').slice(0, 400));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toMatch(/HASH_HR0:E3B0C442/i);
      expect(verdict.serial || '').toMatch(/HASH_HR7:7852B855/i);
      expect(verdict.serial || '').not.toContain('HASH_TIMEOUT');
      expect(verdict.serial || '').not.toContain('HASH_MISMATCH');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
