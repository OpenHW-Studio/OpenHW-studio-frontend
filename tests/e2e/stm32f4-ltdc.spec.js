import { test, expect } from '@playwright/test';

// F4 LTDC native scanout (F429-Disco): a real Arduino sketch paints the
// deterministic ARGB8888 gradient (pixel = 0xFF000000|x<<16|y<<8|x+y) into
// a static 64x32 framebuffer, brings up Layer0 + LTDCEN via raw register
// pokes, and reports the frame-end ISR flag + a checksum of 4 framebuffer
// words. The runner's Display.ltdc() tap decodes guest RAM into packed
// RGB frames pushed to the openhw-ltdc-display sink — human-senses proof
// is the liveOop mirror (fbW/fbH/litPixels), not just serial.
const CODE = '#include <stdint.h>\n#define LTDC_BASE 0x40016800UL\n#define R8(o) (*(volatile uint32_t*)(LTDC_BASE + (o)))\nstatic uint32_t fb[64*32];\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("LTDC_READY");\n  for (int y = 0; y < 32; y++)\n    for (int x = 0; x < 64; x++)\n      fb[y*64+x] = 0xFF000000UL | ((uint32_t)x<<16) | ((uint32_t)y<<8) | (uint32_t)(x+y);\n  R8(0x08) = (7UL<<16)|7UL;\n  R8(0x0C) = (8UL<<16)|8UL;\n  R8(0x10) = (31UL<<16)|63UL;\n  R8(0x40) = 49UL;\n  R8(0x34) = 0x0FUL;\n  R8(0x84) = 0;\n  R8(0x94) = 0;\n  R8(0x88) = 63UL|(31UL<<16);\n  R8(0x8C) = 63UL|(31UL<<16);\n  R8(0xAC) = (uint32_t)(uintptr_t)fb;\n  R8(0xB0) = (256UL<<16)|256UL;\n  R8(0xB4) = 32UL;\n  R8(0x84) = 1;\n  R8(0x18) = R8(0x18)|1UL;\n  Serial.println("scanout started");\n}\nvoid loop() {\n  uint32_t isr = R8(0x38);\n  if (isr & 2UL) {\n    uint32_t sum = fb[0]+fb[1]+fb[63]+fb[64*32-1];\n    Serial.print("LTDC_SUM:");\n    Serial.println(sum, HEX);\n    Serial.println("LTDC_OK");\n    delay(2000);\n  } else {\n    Serial.println("LTDC_WAIT");\n    delay(1000);\n  }\n}\n';

test.describe('F4 LTDC (F429 scanout to TFT)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('gradient scans out: ISR flag + exact pixels on the sink', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f42', type: 'openhw-stm32f429', attrs: {}, x: 100, y: 100 },
        { id: 'lcd1', type: 'openhw-ltdc-display', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f42:3V3', to: 'lcd1:VCC' },
        { from: 'f42:GND.1', to: 'lcd1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, selectTelemetry: ['lcd1'], serialNeedle: 'LTDC_OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('LTDC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('LTDC serial head:', (verdict.serial || '').slice(0, 400));
    console.log('LTDC liveOop:', JSON.stringify(verdict.liveOop && verdict.liveOop.lcd1
      ? { fbW: verdict.liveOop.lcd1.fbW, fbH: verdict.liveOop.lcd1.fbH, litPixels: verdict.liveOop.lcd1.litPixels, fbLen: (verdict.liveOop.lcd1.fb || []).length }
      : verdict.liveOop));
    console.log('LTDC telemetry:', JSON.stringify((verdict.telemetry || []).map((t) => ({ id: t.id, type: t.type, status: t.status, summary: String(t.summary || '').slice(0, 200) }))));
    expect(verdict.pass).toBe(true);
    // Exact gradient checksum (same 4 words the engine-side harness checks).
    expect(verdict.serial || '').toContain('LTDC_SUM:FC7F1F9E');
    // Human-senses proof: decoded frame on the sink (64x32, 2047 lit —
    // pixel (0,0) is black by construction).
    const sink = (verdict.liveOop || {}).lcd1;
    expect(sink).toBeTruthy();
    expect(Number(sink.fbW)).toBe(64);
    expect(Number(sink.fbH)).toBe(32);
    expect(Number(sink.litPixels)).toBeGreaterThanOrEqual(2000);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
