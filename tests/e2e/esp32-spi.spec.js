import { test, expect } from '@playwright/test';

// ESP32 SPI (DevKit MAX7219): VSPI bus (SCK 18 / MOSI 23 / CS 5) over
// esp32-emu 1.2.0 SPI taps (pollSpiTx MOSI + GPIO-out CS) into the shared
// SPI bridge. Same assert shape as the F1 SPI row.
test.describe('ESP32 SPI (devkit MAX7219)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('MAX7219 shows digits over VSPI', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/ESP SPI DIAG/i.test(t)) console.log('CAPTURED-DIAG:', t.slice(0, 200));
      } catch { /* ignore */ }
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:23', to: 'mx1:DIN' },
        { from: 'esp1:18', to: 'mx1:CLK' },
        { from: 'esp1:5', to: 'mx1:CS' },
        { from: 'esp1:3V3', to: 'mx1:VCC' },
        { from: 'esp1:GND.1', to: 'mx1:GND' },
      ],
      code: '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(5,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(5,HIGH);}\nvoid setup(){Serial.begin(115200);Serial.println("ESP_SPI_READY");SPI.begin();pinMode(5,OUTPUT);wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);Serial.println("ESP_SPI_DRAWN");}\nvoid loop(){Serial.println("ESP_SPI_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['mx1'], serialNeedle: 'ESP_SPI_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPSPI reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    console.log('ESP-MAX7219 custom:', JSON.stringify(custom).slice(0, 250));
    expect(custom.shutdown).toBe(false);
    expect(custom.csActive).toBe(false);
    expect(custom.matrix?.[0]).toBe(0x7E);
    expect(custom.matrix?.[1]).toBe(0x30);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
