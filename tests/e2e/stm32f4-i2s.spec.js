import { test, expect } from '@playwright/test';

// F4 I2S audio-bus TX (all five chips) — narrow claim by design, same
// as the SAI cell: the I2S/SAI model is a shared PCM capture FIFO (no
// frame/slot/clock logic), so this cell proves the DATA PATH only: guest
// SPI2-DR writes in I2S master-TX mode land in the model capture FIFO
// where the runner drains them (takeSpeakerSamples -> SAI_CAP marker,
// which drains the shared FIFO, not SAI alone). A real Arduino sketch
// writes a 1000..1015 ramp and prints its local sum; the runner
// independently reports the FIFO sum. Matching sums are the proof.
// I2S2 exists on every F4 chip (i2s:[2,3] in the CHIPS table) and the
// sketch touches no pins, so all five boards ride the same code.
// If SPI2-DR never reaches the FIFO live, re-triage to NO-GO (I2S mode
// unrouted) — the SAI DR path stays proven either way.
// NO-GO CONFIRMED (2026-10-12, lane/f4 — specs unchanged): I2S cells fail
// on all five chips (guest never reaches I2S_SUM; READY-repeat boot loop).
// The F429 SAI control cell is GREEN (SAI_CAP:16:16120 via the same shared
// FIFO + runner drain), so the FIFO path works — the SPI2 I2S register
// block (I2SCFGR/I2SPR/TXE in I2S mode) is unrouted in the model.
// Engine-owner territory; SAI proof stands.
const TYPES = [
  { tag: 'F407', type: 'openhw-stm32f4', id: 'f41' },
  { tag: 'F401', type: 'openhw-stm32f401', id: 'f401' },
  { tag: 'F411', type: 'openhw-stm32f411', id: 'f411' },
  { tag: 'V407', type: 'openhw-stm32f407ve', id: 'f47e' },
  { tag: 'F429', type: 'openhw-stm32f429', id: 'f429' },
];

const CODE = '#define SPI2_BASE 0x40003800UL\n#define SPI2_CR1 (*(volatile uint32_t*)(SPI2_BASE + 0x00))\n#define SPI2_SR (*(volatile uint32_t*)(SPI2_BASE + 0x08))\n#define SPI2_DR (*(volatile uint32_t*)(SPI2_BASE + 0x0C))\n#define SPI2_I2SCFGR (*(volatile uint32_t*)(SPI2_BASE + 0x1C))\n#define SPI2_I2SPR (*(volatile uint32_t*)(SPI2_BASE + 0x20))\n#define RCC_APB1ENR (*(volatile uint32_t*)0x40023840UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("I2S_READY");\n  RCC_APB1ENR |= (1UL<<14);\n  SPI2_I2SCFGR = (1UL<<11)|(2UL<<8);\n  SPI2_I2SPR = 2UL;\n  SPI2_I2SCFGR |= (1UL<<10);\n}\nvoid loop() {\n  unsigned long sum = 0;\n  for (int i = 0; i < 16; i++) {\n    unsigned long to = 200000UL;\n    while (!(SPI2_SR & 0x2UL) && to--) {}\n    SPI2_DR = (unsigned long)(1000 + i);\n    sum += 1000 + i;\n  }\n  Serial.print("I2S_SUM:"); Serial.println(sum);\n  if (sum == 16120UL) Serial.println("I2S_TX_OK");\n  delay(3000);\n}\n';

test.describe('F4 I2S (audio-bus TX to the shared FIFO)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const { tag, type, id } of TYPES) {
    test(`guest ramp lands in the capture FIFO (${type})`, async ({ page }) => {
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(({ t, i, code }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: i, type: t, attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), { t: type, i: id, code: CODE });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 120000, serialNeedle: 'I2S_TX_OK', telemetryMode: 'detail',
      }));
      expect(verdict.ok).toBe(true);
      console.log(`${tag}I2S reasons:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
      console.log(`${tag}I2S serial:`, (verdict.serial || '').slice(0, 400));
      expect(verdict.pass).toBe(true);
      expect(verdict.serial || '').toContain('I2S_SUM:16120');
      // Runner-side FIFO proof: exact same 16 samples, host-observed
      // through the shared I2S/SAI capture drain.
      expect(verdict.serial || '').toContain('SAI_CAP:16:16120');
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
