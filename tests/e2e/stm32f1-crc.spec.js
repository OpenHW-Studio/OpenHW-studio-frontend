import { test, expect } from '@playwright/test';

// F1 CRC unit self-test (bluepill) — narrow claim by design: the guest does
// raw MMIO (no Arduino CRC API exists), the ENGINE computes, the runner only
// carries UART bytes. Zero runner changes needed: stm32f1-emu documents
// "CRC_DR read -> computed 32-bit result" (onCrcResult), and the guest reads
// the register directly through the emulated CPU.
//
// Expected silicon value (computed offline BEFORE writing this spec, two
// independent python3 implementations — bitwise and table-driven — agree):
//   STM32 hardware CRC (poly 0x04C11DB7, init 0xFFFFFFFF, no refin/refout,
//   no xorout) over words [0xDEADBEEF, 0x12345678, 0x00FF00FF]
//   = 0xFB5C7298 = 4217139864
// The guest prints HEX + DEC and only emits F1CRC_OK on an exact match, so
// the serial needle itself is the proof; the spec additionally asserts both
// printed forms. F1CRC_MISMATCH (with the wrong value) is the loud failure.
const CODE = '#define RCC_AHBENR (*(volatile uint32_t*)0x40021014UL)\n#define CRC_DR (*(volatile uint32_t*)0x40023000UL)\n#define CRC_CR (*(volatile uint32_t*)0x40023008UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("F1CRC_READY");\n  RCC_AHBENR |= (1UL << 6);\n  CRC_CR = 1UL;\n  CRC_DR = 0xDEADBEEFUL;\n  CRC_DR = 0x12345678UL;\n  CRC_DR = 0x00FF00FFUL;\n  uint32_t r = CRC_DR;\n  Serial.print("F1CRC_HEX:");\n  Serial.println(r, HEX);\n  Serial.print("F1CRC_DEC:");\n  Serial.println(r);\n  if (r == 0xFB5C7298UL) Serial.println("F1CRC_OK");\n  else Serial.println("F1CRC_MISMATCH");\n}\nvoid loop() {\n  Serial.println("F1CRC_TICK");\n  delay(1000);\n}\n';

test.describe('F1 CRC unit self-test (bluepill)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('CRC_DR of 3 words equals the silicon value FB5C7298', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'F1CRC_OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F1CRC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F1CRC serial:', (verdict.serial || '').slice(0, 400));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toMatch(/F1CRC_HEX:FB5C7298/i);
    expect(verdict.serial || '').toContain('F1CRC_DEC:4217139864');
    expect(verdict.serial || '').not.toContain('F1CRC_MISMATCH');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
