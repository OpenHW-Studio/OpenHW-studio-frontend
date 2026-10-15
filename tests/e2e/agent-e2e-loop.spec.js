import { test, expect } from '@playwright/test';

// Agent local loop (§11 R4; doc: openhw-studio-agent-relay/AGENT_LOOP.md):
// window.OpenHWE2E is ALWAYS mounted (no ?agent=1 gate).
// setupCircuit → snapshot → run verdict shape → stop, all in-browser.
// This is the loop other agents use to verify circuit+code+telemetry.
test.describe('Agent local E2E loop (OpenHWE2E)', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('harness mounted, setup→snapshot→run→stop shapes hold', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    // 1. Harness mounted (no flags needed).
    const mounted = await page.evaluate(() => ({
      hasE2E: typeof window.OpenHWE2E === 'object' && window.OpenHWE2E !== null,
      version: window.OpenHWE2E?.version,
      hasTelemetry: typeof window.OpenHWTelemetry === 'object' && window.OpenHWTelemetry !== null,
    }));
    expect(mounted.hasE2E).toBe(true);
    expect(mounted.version).toBe(3);
    expect(mounted.hasTelemetry).toBe(true);

    // 2. setupCircuit with a minimal blink circuit + sketch.
    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
          { id: 'led1', type: 'openhw-led', attrs: { color: 'red' }, x: 400, y: 150 },
          { id: 'r1', type: 'openhw-resistor', attrs: { value: '220' }, x: 280, y: 150 },
        ],
        wires: [
          { from: 'uno1:13', to: 'r1:p1' },
          { from: 'r1:p2', to: 'led1:A' },
          { from: 'led1:K', to: 'uno1:GND' },
        ],
        code: 'void setup(){pinMode(13,OUTPUT);}\nvoid loop(){digitalWrite(13,HIGH);delay(500);digitalWrite(13,LOW);delay(500);}\n',
      }));
    expect(setup.ok).toBe(true);
    expect(setup.components).toBe(3);
    expect(setup.wires).toBe(3);

    // 3. Snapshot shape (canvas + serial + pins + telemetry keys).
    const snap = await page.evaluate(() => window.OpenHWE2E.snapshot());
    expect(snap.components).toBe(3);
    expect(snap.wires).toBe(3);
    expect(Array.isArray(Object.keys(snap.pins || {}))).toBe(true);
    expect('serialLines' in snap).toBe(true);
    expect('telemetry' in snap).toBe(true);

    // 4. Run verdict shape (short budget; pass depends on compile in CI —
    // assert SHAPE here, not pass; pass is covered by live-dev runs).
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 3000, selectTelemetry: ['led1'], telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect('pass' in verdict).toBe(true);
    expect(Array.isArray(verdict.reasons)).toBe(true);
    expect('serial' in verdict).toBe(true);
    expect('pins' in verdict).toBe(true);
    expect('telemetry' in verdict).toBe(true);
    expect('telemetryCount' in verdict).toBe(true);

    // 5. Stop clean.
    const stopped = await page.evaluate(() => window.OpenHWE2E.stop());
    expect(stopped.ok).toBe(true);

    expect(errors.filter((e) => /OpenHWE2E|e2e|E2E/i.test(e))).toEqual([]);
  });
});
