import { test, expect } from '@playwright/test';

// ESP32-CAM PWM/LEDC: the cam SHELL has no 25/26 (the DevKit's DAC pins)
// but it DOES have GPIO16 — the same LEDC pin the DevKit PWM cell uses.
// The cell therefore proves LEDC (not the DAC): ledcAttach/ledcWrite on
// GPIO16, observed by the guest through ledcRead AND by the LED model
// through the engine's getLedc/getLedcPin taps (model truth).
test.describe('ESP32-CAM PWM/LEDC (GPIO16)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('LED brightness tracks ledc duty on cam GPIO16', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('pageerror', (err) => console.log('CAM-PWM PAGEERROR:', String(err).slice(0, 300)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'cam1', type: 'openhw-esp32-cam', attrs: {}, x: 100, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'cam1:16', to: 'led1:A' },
        { from: 'cam1:GND.1', to: 'led1:C' },
      ],
      code: 'void setup(){Serial.begin(115200);Serial.println("CAMPWM_RDY2");ledcAttach(16,5000,8);ledcWrite(16,192);Serial.println("CAMPWM_SET");}\nvoid loop(){Serial.print("CAMPWM_G:");Serial.println(ledcRead(16));Serial.println("CAMPWM_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['led1'], serialNeedle: 'CAMPWM_SET', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAM-PWM reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('CAM-PWM serial:', JSON.stringify((verdict.serial || '').slice(-400)));
    const guest = [...(verdict.serial || '').matchAll(/CAMPWM_G:(\d+)/g)].map((m) => Number(m[1]));
    console.log('CAM-PWM guest reads:', JSON.stringify(guest.slice(0, 8)));
    expect(verdict.pass).toBe(true);
    expect(guest.length).toBeGreaterThan(0);
    // LEDC duty 192/256 = 75% -> the guest's own ledcRead must land near
    // 192 once the peripheral has settled.
    const settled = guest.slice(-3);
    for (const g of settled) expect(Math.abs(g - 192)).toBeLessThan(16);
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    const custom = led.details?.custom || led.details?.metrics?.custom || {};
    console.log('CAM-PWM led:', JSON.stringify(custom).slice(0, 200));
    expect(custom.glow).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
