import { test, expect } from '@playwright/test';

// F4 QSPI flash (F429): the runner pre-binds a deterministic 32x16 RGB565
// gradient image; a real Arduino sketch reads it back through BOTH paths —
// indirect reads (AR/DLR/CCR/DR + TC poll) and the 0x90000000 memory-mapped
// window after the FMODE=11 switch — and compares them. The runner then
// verifies all 256 words through the mmap window independently of guest
// serial and shows the image on the openhw-ltdc-display sink.
const CODE = '#define QSPI_BASE 0xA0001000UL\n#define QR(o) (*(volatile uint32_t*)(QSPI_BASE + (o)))\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("QSPI_READY");\n  QR(0x00) = 1;\n}\nvoid loop() {\n  unsigned long ind[4], mm[4];\n  for (int i = 0; i < 4; i++) {\n    QR(0x04) = 0;\n    QR(0x18) = (unsigned long)(i * 4);\n    QR(0x10) = 3;\n    QR(0x14) = (1UL<<28)|(3UL<<24);\n    ind[i] = QR(0x20);\n    unsigned long to = 1000000UL;\n    while ((QR(0x08) & 2UL) == 0 && to--) {}\n    QR(0x0C) = 2UL;\n  }\n  QR(0x14) = (3UL<<28)|(3UL<<24);\n  volatile unsigned short *mp = (volatile unsigned short *)0x90000000UL;\n  for (int i = 0; i < 4; i++) mm[i] = ((unsigned long)mp[i*2+1] << 16) | mp[i*2];\n  int ok = 1; for (int i = 0; i < 4; i++) if (ind[i] != mm[i]) ok = 0;\n  Serial.print("QSPI_W0:"); Serial.println(ind[0], HEX);\n  Serial.print("QSPI_IND:");\n  for (int i = 0; i < 4; i++) { Serial.print(ind[i], HEX); Serial.print(i < 3 ? "," : ""); }\n  Serial.println();\n  Serial.print("QSPI_MM:");\n  for (int i = 0; i < 4; i++) { Serial.print(mm[i], HEX); Serial.print(i < 3 ? "," : ""); }\n  Serial.println();\n  if (ok) Serial.println("QSPI_OK");\n  delay(2000);\n}\n';

test.describe('F4 QSPI (flash readback to sink)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('indirect + mmap reads agree on the bound image', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f42', type: 'openhw-stm32f429', attrs: {}, x: 100, y: 100 },
        { id: 'lcd1', type: 'openhw-ltdc-display', attrs: { cell: 'qspi' }, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f42:3V3', to: 'lcd1:VCC' },
        { from: 'f42:GND.1', to: 'lcd1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 120000, selectTelemetry: ['lcd1'], serialNeedle: 'QSPI_OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('QSPI reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('QSPI serial head:', (verdict.serial || '').slice(0, 300));
    console.log('QSPI words:', /QSPI_IND:[0-9A-F,]+/.exec(verdict.serial || ''), /QSPI_MM:[0-9A-F,]+/.exec(verdict.serial || ''));
    console.log('QSPI liveOop:', JSON.stringify(verdict.liveOop && verdict.liveOop.lcd1
      ? { fbW: verdict.liveOop.lcd1.fbW, fbH: verdict.liveOop.lcd1.fbH, litPixels: verdict.liveOop.lcd1.litPixels }
      : verdict.liveOop));
    expect(verdict.pass).toBe(true);
    // Word0 of the gradient: v(0,0)=0, v(1,0)=(1<<11)|1 -> LE 08010000.
    expect(verdict.serial || '').toContain('QSPI_W0:8010000');
    expect(verdict.serial || '').toContain('QSPI_MMAP:PASS');
    const sink = (verdict.liveOop || {}).lcd1;
    expect(sink).toBeTruthy();
    expect(Number(sink.fbW)).toBe(32);
    expect(Number(sink.fbH)).toBe(16);
    expect(Number(sink.litPixels)).toBeGreaterThanOrEqual(500);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
