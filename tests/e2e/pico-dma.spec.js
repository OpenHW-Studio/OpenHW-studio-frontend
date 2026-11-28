import { test, expect } from '@playwright/test';

// Pico DMA cell (RP2040): pico-sdk hardware/dma mem-to-mem transfer of 64
// bytes with polling completion + byte-exact verify + checksum. Pure engine
// peripheral (no runner bridge): proves the DMA controller live.
const CODE = '#include <Arduino.h>\n#include "hardware/dma.h"\n#include <string.h>\nstatic uint8_t dma_src[64];\nstatic uint8_t dma_dst[64];\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("DMA_READY");\n  for (int i = 0; i < 64; i++) dma_src[i] = (uint8_t)(i * 3 + 1);\n  memset(dma_dst, 0, sizeof(dma_dst));\n  int ch = dma_claim_unused_channel(true);\n  dma_channel_config c = dma_channel_get_default_config(ch);\n  channel_config_set_transfer_data_size(&c, DMA_SIZE_8);\n  channel_config_set_read_increment(&c, true);\n  channel_config_set_write_increment(&c, true);\n  dma_channel_configure(ch, &c, dma_dst, dma_src, 64, true);\n  dma_channel_wait_for_finish_blocking(ch);\n  bool ok = true;\n  for (int i = 0; i < 64; i++) if (dma_dst[i] != dma_src[i]) { ok = false; break; }\n  uint8_t cks = 0;\n  for (int i = 0; i < 64; i++) cks ^= dma_dst[i];\n  Serial.print("DMA_CMP:");\n  Serial.print(ok ? "PASS" : "FAIL");\n  Serial.print(" CK:");\n  Serial.println(cks, HEX);\n  dma_channel_unclaim(ch);\n}\nvoid loop() { delay(2000); }\n';

test.describe('Pico DMA', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('DMA copies 64 bytes mem-to-mem byte-exact', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico1', type: 'openhw-pico', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'DMA_CMP:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('DMA verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('DMA serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const m = /DMA_CMP:(PASS|FAIL) CK:([0-9A-F]+)/.exec(verdict.serial || '');
    console.log('DMA result:', m ? m.slice(1) : 'NONE');
    expect(m && m[1]).toBe('PASS');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
