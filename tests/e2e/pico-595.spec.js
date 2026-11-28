import { test, expect } from '@playwright/test';

// Pico 1 + 74HC595 (SPI0 byte mode via spimirror): shift 0x81, latch on
// CS rising edge, q0+q7 LEDs light.
test.describe('Pico 74HC595 (SPI0 shift register)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('shift out 0x81 lights q0 and q7', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'pico1', type: 'openhw-pico', attrs: {}, x: 100, y: 100 },
        { id: 'sr1', type: 'openhw-74hc595', attrs: {}, x: 450, y: 100 },
        { id: 'res0', type: 'openhw-resistor', attrs: {}, x: 600, y: 80 },
        { id: 'res7', type: 'openhw-resistor', attrs: {}, x: 600, y: 160 },
        { id: 'led0', type: 'openhw-led', attrs: {}, x: 700, y: 80 },
        { id: 'led7', type: 'openhw-led', attrs: {}, x: 700, y: 160 },
      ],
      wires: [
        { from: 'pico1:GP19', to: 'sr1:ser' },
        { from: 'pico1:GP18', to: 'sr1:srclk' },
        { from: 'pico1:GP17', to: 'sr1:rclk' },
        { from: 'pico1:GND', to: 'sr1:oe' },
        { from: 'pico1:GP15', to: 'sr1:srclr' },
        { from: 'pico1:3V3', to: 'sr1:vcc' },
        { from: 'pico1:GND', to: 'sr1:gnd' },
        { from: 'sr1:q0', to: 'res0:p1' },
        { from: 'res0:p2', to: 'led0:A' },
        { from: 'led0:C', to: 'pico1:GND' },
        { from: 'sr1:q7', to: 'res7:p1' },
        { from: 'res7:p2', to: 'led7:A' },
        { from: 'led7:C', to: 'pico1:GND' },
      ],
      code: '#include <SPI.h>\nvoid setup(){Serial.begin(9600);Serial.println("PSR_READY");SPI.begin();SPI.beginTransaction(SPISettings(8000000, MSBFIRST, SPI_MODE0));pinMode(17,OUTPUT);pinMode(15,OUTPUT);digitalWrite(15,HIGH);digitalWrite(17,LOW);SPI.transfer(0x81);digitalWrite(17,HIGH);Serial.println("PSR_LATCHED");}\nvoid loop(){Serial.println("PSR_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['led0', 'led7'], serialNeedle: 'PSR_LATCHED', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('PSR reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    for (const id of ['led0', 'led7']) {
      const led = (verdict.telemetry || []).find((t) => t.id === id);
      expect(led).toBeTruthy();
      const custom = led.details?.custom || led.details?.metrics?.custom || {};
      console.log(`PSR ${id}:`, JSON.stringify(custom).slice(0, 120));
      expect(custom.glow).toBe(true);
    }
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
