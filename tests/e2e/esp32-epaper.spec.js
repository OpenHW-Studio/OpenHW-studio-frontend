import { test, expect } from '@playwright/test';

// ESP32 ePaper 2.9" (DevKit VSPI, raw SPI.h): reset pulse, command 0x24
// (RAM write), full 296x128 mono frame of black. DC/CS tracked via pin
// volts (same mechanism as ILI9341 DC). Proof is model-side:
// ramPointer must equal the full 4736-byte frame. No runner change.
const CODE = '#include <SPI.h>\n#define CS 5\n#define DC 21\n#define RST 22\nvoid cmd(uint8_t c){digitalWrite(DC,LOW);digitalWrite(CS,LOW);SPI.transfer(c);digitalWrite(CS,HIGH);}\nvoid setup(){Serial.begin(115200);Serial.println("EPD_READY");pinMode(CS,OUTPUT);pinMode(DC,OUTPUT);pinMode(RST,OUTPUT);digitalWrite(CS,HIGH);digitalWrite(RST,HIGH);delay(20);digitalWrite(RST,LOW);delay(20);digitalWrite(RST,HIGH);delay(150);SPI.begin();SPI.beginTransaction(SPISettings(4000000,MSBFIRST,SPI_MODE0));cmd(0x24);digitalWrite(DC,HIGH);digitalWrite(CS,LOW);for(int i=0;i<4736;i++)SPI.transfer(0x00);digitalWrite(CS,HIGH);Serial.println("EPD_DRAWN");}\nvoid loop(){Serial.println("EPD_TICK");delay(2000);}\n';

test.describe('ESP32 ePaper (devkit VSPI)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('ePaper ingests the full mono frame', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'epd1', type: 'openhw-ePaperDisplay', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:5', to: 'epd1:CS' },
        { from: 'esp1:22', to: 'epd1:RST' },
        { from: 'esp1:21', to: 'epd1:DC' },
        { from: 'esp1:23', to: 'epd1:DIN' },
        { from: 'esp1:18', to: 'epd1:CLK' },
        { from: 'esp1:3V3', to: 'epd1:VCC' },
        { from: 'esp1:GND.1', to: 'epd1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['epd1'], serialNeedle: 'EPD_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPEDP reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const epd = (verdict.telemetry || []).find((t) => t.id === 'epd1');
    expect(epd).toBeTruthy();
    const custom = epd.details?.custom || epd.details?.metrics?.custom || {};
    console.log('ESPEDP custom:', JSON.stringify(custom).slice(0, 300));
    expect(custom.powerStatus).toBe('On');
    expect(Number(custom.ramPointer ?? -1)).toBe(4736);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
