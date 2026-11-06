import { test, expect } from '@playwright/test';

// ESP32 ILI9341 (DevKit VSPI, raw SPI.h — no TFT lib needed): reset pulse,
// init sequence, CASET/PASET window, RAMWR red fill. DC/CS are plain
// GPIO so the model tracks command-vs-data via pin volts (same mechanism
// as the MAX7219 CS path). Proof is model-side: writeCount + vramFill.
// No runner change (shared SPI bridge).
const CODE = '#include <SPI.h>\n#define CS 5\n#define DC 21\n#define RST 22\nvoid cmd(uint8_t c){digitalWrite(DC,LOW);digitalWrite(CS,LOW);SPI.transfer(c);digitalWrite(CS,HIGH);}\nvoid dat(uint8_t d){digitalWrite(DC,HIGH);digitalWrite(CS,LOW);SPI.transfer(d);digitalWrite(CS,HIGH);}\nvoid setup(){Serial.begin(115200);Serial.println("TFT_READY");pinMode(CS,OUTPUT);pinMode(DC,OUTPUT);pinMode(RST,OUTPUT);digitalWrite(CS,HIGH);digitalWrite(RST,HIGH);delay(20);digitalWrite(RST,LOW);delay(20);digitalWrite(RST,HIGH);delay(150);SPI.begin();SPI.beginTransaction(SPISettings(8000000,MSBFIRST,SPI_MODE0));cmd(0x01);delay(130);cmd(0x11);delay(130);cmd(0x3A);dat(0x55);cmd(0x36);dat(0x48);cmd(0x2A);dat(0);dat(0);dat(0);dat(239);cmd(0x2B);dat(0);dat(0);dat(1);dat(63);cmd(0x29);delay(20);cmd(0x2C);digitalWrite(DC,HIGH);digitalWrite(CS,LOW);for(int i=0;i<240*10;i++){SPI.transfer(0xF8);SPI.transfer(0x00);}digitalWrite(CS,HIGH);Serial.println("TFT_DRAWN");}\nvoid loop(){Serial.println("TFT_TICK");delay(2000);}\n';

test.describe('ESP32 ILI9341 (devkit VSPI)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('TFT shows the firmware fill', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'tft1', type: 'openhw-ili9341', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:5', to: 'tft1:CS' },
        { from: 'esp1:22', to: 'tft1:RESET' },
        { from: 'esp1:21', to: 'tft1:DC' },
        { from: 'esp1:23', to: 'tft1:MOSI' },
        { from: 'esp1:18', to: 'tft1:SCK' },
        { from: 'esp1:19', to: 'tft1:MISO' },
        { from: 'esp1:3V3', to: 'tft1:LED' },
        { from: 'esp1:3V3', to: 'tft1:VCC' },
        { from: 'esp1:GND.1', to: 'tft1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 45000, selectTelemetry: ['tft1'], serialNeedle: 'TFT_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPTFT reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const tft = (verdict.telemetry || []).find((t) => t.id === 'tft1');
    expect(tft).toBeTruthy();
    const custom = tft.details?.custom || tft.details?.metrics?.custom || {};
    console.log('ESPTFT custom:', JSON.stringify(custom).slice(0, 300));
    expect(Number(custom.writeCount ?? 0)).toBeGreaterThan(1000);
    expect(Number(custom.vramFillPercentage ?? 0)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
