import { test, expect } from '@playwright/test';

// F1 system blocks (bluepill / maple-mini / f103cb) — guest-side proof,
// zero runner changes. Three narrow cells, one board loop:
//   IWDG: firmware enables the independent watchdog, pets it while printing
//     ticks (liveness), then stops petting and prints ARMED. A modeled IWDG
//     then fires: the engine stops the core (is_watchdog_reset_requested),
//     so no tick follows ARMED — or the runner reboots into a second READY.
//     An unmodeled IWDG keeps ticking: post-ARMED ticks fail the cell loudly.
//     NOTE (silicon truth, RM0008 §11): IWDG_RLR is 12 bits — RLR=20000
//     truncates to 3616 (fires ~1.86M instr, before any 300ms-delayed pet).
//     The cell uses RLR=0xFFF + delay(3) so 3 pets fit inside the ~2.1M
//     window, and the runner reboots the core on the reset (NRST semantics).
//   EXTI: attachInterrupt(PB0, RISING) + a software trigger via EXTI_SWIER.
//     The ISR prints FIRED. Proves the EXTI pending/NVIC path with no wire.
//   BKP: PWR DBP unlock + backup-domain write/readback of BKP_DR1. An exact
//     magic readback proves the register exists; 0x0 fails loudly. Magic is
//     16-bit: BKP_DRx are 16-bit registers (RM0008, SVD D[15:0]) — a 32-bit
//     magic is unrepresentable on silicon, so the cell uses 0xCAFE.
const TYPES = [
  { tag: 'BP', type: 'openhw-stm32-bluepill' },
  { tag: 'MAPLE', type: 'openhw-stm32-maple-mini' },
  { tag: 'CB', type: 'openhw-stm32f103cb' },
];

const WDG_CODE = (tag) =>
  '#define IWDG_KR (*(volatile uint32_t*)0x40003000UL)\n#define IWDG_PR (*(volatile uint32_t*)0x40003004UL)\n#define IWDG_RLR (*(volatile uint32_t*)0x40003008UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("' + tag + 'WDG_READY");\n  IWDG_KR = 0xCCCCUL;\n  IWDG_KR = 0x5555UL;\n  IWDG_PR = 0UL;\n  IWDG_RLR = 0xFFFUL;\n  IWDG_KR = 0xAAAAUL;\n}\nvoid loop() {\n  static int phase = 0;\n  static int n = 0;\n  if (phase == 0) {\n    IWDG_KR = 0xAAAAUL;\n    Serial.print("' + tag + 'WDG_TICK:"); Serial.println(n);\n    if (++n >= 3) { phase = 1; Serial.println("' + tag + 'WDG_ARMED"); }\n    delay(3);\n  } else {\n    Serial.println("' + tag + 'WDG_SPIN");\n    delay(3);\n  }\n}\n';

const EXTI_CODE = '#include <Arduino.h>\n#define EXTI_IMR (*(volatile uint32_t*)0x40010400UL)\n#define EXTI_SWIER (*(volatile uint32_t*)0x40010410UL)\nvolatile bool fired = false;\nvoid isr() { fired = true; }\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("EXTI_READY");\n  attachInterrupt(PB0, isr, RISING);\n  EXTI_IMR |= 1UL;\n  EXTI_SWIER |= 1UL;\n  Serial.println("EXTI_TRIG");\n}\nvoid loop() {\n  if (fired) { Serial.println("EXTI_FIRED"); fired = false; }\n  delay(500);\n}\n';

const BKP_CODE = '#define RCC_APB1ENR (*(volatile uint32_t*)0x4002101CUL)\n#define PWR_CR (*(volatile uint32_t*)0x40007000UL)\n#define BKP_DR1 (*(volatile uint32_t*)0x40006C04UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("BKP_READY");\n  RCC_APB1ENR |= (1UL<<27)|(1UL<<28);\n  PWR_CR |= (1UL<<8);\n  BKP_DR1 = 0xCAFEUL;\n  uint32_t r = BKP_DR1;\n  Serial.print("BKP_HEX:"); Serial.println(r, HEX);\n  if (r == 0xCAFEUL) Serial.println("BKP_OK");\n  else Serial.println("BKP_MISMATCH");\n}\nvoid loop() { delay(2000); }\n';

test.describe('F1 system blocks (IWDG / EXTI-SWIER / BKP)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type } of TYPES) {
    test(`IWDG fires after petting stops (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'bp1', type: t, attrs: {}, x: 100, y: 100 },
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
      // Liveness before the arm: 3 pet ticks prove the counter runs.
      const preTicks = (serial.match(new RegExp(`${tag}WDG_TICK:`, 'g')) || []).length;
      console.log(`${tag}WDG preTicks:`, preTicks);
      expect(preTicks).toBeGreaterThanOrEqual(3);
      // After the arm the core must stop (silence) or reboot (2nd READY):
      // continued SPIN lines with no reset prove an unmodeled IWDG.
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
          { id: 'bp1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: EXTI_CODE });
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

    test(`BKP_DR1 keeps its magic (${type})`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'bp1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: BKP_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000, serialNeedle: 'BKP_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}BKP reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toMatch(/BKP_HEX:CAFE\r?\n/i);
      expect(verdict.serial || '').not.toContain('BKP_MISMATCH');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
