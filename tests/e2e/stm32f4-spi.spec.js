import { test, expect } from '@playwright/test';

// STM32F4 SPI (MAX7219 over SPI1: SCK PA5 / MOSI PA7 / manual CS PA4).
// Same assert shape as the F1 SPI row (real Arduino SPI transfer).
test.describe('STM32F4 SPI (disco MAX7219)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('MAX7219 shows digits over F4 SPI1', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: {}, x: 100, y: 100 },
        { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f41:PA7', to: 'mx1:DIN' },
        { from: 'f41:PA5', to: 'mx1:CLK' },
        { from: 'f41:PA4', to: 'mx1:CS' },
        { from: 'f41:3V3', to: 'mx1:VCC' },
        { from: 'f41:GND.1', to: 'mx1:GND' },
      ],
      code: '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(PA4,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(PA4,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("F4SPI_READY");delay(300);SPI.begin();SPI.beginTransaction(SPISettings(8000000,MSBFIRST,SPI_MODE0));Serial.println("F4SPI_BEGIN");pinMode(PA4,OUTPUT);wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);Serial.println("F4SPI_DRAWN");}\nvoid loop(){Serial.println("F4SPI_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, selectTelemetry: ['mx1'], serialNeedle: 'F4SPI_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4SPI reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    console.log('F4-MAX7219 custom:', JSON.stringify(custom).slice(0, 250));
    expect(custom.shutdown).toBe(false);
    expect(custom.matrix?.[0]).toBe(0x7E);
    expect(custom.matrix?.[1]).toBe(0x30);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
