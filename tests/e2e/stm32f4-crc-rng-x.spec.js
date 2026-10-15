import { test, expect } from '@playwright/test';

// F4 CRC + RNG remainder (guest-side, zero runner changes): the F429 pair
// (stm32f4-rng-crc) is verbatim-ported to every other chip whose CHIPS
// flags claim the silicon — CRC on Disco F407 / 401 / 411 / 407VE
// (crc:true on all four), RNG on Disco F407 / 407VE (rng:true on both).
// F401/F411 have rng:false -> ABSENT, no cell (silicon lacks the block).
// Clock gates are F4-global (RCC_AHB1ENR bit 12 CRC, RCC_AHB2ENR bit 6
// RNG) and the CRC/RNG bases are identical across F4 dies, so the
// sketches are byte-identical; only the board type varies.
const CRC_TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'F401', type: 'openhw-stm32f401', id: 'f401' },
  { tag: 'F411', type: 'openhw-stm32f411', id: 'f411' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
];

const RNG_TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
];

const RNG_CODE = '#define RCC_AHB2ENR (*(volatile uint32_t*)0x40023834UL)\n#define RNG_CR (*(volatile uint32_t*)0x50060800UL)\n#define RNG_SR (*(volatile uint32_t*)0x50060804UL)\n#define RNG_DR (*(volatile uint32_t*)0x50060808UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("F4RNG_READY");\n  RCC_AHB2ENR |= (1UL << 6);\n  RNG_CR |= 0xCUL;\n  uint32_t s[10]; int n = 0;\n  for (long i = 0; i < 2000000L && n < 10; i++) { if (RNG_SR & 1UL) { s[n++] = RNG_DR; } }\n  Serial.print("F4RNG_N:"); Serial.println(n);\n  uint32_t a = 0, b = 0; int ok = 0;\n  for (int i = 0; i < n && !ok; i++) {\n    if (s[i] == 0) continue;\n    for (int j = i + 1; j < n; j++) { if (s[j] != 0 && s[j] != s[i]) { a = s[i]; b = s[j]; ok = 1; break; } }\n  }\n  if (ok) {\n    Serial.print("F4RNG_A:"); Serial.println(a, HEX);\n    Serial.print("F4RNG_B:"); Serial.println(b, HEX);\n    Serial.println("F4RNG_OK");\n  } else {\n    Serial.println("F4RNG_STUCK");\n  }\n}\nvoid loop() {\n  Serial.println("F4RNG_TICK");\n  delay(1000);\n}\n';

const CRC_CODE = '#define RCC_AHB1ENR (*(volatile uint32_t*)0x40023830UL)\n#define CRC_DR (*(volatile uint32_t*)0x40023000UL)\n#define CRC_CR (*(volatile uint32_t*)0x40023008UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("F4CRC_READY");\n  RCC_AHB1ENR |= (1UL << 12);\n  CRC_CR = 1UL;\n  CRC_DR = 0xDEADBEEFUL;\n  CRC_DR = 0x12345678UL;\n  CRC_DR = 0x00FF00FFUL;\n  uint32_t r = CRC_DR;\n  Serial.print("F4CRC_HEX:");\n  Serial.println(r, HEX);\n  Serial.print("F4CRC_DEC:");\n  Serial.println(r);\n  if (r == 0xFB5C7298UL) Serial.println("F4CRC_OK");\n  else Serial.println("F4CRC_MISMATCH");\n}\nvoid loop() {\n  Serial.println("F4CRC_TICK");\n  delay(1000);\n}\n';

test.describe('F4 CRC + RNG remainder (per-chip ports)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of CRC_TYPES) {
    test(`CRC_DR of 3 words equals FB5C7298 (${type})`, async ({ page }) => {
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
      }), { t: type, i: id, code: CRC_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 30000, serialNeedle: 'F4CRC_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}CRC reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toMatch(/F4CRC_HEX:FB5C7298/i);
      expect(verdict.serial || '').toContain('F4CRC_DEC:4217139864');
      expect(verdict.serial || '').not.toContain('F4CRC_MISMATCH');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }

  for (const { tag, type, id } of RNG_TYPES) {
    test(`two RNG_DR reads are nonzero and differ (${type})`, async ({ page }) => {
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
      }), { t: type, i: id, code: RNG_CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 60000, serialNeedle: 'F4RNG_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}RNG reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      expect(verdict.pass).toBe(true);
      const ma = /F4RNG_A:([0-9A-Fa-f]+)/.exec(verdict.serial || '');
      const mb = /F4RNG_B:([0-9A-Fa-f]+)/.exec(verdict.serial || '');
      expect(ma).toBeTruthy();
      expect(mb).toBeTruthy();
      expect(parseInt(ma[1], 16)).not.toBe(0);
      expect(parseInt(mb[1], 16)).not.toBe(0);
      expect(ma[1].toUpperCase()).not.toBe(mb[1].toUpperCase());
      expect(verdict.serial || '').not.toContain('F4RNG_STUCK');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
