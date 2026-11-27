import { test, expect } from '@playwright/test';

// STM32F4 engine throughput benchmark (A/B harness).
//
// Fixed-instruction-budget / wall-time measurement, so boot and compile
// overhead cannot contaminate the number (a fixed `run({forMs})` window did:
// the newer engine's larger wasm made its startup slower, which made a
// throughput comparison of total run() wall time misleading).
//
// The guest prints GO at boot, burns a fixed budget in the owner's "fused
// stack-counter delay loop" shape (`for (volatile int i = 0; i < 4000; i++)`,
// counter in a stack slot), then prints DONE and idles. The harness times
// the GO->DONE wall gap by polling the e2e serial mirror. Same budget on
// both engines = direct throughput ratio, independent of the guest clock
// (which is instruction-count based and therefore not a speed metric).
//
// Env: F4_BENCH_ENGINE=<label>, F4_BENCH_TB=off (interpreter-only arm),
//      F4_BENCH_BUDGET=<delay units> (default 5000 -> 20M inner iters)

const BUDGET = Number(process.env.F4_BENCH_BUDGET || 5000);
const TB_OFF = String(process.env.F4_BENCH_TB || '').toLowerCase() === 'off';

const CODE = [
  'static volatile unsigned long done = 0;',
  'void setup(){ Serial.begin(115200); Serial.println("GO"); }',
  'void loop(){',
  '  if (!done) {',
  `    for (int b = 0; b < ${BUDGET}; b++) for (volatile int i = 0; i < 4000; i++);`,
  '    Serial.println("DONE"); done = 1; return;',
  '  }',
  '  delay(1000);',
  '}',
].join('\n');

const poll = (page, needle) => page.waitForFunction(
  (n) => String(window.OpenHWE2E?.snapshot?.().serialText || '').includes(n),
  needle,
  { timeout: 180000, polling: 100 },
);

test.describe('STM32F4 engine throughput benchmark (fixed instruction budget)', () => {
  test.setTimeout(400000);

  test('fused stack-counter delay loop: wall time for a fixed guest budget', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      if (route.request().url().includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.addInitScript(() => window.localStorage.setItem('openhw-tour-completed', 'true'));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 60000 });
    await page.waitForTimeout(3000);

    const setup = await page.evaluate(({ code, tbOff }) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'f41', type: 'openhw-stm32f4', attrs: tbOff ? { tb: 'off' } : {}, x: 100, y: 100 }],
      wires: [],
      code,
    }), { code: CODE, tbOff: TB_OFF });
    expect(setup.ok).toBe(true);

    // Start the run without awaiting its fixed-window promise; we stop as
    // soon as DONE lands. The promise is harmless after stop().
    await page.evaluate(() => {
      window.__benchRun = window.OpenHWE2E.run({ forMs: 300000, serialNeedle: null, telemetryMode: 'detail' });
    });
    await poll(page, 'GO');
    const t0 = await page.evaluate(() => performance.now());
    await poll(page, 'DONE');
    const t1 = await page.evaluate(() => performance.now());
    const wallMs = t1 - t0;
    await page.evaluate(() => window.OpenHWE2E.stop());

    const innerIters = BUDGET * 4000;
    console.log('F4BENCH ' + JSON.stringify({
      engine: process.env.F4_BENCH_ENGINE || 'unknown',
      tb: TB_OFF ? 'off' : 'on',
      budget: BUDGET,
      innerIters,
      wallMs: +wallMs.toFixed(1),
      innerItersPerWallS: +(innerIters / (wallMs / 1000)).toFixed(0),
    }));
    expect(wallMs).toBeGreaterThan(0);
  });
});
