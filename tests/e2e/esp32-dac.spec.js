import { test, expect } from '@playwright/test';

// ESP32 DAC loopback (DevKit): dacWrite(25) drives DAC channel 1 and the
// engine routes the channel voltage back into ADC reads on the same pin
// (documented dacOutputs ADC-loopback contract). Firmware ramps 0/128/255
// and reads each step back: proves the DAC + ADC chain with real Arduino
// dacWrite/analogRead and no runner bridge.
const CODE = 'void setup() {\n  Serial.begin(115200);\n  Serial.println("ESPDAC_READY");\n  analogReadResolution(12);\n}\nvoid loop() {\n  int vals[3]; int outs[3] = {0, 128, 255};\n  for (int i = 0; i < 3; i++) {\n    dacWrite(25, outs[i]);\n    delay(50);\n    vals[i] = analogRead(25);\n  }\n  Serial.print("ESPDAC_LOOP:");\n  Serial.print(vals[0]); Serial.print(",");\n  Serial.print(vals[1]); Serial.print(",");\n  Serial.println(vals[2]);\n  delay(2000);\n}\n';

test.describe('ESP32 DAC (devkit loopback)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('DAC staircase reads back monotonically on ADC', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, serialNeedle: 'ESPDAC_LOOP:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPDAC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPDAC serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const m = /ESPDAC_LOOP:(\d+),(\d+),(\d+)/.exec(verdict.serial || '');
    console.log('ESPDAC steps:', m ? m.slice(1) : 'NONE');
    expect(m).toBeTruthy();
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    // 12-bit ADC over 3.3V: 0 -> ~0, 128 -> ~2048, 255 -> ~4095.
    expect(a).toBeLessThan(400);
    expect(b).toBeGreaterThan(1400);
    expect(b).toBeLessThan(2700);
    expect(c).toBeGreaterThan(3600);
    expect(a < b && b < c).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
