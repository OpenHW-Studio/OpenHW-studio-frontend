import { test, expect } from '@playwright/test';

// ESP32 Nokia 5110 (DevKit VSPI, raw SPI.h): PCD8544 init (extended
// function set, contrast, bias, back to basic, display control) then a
// full-frame fill. Proof is model-side fillPercent. No runner change.
const CODE = '#include <SPI.h>\n#define SCE 5\n#define RST 21\n#define DC 22\nvoid cmd(uint8_t c){digitalWrite(DC,LOW);digitalWrite(SCE,LOW);SPI.transfer(c);digitalWrite(SCE,HIGH);}\nvoid dat(uint8_t d){digitalWrite(DC,HIGH);digitalWrite(SCE,LOW);SPI.transfer(d);digitalWrite(SCE,HIGH);}\nvoid setup(){Serial.begin(115200);Serial.println("N5110_READY");pinMode(SCE,OUTPUT);pinMode(DC,OUTPUT);pinMode(RST,OUTPUT);digitalWrite(SCE,HIGH);digitalWrite(RST,HIGH);delay(20);digitalWrite(RST,LOW);delay(20);digitalWrite(RST,HIGH);delay(20);SPI.begin();SPI.beginTransaction(SPISettings(4000000,MSBFIRST,SPI_MODE0));cmd(0x21);cmd(0xC0);cmd(0x06);cmd(0x13);cmd(0x20);cmd(0x0C);for(int i=0;i<504;i++)dat(0xFF);Serial.println("N5110_DRAWN");}\nvoid loop(){Serial.println("N5110_TICK");delay(2000);}\n';

test.describe('ESP32 Nokia 5110 (devkit VSPI)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('PCD8544 shows the firmware fill', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'lcd1', type: 'openhw-nokia-5110', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:5', to: 'lcd1:SCE' },
        { from: 'esp1:21', to: 'lcd1:RST' },
        { from: 'esp1:22', to: 'lcd1:DC' },
        { from: 'esp1:23', to: 'lcd1:DN' },
        { from: 'esp1:18', to: 'lcd1:SCLK' },
        { from: 'esp1:3V3', to: 'lcd1:LED' },
        { from: 'esp1:3V3', to: 'lcd1:VCC' },
        { from: 'esp1:GND.1', to: 'lcd1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 45000, selectTelemetry: ['lcd1'], serialNeedle: 'N5110_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPN5110 reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const lcd = (verdict.telemetry || []).find((t) => t.id === 'lcd1');
    expect(lcd).toBeTruthy();
    const custom = lcd.details?.custom || lcd.details?.metrics?.custom || {};
    console.log('ESPN5110 custom:', JSON.stringify(custom).slice(0, 300));
    expect(Number(custom.fillPercent ?? 0)).toBeGreaterThan(50);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
