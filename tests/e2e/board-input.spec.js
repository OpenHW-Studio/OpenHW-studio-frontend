import { test, expect } from '@playwright/test';

// Live input-path rows (plan §8 matrix expansion): board reads driven by
// wired components, no interaction harness needed — switch/pot positions
// come from preset component attrs. Backend compiles real firmware.
test.describe('Board input paths (button/switch/ADC live)', () => {
  test.setTimeout(600000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('digital input HIGH via preset slide-switch: uno D8', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:5V', to: 'sw1:3' },
          { from: 'uno1:gnd_1', to: 'sw1:1' },
          { from: 'sw1:2', to: 'uno1:8' },
        ],
        code: 'void setup(){pinMode(8,INPUT);Serial.begin(9600);Serial.println("IN_READY");}\nvoid loop(){Serial.println(digitalRead(8));delay(500);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() =>
      window.OpenHWE2E.run({ forMs: 15000, serialNeedle: 'IN_READY', telemetryMode: 'detail' }));
    console.log('switch-HIGH verdict:', JSON.stringify({
      pass: verdict.pass, reasons: verdict.reasons,
      serialHead: (verdict.serial || '').slice(0, 80),
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // Firmware must observe the driven-HIGH line (at least one '1' reading).
    expect(/[\r\n]1[\r\n]/.test(verdict.serial || '')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('digital input LOW via preset slide-switch: uno D8', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '0' }, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:5V', to: 'sw1:3' },
          { from: 'uno1:gnd_1', to: 'sw1:1' },
          { from: 'sw1:2', to: 'uno1:8' },
        ],
        code: 'void setup(){pinMode(8,INPUT);Serial.begin(9600);Serial.println("IN_READY");}\nvoid loop(){Serial.println(digitalRead(8));delay(500);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() =>
      window.OpenHWE2E.run({ forMs: 15000, serialNeedle: 'IN_READY', telemetryMode: 'detail' }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    expect(/[\r\n]0[\r\n]/.test(verdict.serial || '')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('analog input via preset potentiometer: uno A0', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'pot1', type: 'openhw-potentiometer', attrs: { value: 75 }, x: 450, y: 120 },
        ],
        wires: [
          { from: 'uno1:5V', to: 'pot1:2' },
          { from: 'uno1:gnd_1', to: 'pot1:1' },
          { from: 'pot1:SIG', to: 'uno1:A0' },
        ],
        code: 'void setup(){Serial.begin(9600);Serial.println("ADC_READY");}\nvoid loop(){Serial.println(analogRead(A0));delay(500);}\n',
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() =>
      window.OpenHWE2E.run({ forMs: 15000, serialNeedle: 'ADC_READY', telemetryMode: 'detail' }));
    console.log('ADC verdict:', JSON.stringify({
      pass: verdict.pass, reasons: verdict.reasons,
      serialHead: (verdict.serial || '').slice(0, 80),
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // 75% of 5V rail ≈ 767 counts; accept a wide band for divider modeling.
    const readings = (verdict.serial || '').split(/[\r\n]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
    expect(readings.length).toBeGreaterThan(0);
    expect(Math.max(...readings)).toBeGreaterThan(600);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
