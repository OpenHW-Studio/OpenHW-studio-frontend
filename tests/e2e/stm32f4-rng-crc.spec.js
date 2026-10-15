import { test, expect } from '@playwright/test';

// F429 RNG + CRC self-tests (openhw-stm32f429) — narrow claims, guest-side
// proof only, zero runner changes. Both peripherals are raw guest MMIO; the
// stm32f4-emu package models them (chip table: rng:true, crc:true on
// stm32f429) and the runner only carries UART bytes.
//   RNG: RCC_AHB2ENR bit6 (0x40023834) clock, RNG_CR EN+IE (0xC), bounded
//     DRDY poll of RNG_SR bit0, up to 10 RNG_DR samples. The engine's RNG
//     falls back to a deterministic LCG when the host-entropy pool is empty
//     (the runner never seeds it) — consecutive LCG words are nonzero and
//     differ, which is exactly what the guest asserts. F4RNG_STUCK (with the
//     sample count) is the loud failure if DRDY never sets.
//   CRC: same 3 words as the F1 cell, same expected silicon value
//     0xFB5C7298 = 4217139864 (verified offline, two implementations).
//     Clock enable uses the F4-correct RCC_AHB1ENR bit12 (0x40023830),
//     not the F1 AHBENR address — the CRC word sequence and expectation
//     are otherwise identical to stm32f1-crc.
const RNG_CODE = '#define RCC_AHB2ENR (*(volatile uint32_t*)0x40023834UL)\n#define RNG_CR (*(volatile uint32_t*)0x50060800UL)\n#define RNG_SR (*(volatile uint32_t*)0x50060804UL)\n#define RNG_DR (*(volatile uint32_t*)0x50060808UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("F4RNG_READY");\n  RCC_AHB2ENR |= (1UL << 6);\n  RNG_CR |= 0xCUL;\n  uint32_t s[10]; int n = 0;\n  for (long i = 0; i < 2000000L && n < 10; i++) { if (RNG_SR & 1UL) { s[n++] = RNG_DR; } }\n  Serial.print("F4RNG_N:"); Serial.println(n);\n  uint32_t a = 0, b = 0; int ok = 0;\n  for (int i = 0; i < n && !ok; i++) {\n    if (s[i] == 0) continue;\n    for (int j = i + 1; j < n; j++) { if (s[j] != 0 && s[j] != s[i]) { a = s[i]; b = s[j]; ok = 1; break; } }\n  }\n  if (ok) {\n    Serial.print("F4RNG_A:"); Serial.println(a, HEX);\n    Serial.print("F4RNG_B:"); Serial.println(b, HEX);\n    Serial.println("F4RNG_OK");\n  } else {\n    Serial.println("F4RNG_STUCK");\n  }\n}\nvoid loop() {\n  Serial.println("F4RNG_TICK");\n  delay(1000);\n}\n';

const CRC_CODE = '#define RCC_AHB1ENR (*(volatile uint32_t*)0x40023830UL)\n#define CRC_DR (*(volatile uint32_t*)0x40023000UL)\n#define CRC_CR (*(volatile uint32_t*)0x40023008UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("F4CRC_READY");\n  RCC_AHB1ENR |= (1UL << 12);\n  CRC_CR = 1UL;\n  CRC_DR = 0xDEADBEEFUL;\n  CRC_DR = 0x12345678UL;\n  CRC_DR = 0x00FF00FFUL;\n  uint32_t r = CRC_DR;\n  Serial.print("F4CRC_HEX:");\n  Serial.println(r, HEX);\n  Serial.print("F4CRC_DEC:");\n  Serial.println(r);\n  if (r == 0xFB5C7298UL) Serial.println("F4CRC_OK");\n  else Serial.println("F4CRC_MISMATCH");\n}\nvoid loop() {\n  Serial.println("F4CRC_TICK");\n  delay(1000);\n}\n';

test.describe('F429 RNG + CRC self-tests', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('two RNG_DR reads are nonzero and differ', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f42', type: 'openhw-stm32f429', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), RNG_CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, serialNeedle: 'F4RNG_OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4RNG reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F4RNG serial:', (verdict.serial || '').slice(0, 400));
    expect(verdict.pass).toBe(true);
    const ma = /F4RNG_A:([0-9A-Fa-f]+)/.exec(verdict.serial || '');
    const mb = /F4RNG_B:([0-9A-Fa-f]+)/.exec(verdict.serial || '');
    console.log('F4RNG words:', ma ? ma[1] : 'NONE', mb ? mb[1] : 'NONE');
    expect(ma).toBeTruthy();
    expect(mb).toBeTruthy();
    expect(parseInt(ma[1], 16)).not.toBe(0);
    expect(parseInt(mb[1], 16)).not.toBe(0);
    expect(ma[1].toUpperCase()).not.toBe(mb[1].toUpperCase());
    expect(verdict.serial || '').not.toContain('F4RNG_STUCK');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('CRC_DR of 3 words equals the silicon value FB5C7298', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f42', type: 'openhw-stm32f429', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CRC_CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'F4CRC_OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4CRC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F4CRC serial:', (verdict.serial || '').slice(0, 400));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toMatch(/F4CRC_HEX:FB5C7298/i);
    expect(verdict.serial || '').toContain('F4CRC_DEC:4217139864');
    expect(verdict.serial || '').not.toContain('F4CRC_MISMATCH');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
