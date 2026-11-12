import { test, expect } from '@playwright/test';

// ESP32 actuators: the guest drives a DC motor on a GPIO, a passive buzzer
// and an RC servo through LEDC. Every assertion reads the COMPONENT model's
// live state while the firmware runs (window.OpenHWTelemetry), because the
// post-run snapshot is taken after the signal has already stopped — that is
// how a working actuator looks "dead" in a verdict.
test.describe('ESP32 actuators (motor, buzzer, servo)', () => {
  test.setTimeout(600000);

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

  /** Poll one component's live model state N times, 1 s apart. */
  const sampleLive = (page, id, keys, n, startDelayMs = 12000) => page.evaluate(async ({ id, keys, n, startDelayMs }) => {
    await new Promise((r) => setTimeout(r, startDelayMs));
    const out = [];
    for (let i = 0; i < n; i++) {
      const list = window.OpenHWTelemetry?.getLatestTelemetry?.() || [];
      const st = list.find((x) => x.id === id)?.details?.state || {};
      const rec = {};
      for (const k of keys) rec[k] = st[k];
      out.push(rec);
      await new Promise((r) => setTimeout(r, 1000));
    }
    return out;
  }, { id, keys, n, startDelayMs });

  test('DC motor turns on a GPIO output', async ({ page }) => {
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'mot1', type: 'openhw-motor', attrs: {}, x: 430, y: 120 },
      ],
      wires: [
        { from: 'esp1:GPIO26', to: 'mot1:1' },
        { from: 'esp1:GND', to: 'mot1:2' },
      ],
      code: [
        'void setup(){ Serial.begin(115200); pinMode(26, OUTPUT); Serial.println("MOT_RDY"); }',
        'void loop(){ digitalWrite(26, HIGH); delay(400); digitalWrite(26, LOW); delay(400); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 40000, selectTelemetry: ['mot1'], serialNeedle: 'MOT_RDY', telemetryMode: 'detail',
    }));
    const rows = await sampleLive(page, 'mot1', ['speed'], 10);
    const verdict = await runP;
    const speeds = rows.map((r) => Number(r.speed) || 0);
    console.log('ESPMOT speeds:', JSON.stringify(speeds));
    const maxSpeed = Math.max(...speeds);
    expect(verdict.ok).toBe(true);
    expect(maxSpeed).toBeGreaterThan(0.2);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  test('buzzer tracks the LEDC tone frequency', async ({ page }) => {
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'bz1', type: 'openhw-buzzer', attrs: {}, x: 430, y: 120 },
      ],
      wires: [
        { from: 'esp1:GPIO25', to: 'bz1:SIG' },
        { from: 'esp1:GND', to: 'bz1:GND' },
      ],
      code: [
        'void setup(){ Serial.begin(115200); ledcAttach(25, 1000, 10); ledcWrite(25, 512); Serial.println("BZ_A"); }',
        'void loop(){ ledcWrite(25, 512); delay(200); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 40000, selectTelemetry: ['bz1'], serialNeedle: 'BZ_A', telemetryMode: 'detail',
    }));
    const rows = await sampleLive(page, 'bz1', ['isBuzzing', 'frequency'], 14);
    const verdict = await runP;
    const buzzing = rows.filter((r) => r.isBuzzing === true).map((r) => Math.round(Number(r.frequency) || 0));
    console.log('ESPBZ frequencies:', JSON.stringify(buzzing));
    expect(verdict.ok).toBe(true);
    expect(buzzing.length).toBeGreaterThan(2);
    expect(buzzing.every((f) => f === 1000)).toBe(true);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  test('servo angle follows the 50 Hz pulse width', async ({ page }) => {
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'srv1', type: 'openhw-servo', attrs: {}, x: 430, y: 120 },
      ],
      wires: [
        { from: 'esp1:5V', to: 'srv1:V+' },
        { from: 'esp1:GND', to: 'srv1:GND' },
        { from: 'esp1:GPIO13', to: 'srv1:PWM' },
      ],
      code: [
        'void setup(){ Serial.begin(115200); ledcAttach(13, 50, 16); Serial.println("SRV_RDY"); }',
        'void loop(){ ledcWrite(13, 4915); delay(60); ledcWrite(13, 6554); delay(60); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 40000, selectTelemetry: ['srv1'], serialNeedle: 'SRV_RDY', telemetryMode: 'detail',
    }));
    const rows = await sampleLive(page, 'srv1', ['angle', 'pwmPulseUs', 'pwmFrequencyHz'], 16);
    const verdict = await runP;
    const live = rows.filter((r) => Number(r.pwmFrequencyHz) === 50);
    const pulses = [...new Set(live.map((r) => Math.round(Number(r.pwmPulseUs) || 0)))];
    const angles = live.map((r) => Number(r.angle) || 0);
    console.log('ESPSRV pulses:', JSON.stringify(pulses), 'angles:', JSON.stringify(angles.map((a) => Number(a.toFixed(1)))));
    expect(verdict.ok).toBe(true);
    // 1500 us -> 92.7 deg, 2000 us -> 141.1 deg (544..2400 us spans 0..180).
    expect(pulses).toContain(1500);
    expect(pulses).toContain(2000);
    expect(live.length).toBeGreaterThan(4);
    expect(Math.max(...angles)).toBeGreaterThan(135);
    expect(Math.min(...angles)).toBeLessThan(100);
    expect(Math.min(...angles)).toBeGreaterThan(85);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });
});
