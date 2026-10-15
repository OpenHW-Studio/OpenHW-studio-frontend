import { test, expect } from '@playwright/test';

// F4 DCMI capture (F429): a real Arduino sketch arms the capture engine
// via raw register pokes (AHB2 clock, IER, ICR+CR rising edge) and drains
// 16 DR bytes; the runner feeds a deterministic 4x4 sensor pattern
// (0x10..0x1F) through the model's VSYNC/LINE/FRAME path and shows it on
// the openhw-ltdc-display sink. Proof triangle: guest DR sum (silicon
// sensor->FIFO->DR path) + runner DCMI_SRC marker + sink frame bytes.
const CODE = '#define DCMI_BASE 0x50050000UL\n#define DCR(o) (*(volatile uint32_t*)(DCMI_BASE + (o)))\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("DCMI_READY");\n  (*(volatile uint32_t*)0x40023834UL) |= 1UL;\n  DCR(0x0C) = 0x1FUL;\n}\nvoid loop() {\n  DCR(0x10) = 0x1FUL;\n  DCR(0x00) = 0; DCR(0x00) = 1;\n  unsigned long to = 3000000UL, v = 0;\n  while (to--) { v = DCR(0x28); if (v & 0xFFUL) break; }\n  unsigned long sum = 0;\n  if (v & 0xFFUL) { sum = v & 0xFFUL; for (int i = 1; i < 16; i++) sum += DCR(0x28) & 0xFFUL; }\n  Serial.print("DCMI_SUM:"); Serial.println(sum, HEX);\n  if (sum == 0x178UL) Serial.println("DCMI_OK");\n  delay(2000);\n}\n';

test.describe('F4 DCMI (sensor capture to sink)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('capture drains the exact fed pattern', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f42', type: 'openhw-stm32f429', attrs: {}, x: 100, y: 100 },
        { id: 'lcd1', type: 'openhw-ltdc-display', attrs: { cell: 'dcmi' }, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f42:3V3', to: 'lcd1:VCC' },
        { from: 'f42:GND.1', to: 'lcd1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 120000, selectTelemetry: ['lcd1'], serialNeedle: 'DCMI_OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('DCMI reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('DCMI serial head:', (verdict.serial || '').slice(0, 300));
    console.log('DCMI liveOop:', JSON.stringify(verdict.liveOop && verdict.liveOop.lcd1
      ? { fbW: verdict.liveOop.lcd1.fbW, fbH: verdict.liveOop.lcd1.fbH, litPixels: verdict.liveOop.lcd1.litPixels }
      : verdict.liveOop));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('DCMI_SUM:178');
    expect(verdict.serial || '').toContain('DCMI_SRC:PASS');
    const sink = (verdict.liveOop || {}).lcd1;
    expect(sink).toBeTruthy();
    expect(Number(sink.fbW)).toBe(4);
    expect(Number(sink.fbH)).toBe(4);
    expect(Number(sink.litPixels)).toBe(16);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
