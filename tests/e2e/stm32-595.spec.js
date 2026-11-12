import { test, expect } from '@playwright/test';

// F1 + 74HC595 (SPI byte mode): shift 0x81, latch on CS rising edge,
// q0+q7 LEDs light. Real Arduino SPI.transfer firmware.
test.describe('STM32F1 74HC595 (bluepill shift register)', () => {
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
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/SPI diag|595 diag/i.test(t)) console.log('CAPTURED-DIAG:', t.slice(0, 160));
      } catch { /* ignore */ }
    });
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'bp1', type: 'openhw-stm32-bluepill', attrs: {}, x: 100, y: 100 },
        { id: 'sr1', type: 'openhw-74hc595', attrs: {}, x: 450, y: 100 },
        { id: 'res0', type: 'openhw-resistor', attrs: {}, x: 600, y: 80 },
        { id: 'res7', type: 'openhw-resistor', attrs: {}, x: 600, y: 160 },
        { id: 'led0', type: 'openhw-led', attrs: {}, x: 700, y: 80 },
        { id: 'led7', type: 'openhw-led', attrs: {}, x: 700, y: 160 },
      ],
      wires: [
        { from: 'bp1:PA7', to: 'sr1:ser' },
        { from: 'bp1:PA5', to: 'sr1:srclk' },
        { from: 'bp1:PA4', to: 'sr1:rclk' },
        { from: 'bp1:SWD_GND', to: 'sr1:oe' },
        { from: 'bp1:PB1', to: 'sr1:srclr' },
        { from: 'bp1:SWD_3V3', to: 'sr1:vcc' },
        { from: 'bp1:SWD_GND', to: 'sr1:gnd' },
        { from: 'sr1:q0', to: 'res0:p1' },
        { from: 'res0:p2', to: 'led0:A' },
        { from: 'led0:C', to: 'bp1:SWD_GND' },
        { from: 'sr1:q7', to: 'res7:p1' },
        { from: 'res7:p2', to: 'led7:A' },
        { from: 'led7:C', to: 'bp1:SWD_GND' },
      ],
      code: '#include <SPI.h>\nvoid setup(){Serial.begin(9600);Serial.println("SR_READY");SPI.begin();pinMode(PA4,OUTPUT);pinMode(PB1,OUTPUT);digitalWrite(PB1,HIGH);digitalWrite(PA4,LOW);SPI.transfer(0x81);digitalWrite(PA4,HIGH);delay(10);digitalWrite(PA4,LOW);delay(10);digitalWrite(PA4,HIGH);Serial.println("SR_LATCHED");}\nvoid loop(){Serial.println("SR_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['led0', 'led7'], serialNeedle: 'SR_LATCHED', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('SR reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    for (const id of ['led0', 'led7']) {
      const led = (verdict.telemetry || []).find((t) => t.id === id);
      expect(led).toBeTruthy();
      const custom = led.details?.custom || led.details?.metrics?.custom || {};
      console.log(`SR ${id}:`, JSON.stringify(custom).slice(0, 120));
      expect(custom.glow).toBe(true);
    }
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
