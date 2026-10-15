import { test, expect } from '@playwright/test';

// F4 DMA memory-to-memory (all five chips): a real Arduino sketch programs
// DMA2 stream 0 for a 16-word M2M copy through silicon registers
// (RCC_AHB1ENR DMA2EN bit 22, S0PAR/S0M0AR/S0NDTR/S0CR with DIR=M2M,
// MINC+PINC, 32-bit sizes) and polls the TCIF0 flag in DMA2_LISR. Proof
// is guest-side: copy + checksum verified by the firmware (the engine
// raises per-stream TCIF, which its own polling dispatcher watches for
// onDmaTc — zero runner involvement). Exact checksum (src[i] = 0x1000+i,
// sum = 65656) cannot be faked: TCIF0 only sets when the model executes
// the transfer. Loud failures: DMA_TIMEOUT / DMA_MISMATCH.
// DMA2 + stream 0 exist on every F4 chip in the package CHIPS table.
const TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'F401', type: 'openhw-stm32f401', id: 'f401' },
  { tag: 'F411', type: 'openhw-stm32f411', id: 'f411' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

const CODE = (tag) =>
  '#define RCC_AHB1ENR (*(volatile uint32_t*)0x40023830UL)\n#define DMA2_LISR (*(volatile uint32_t*)0x40026400UL)\n#define DMA2_LIFCR (*(volatile uint32_t*)0x40026408UL)\n#define DMA2_S0CR (*(volatile uint32_t*)0x40026410UL)\n#define DMA2_S0NDTR (*(volatile uint32_t*)0x40026414UL)\n#define DMA2_S0PAR (*(volatile uint32_t*)0x40026418UL)\n#define DMA2_S0M0AR (*(volatile uint32_t*)0x4002641CUL)\nstatic uint32_t src[16];\nstatic uint32_t dst[16];\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("' + tag + 'DMA_READY");\n  for (int i = 0; i < 16; i++) { src[i] = 0x1000UL + (uint32_t)i; dst[i] = 0; }\n  RCC_AHB1ENR |= (1UL<<22);\n  DMA2_LIFCR = 0x3DUL;\n  DMA2_S0PAR = (uint32_t)src;\n  DMA2_S0M0AR = (uint32_t)dst;\n  DMA2_S0NDTR = 16UL;\n  DMA2_S0CR = (2UL<<6)|(1UL<<9)|(1UL<<10)|(2UL<<11)|(2UL<<13)|(1UL<<0);\n}\nvoid loop() {\n  unsigned long to = 0;\n  while (!(DMA2_LISR & 0x20UL) && ++to < 4000000UL) {}\n  if (!(DMA2_LISR & 0x20UL)) { Serial.println("' + tag + 'DMA_TIMEOUT"); delay(2000); return; }\n  unsigned long sum = 0; int bad = 0;\n  for (int i = 0; i < 16; i++) { if (dst[i] != 0x1000UL + (uint32_t)i) bad++; sum += dst[i]; }\n  Serial.print("' + tag + 'DMA_SUM:"); Serial.println(sum);\n  Serial.print("' + tag + 'DMA_BAD:"); Serial.println(bad);\n  if (bad == 0 && sum == 65656UL) Serial.println("' + tag + 'DMA_OK");\n  else Serial.println("' + tag + 'DMA_MISMATCH");\n  delay(2000);\n}\n';

test.describe('F4 DMA2 M2M copy (guest register driver)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of TYPES) {
    test(`DMA2 stream 0 moves 16 words and raises TCIF0 (${type})`, async ({ page }) => {
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
      }), { t: type, i: id, code: CODE(tag) });
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
  }
});
