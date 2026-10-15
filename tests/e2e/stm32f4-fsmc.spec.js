import { test, expect } from '@playwright/test';

// F4 FSMC 8080 display (F429 BANK1): a real Arduino sketch drives the bank
// window like display firmware (CASET + 64-pixel RAMWR burst + RDDID, then
// the untapped-BANK4 inertness check); the runner's create-time bank tap
// decodes RS from offset bit 17, streams post-RAMWR pixels to the
// openhw-ltdc-display sink, and answers the RDDID read with 0x9341.
const CODE = '#define RCC_AHB3ENR (*(volatile uint32_t*)0x40023838UL)\n#define FSMC_BCR1 (*(volatile uint32_t*)0xA0000000UL)\n#define FSMC_BTR1 (*(volatile uint32_t*)0xA0000004UL)\n#define LCD_CMD (*(volatile unsigned short*)0x60000000UL)\n#define LCD_DATA (*(volatile unsigned short*)(0x60000000UL + (1UL<<17)))\n#define BANK4_CELL (*(volatile unsigned short*)0x90000000UL)\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("FSMC_READY");\n  RCC_AHB3ENR |= 1UL;\n  FSMC_BCR1 = (1UL<<0)|(1UL<<4)|(1UL<<12);\n  FSMC_BTR1 = 0x1053UL;\n}\nvoid loop() {\n  LCD_CMD = 0x2A; LCD_DATA = 0x0000; LCD_DATA = 0x00EF;\n  LCD_CMD = 0x2C;\n  for (int i = 0; i < 64; i++) LCD_DATA = (unsigned short)(0xF800 + i);\n  LCD_CMD = 0x04;\n  delay(50);\n  unsigned short id = LCD_DATA;\n  Serial.print("FSMC_ID:"); Serial.println(id, HEX);\n  if (id == 0x9341) Serial.println("FSMC read OK");\n  BANK4_CELL = 0xDEAD;\n  if (BANK4_CELL == 0) Serial.println("FSMC_BANK4_OK");\n  delay(2000);\n}\n';

test.describe('F4 FSMC (8080 burst to sink)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('pixel burst lands on the sink, RDDID answers, bank4 inert', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f42', type: 'openhw-stm32f429', attrs: {}, x: 100, y: 100 },
        { id: 'lcd1', type: 'openhw-ltdc-display', attrs: { cell: 'fsmc' }, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f42:3V3', to: 'lcd1:VCC' },
        { from: 'f42:GND.1', to: 'lcd1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 120000, selectTelemetry: ['lcd1'], serialNeedle: 'FSMC read OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('FSMC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('FSMC serial head:', (verdict.serial || '').slice(0, 300));
    console.log('FSMC liveOop:', JSON.stringify(verdict.liveOop && verdict.liveOop.lcd1
      ? { fbW: verdict.liveOop.lcd1.fbW, fbH: verdict.liveOop.lcd1.fbH, litPixels: verdict.liveOop.lcd1.litPixels }
      : verdict.liveOop));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('FSMC_ID:9341');
    expect(verdict.serial || '').toContain('FSMC_BANK4_OK');
    expect(verdict.serial || '').toContain('FSMC_PX:64');
    const sink = (verdict.liveOop || {}).lcd1;
    expect(sink).toBeTruthy();
    expect(Number(sink.fbW)).toBe(8);
    expect(Number(sink.fbH)).toBe(8);
    expect(Number(sink.litPixels)).toBe(64);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
