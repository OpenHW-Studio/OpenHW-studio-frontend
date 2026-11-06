import { test, expect } from '@playwright/test';

// F1 DMA1 memory-to-memory (bluepill / maple-mini / f103cb): a real
// Arduino sketch programs DMA1 channel 1 for a 16-word M2M copy entirely
// through silicon registers (RCC_AHBENR DMA1EN, CPAR/CMAR/CNDTR/CCR with
// MEM2MEM+MINC+PINC, 32-bit widths) and polls the TCIF1 flag in DMA_ISR.
// Proof is guest-side: the copy + checksum are verified by the firmware
// itself (the engine's pumpDma runs per batch and sets the ISR flags —
// zero runner involvement; the F1 runner has no DMA code path). The exact
// checksum (src[i] = 0x1000+i, sum = 65656 = 0x10078) cannot be faked by
// serial alone: TCIF1 only sets when the model executes the transfer.
// Loud failure is DMA_TIMEOUT (model never completes) or DMA_MISMATCH.
const TYPES = [
  { tag: 'BP', type: 'openhw-stm32-bluepill' },
  { tag: 'MAPLE', type: 'openhw-stm32-maple-mini' },
  { tag: 'CB', type: 'openhw-stm32f103cb' },
];

const CODE = (tag) =>
  '#define RCC_AHBENR (*(volatile uint32_t*)0x40021014UL)\n#define DMA1_ISR (*(volatile uint32_t*)0x40020000UL)\n#define DMA1_IFCR (*(volatile uint32_t*)0x40020004UL)\n#define DMA1_CCR1 (*(volatile uint32_t*)0x40020008UL)\n#define DMA1_CNDTR1 (*(volatile uint32_t*)0x4002000CUL)\n#define DMA1_CPAR1 (*(volatile uint32_t*)0x40020010UL)\n#define DMA1_CMAR1 (*(volatile uint32_t*)0x40020014UL)\nstatic uint32_t src[16];\nstatic uint32_t dst[16];\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("' + tag + 'DMA_READY");\n  for (int i = 0; i < 16; i++) { src[i] = 0x1000UL + (uint32_t)i; dst[i] = 0; }\n  RCC_AHBENR |= 1UL;\n  DMA1_IFCR = 0xFUL;\n  DMA1_CPAR1 = (uint32_t)src;\n  DMA1_CMAR1 = (uint32_t)dst;\n  DMA1_CNDTR1 = 16UL;\n  DMA1_CCR1 = (1UL<<14)|(1UL<<7)|(1UL<<6)|(2UL<<8)|(2UL<<10)|(1UL<<0);\n}\nvoid loop() {\n  unsigned long to = 0;\n  while (!(DMA1_ISR & 0x2UL) && ++to < 4000000UL) {}\n  if (!(DMA1_ISR & 0x2UL)) { Serial.println("' + tag + 'DMA_TIMEOUT"); delay(2000); return; }\n  unsigned long sum = 0; int bad = 0;\n  for (int i = 0; i < 16; i++) { if (dst[i] != 0x1000UL + (uint32_t)i) bad++; sum += dst[i]; }\n  Serial.print("' + tag + 'DMA_SUM:"); Serial.println(sum);\n  Serial.print("' + tag + 'DMA_BAD:"); Serial.println(bad);\n  if (bad == 0 && sum == 65656UL) Serial.println("' + tag + 'DMA_OK");\n  else Serial.println("' + tag + 'DMA_MISMATCH");\n  delay(2000);\n}\n';

test.describe('F1 DMA1 M2M copy (guest register driver)', () => {
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
          { id: 'bp1', type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, code: CODE(tag) });
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
