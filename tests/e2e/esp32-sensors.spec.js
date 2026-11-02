import { test, expect } from '@playwright/test';

// ESP32 sensor inputs at the component boundary: a PIR module on a digital
// pin and a photoresistor on an ADC pin. Both needles are read by the GUEST
// (digitalRead / analogRead) — the model's own telemetry is not proof.
test.describe('ESP32 sensors (PIR, photoresistor)', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
  });

  test('PIR OUT reaches digitalRead (motion on and off)', async ({ page }) => {
    const runWith = async (motion) => {
      const setup = await page.evaluate((m) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
          { id: 'pir1', type: 'wokwi-pir-motion-sensor', attrs: { motion: m }, x: 430, y: 120 },
        ],
        wires: [
          { from: 'esp1:3V3', to: 'pir1:VCC' },
          { from: 'esp1:GND', to: 'pir1:GND' },
          { from: 'pir1:OUT', to: 'esp1:GPIO27' },
        ],
        code: [
          'void setup(){ Serial.begin(115200); pinMode(27, INPUT); Serial.println("PIR_RDY"); }',
          'void loop(){ Serial.print("PIR_V:"); Serial.println(digitalRead(27)); delay(400); }',
        ].join('\n'),
      }), motion);
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 20000,
        selectTelemetry: ['pir1'],
        serialNeedle: 'PIR_V:',
        telemetryMode: 'detail',
      }));
      return [...(verdict.serial || '').matchAll(/PIR_V:(\d)/g)].map((mm) => Number(mm[1]));
    };

    const high = await runWith(true);
    console.log('ESPPIR high reads:', JSON.stringify(high.slice(0, 10)));
    expect(high.length).toBeGreaterThan(3);
    expect(high.every((v) => v === 1)).toBe(true);

    const low = await runWith(false);
    console.log('ESPPIR low reads:', JSON.stringify(low.slice(0, 10)));
    expect(low.length).toBeGreaterThan(3);
    expect(low.every((v) => v === 0)).toBe(true);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  test('photoresistor lux reaches analogRead', async ({ page }) => {
    const runWith = async (lux, tag) => {
      const setup = await page.evaluate(({ l, t }) => window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
          { id: 'ldr1', type: 'openhw-photoresistor', attrs: { lux: l }, x: 430, y: 120 },
        ],
        wires: [
          { from: 'esp1:3V3', to: 'ldr1:1' },
          { from: 'ldr1:2', to: 'esp1:GPIO34' },
          { from: 'esp1:GND', to: 'ldr1:GND' },
        ],
        code: [
          `void setup(){ Serial.begin(115200); Serial.println("${t}_RDY"); }`,
          `void loop(){ Serial.print("${t}_V:"); Serial.println(analogRead(34)); delay(400); }`,
        ].join('\n'),
      }), { l: lux, t: tag });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate((t) => window.OpenHWE2E.run({
        forMs: 20000,
        selectTelemetry: ['ldr1'],
        serialNeedle: `${t}_V:`,
        telemetryMode: 'detail',
      }), tag);
      return [...(verdict.serial || '').matchAll(new RegExp(`${tag}_V:(\\d+)`, 'g'))].map((mm) => Number(mm[1]));
    };

    // The model maps lux 1:1 onto a 5 V / 1023 ADC curve; the ESP32 ADC is
    // 3.3 V / 4095, so the same light reads 4095/1023 * lux.
    const bright = await runWith('500', 'LDRH');
    console.log('ESPLDR lux500 reads:', JSON.stringify(bright.slice(0, 10)));
    expect(bright.length).toBeGreaterThan(3);
    const brightAvg = bright.reduce((a, b) => a + b, 0) / bright.length;
    expect(brightAvg).toBeGreaterThan(2800);
    expect(brightAvg).toBeLessThan(3300);

    const dim = await runWith('200', 'LDRL');
    console.log('ESPLDR lux200 reads:', JSON.stringify(dim.slice(0, 10)));
    expect(dim.length).toBeGreaterThan(3);
    const dimAvg = dim.reduce((a, b) => a + b, 0) / dim.length;
    expect(dimAvg).toBeGreaterThan(1050);
    expect(dimAvg).toBeLessThan(1400);
    // Lower light must read lower, not just "some value".
    expect(dimAvg).toBeLessThan(brightAvg - 1000);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });
});
