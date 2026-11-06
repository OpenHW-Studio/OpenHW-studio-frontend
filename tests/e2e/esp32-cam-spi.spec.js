import { test, expect } from '@playwright/test';

// ESP32-CAM SPI (remapped VSPI): the cam SHELL has no 18/23/5, so the
// cell drives a real MAX7219 over a REMAPPED SPI bus
// (SCK 14 / MOSI 13 / CS 15 — shell pins only, same remap family as the
// cam SD-SPI cell) through the engine's SPI taps (pollSpiTx MOSI +
// GPIO-out CS) into the shared SPI bridge.
// Proof: the MAX7219 model's own register matrix (model truth) plus the
// guest's write marker.
test.describe('ESP32-CAM SPI (remapped VSPI + MAX7219)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('MAX7219 shows digits over remapped SPI', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('pageerror', (err) => console.log('CAM-SPI PAGEERROR:', String(err).slice(0, 300)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'cam1', type: 'openhw-esp32-cam', attrs: {}, x: 100, y: 100 },
        { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'cam1:13', to: 'mx1:DIN' },
        { from: 'cam1:14', to: 'mx1:CLK' },
        { from: 'cam1:15', to: 'mx1:CS' },
        { from: 'cam1:3V3', to: 'mx1:VCC' },
        { from: 'cam1:GND.1', to: 'mx1:GND' },
      ],
      code: [
        '#include <SPI.h>',
        'void wr(uint8_t r,uint8_t d){digitalWrite(15,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(15,HIGH);}',
        'void setup(){',
        '  Serial.begin(115200);',
        '  Serial.println("CAMSPI_READY");',
        '  pinMode(15,OUTPUT);',
        '  SPI.begin(14,-1,13,15);',
        '  wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);',
        '  Serial.println("CAMSPI_DRAWN");',
        '}',
        'void loop(){Serial.println("CAMSPI_TICK");delay(1000);}',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['mx1'], serialNeedle: 'CAMSPI_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAM-SPI reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('CAM-SPI serial:', JSON.stringify((verdict.serial || '').slice(-400)));
    expect(verdict.pass).toBe(true);
    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    console.log('CAM-SPI MAX7219:', JSON.stringify(custom).slice(0, 250));
    expect(custom.shutdown).toBe(false);
    expect(custom.csActive).toBe(false);
    expect(custom.matrix?.[0]).toBe(0x7E);
    expect(custom.matrix?.[1]).toBe(0x30);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
