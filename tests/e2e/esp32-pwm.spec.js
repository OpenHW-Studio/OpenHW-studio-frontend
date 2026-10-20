import { test, expect } from '@playwright/test';

// ESP32 PWM: LEDC 8-bit duty on GPIO16 observed via getLedc/getLedcPin taps
// into the LED model. Core 3.x pin API: ledcAttach(pin, freq, res).
test.describe('ESP32 PWM (devkit LED)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('LED brightness tracks ledc duty on GPIO16', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:GPIO16', to: 'led1:A' },
        { from: 'esp1:GND', to: 'led1:C' },
      ],
      code: 'void setup(){Serial.begin(115200);Serial.println("ESPPWM_RDY2");ledcAttach(16,5000,8);ledcWrite(16,192);Serial.println("ESPPWM_SET");}\nvoid loop(){Serial.print("ESPPWM_G:");Serial.println(ledcRead(16));Serial.println("ESPPWM_TICK");delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      // NOTE: ESP32 ticks are ~1/sec in the browser worker and Arduino
      // boot is slow, so LEDC config lands near the tail and steady
      // state needs a long window (duty=1 single samples are
      // mid-update transients, not the settled value).
      forMs: 240000, selectTelemetry: ['led1'], serialNeedle: 'ESPPWM_SET', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPPWM reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPPWM serial:', JSON.stringify((verdict.serial || '').slice(0, 400)));
    const guest = [...(verdict.serial || '').matchAll(/ESPPWM_G:(\d+)/g)].map((m) => Number(m[1]));
    console.log('ESPPWM guest reads:', JSON.stringify(guest.slice(0, 8)));
    expect(verdict.pass).toBe(true);
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    const custom = led.details?.custom || led.details?.metrics?.custom || {};
    console.log('ESPPWM led:', JSON.stringify(custom).slice(0, 200));
    expect(custom.glow).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
