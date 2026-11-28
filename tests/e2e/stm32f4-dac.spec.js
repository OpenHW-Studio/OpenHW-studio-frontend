import { test, expect } from '@playwright/test';

// F4 DAC loopback (Disco F407): analogWrite(PA4) drives DAC channel 1 and
// the runner bridges the DOR readback (which IS the pin value — no analog
// layer in the engine) into ADC nets touching PA4/PA5 when no component
// drives them. PA4 wired to PA0 on-board: proves DAC + ADC chain with real
// Arduino analogWrite/analogRead, 12-bit both ends.
const CODE = 'void setup() {\n  Serial.begin(9600);\n  Serial.println("F4DAC_READY");\n  analogWriteResolution(12);\n  analogReadResolution(12);\n}\nvoid loop() {\n  int outs[3] = {0, 2048, 4095};\n  int vals[3];\n  for (int i = 0; i < 3; i++) {\n    analogWrite(PA4, outs[i]);\n    delay(100);\n    vals[i] = analogRead(PA0);\n  }\n  Serial.print("F4DAC_LOOP:");\n  Serial.print(vals[0]); Serial.print(",");\n  Serial.print(vals[1]); Serial.print(",");\n  Serial.println(vals[2]);\n  delay(2000);\n}\n';

test.describe('F4 DAC (disco loopback)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('DAC staircase reads back on ADC through the wire', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: {}, x: 100, y: 100 },
      ],
      wires: [
        { from: 'f41:PA4', to: 'f41:PA0' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, serialNeedle: 'F4DAC_LOOP:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('F4DAC reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('F4DAC serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const m = /F4DAC_LOOP:(\d+),(\d+),(\d+)/.exec(verdict.serial || '');
    console.log('F4DAC steps:', m ? m.slice(1) : 'NONE');
    expect(m).toBeTruthy();
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    expect(a).toBeLessThan(400);
    expect(b).toBeGreaterThan(1400);
    expect(b).toBeLessThan(2700);
    expect(c).toBeGreaterThan(3600);
    expect(a < b && b < c).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
