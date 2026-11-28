import { test, expect } from '@playwright/test';

// STM32F1 engine throughput benchmark (fixed instruction budget).
//
// Mirror of stm32f4-bench.spec.js: the guest prints GO:<millis()> at boot,
// burns a fixed fused stack-counter delay-loop budget, then prints
// DONE:<millis()>. The harness times the GO->DONE wall gap on the e2e
// serial mirror and reports guest milliseconds advanced per wall
// millisecond (1.0 = real time), alongside raw inner iterations/wall-s.
//
// Env: F1_BENCH_BOARD (board type, default openhw-stm32-bluepill),
//      F1_BENCH_BUDGET (delay units, default 10000 -> 40M inner iters;
//      the longer window amortises transient CPU contention on a shared box),
//      F1_BENCH_SHAPE (A/B loop shape; default forup — F1 needs no special
//      shape once the runner budget matches the 72MHz core).

const BOARD = process.env.F1_BENCH_BOARD || 'openhw-stm32-bluepill';
const BUDGET = Number(process.env.F1_BENCH_BUDGET || 10000);

const BODY = {
  forup: `for (int b = 0; b < ${BUDGET}; b++) for (volatile int i = 0; i < 4000; i++);`,
  doup: `for (int b = 0; b < ${BUDGET}; b++) { volatile int i = 0; do { i++; } while (i < 4000); }`,
  dowhile: `for (int b = 0; b < ${BUDGET}; b++) { volatile int i = 0; do { i = i + 1; } while (i != 4000); }`,
  whiledec: `for (int b = 0; b < ${BUDGET}; b++) { volatile int i = 4000; while (i-- > 0); }`,
  whileinc: `for (int b = 0; b < ${BUDGET}; b++) { volatile int i = 0; while (++i < 4000); }`,
}[process.env.F1_BENCH_SHAPE || 'forup'];
const CODE = [
  'static volatile unsigned long done = 0;',
  'void setup(){ Serial.begin(9600); Serial.print("GO:"); Serial.println(millis()); }',
  'void loop(){',
  '  if (!done) {',
  `    ${BODY}`,
  '    Serial.print("DONE:"); Serial.println(millis()); done = 1; return;',
  '  }',
  '  delay(1000);',
  '}',
].join('\n');

const poll = (page, needle) => page.waitForFunction(
  (n) => String(window.OpenHWE2E?.snapshot?.().serialText || '').includes(n),
  needle,
  { timeout: 180000, polling: 100 },
);

test.describe('STM32F1 guest-time throughput benchmark (fixed instruction budget)', () => {
  test.setTimeout(400000);

  test('fused stack-counter delay loop: guest ms per wall second', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      if (route.request().url().includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.addInitScript(() => window.localStorage.setItem('openhw-tour-completed', 'true'));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 60000 });
    await page.waitForTimeout(3000);

    const setup = await page.evaluate(({ code, board }) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'f11', type: board, attrs: {}, x: 100, y: 100 }],
      wires: [],
      code,
    }), { code: CODE, board: BOARD });
    expect(setup.ok).toBe(true);

    await page.evaluate(() => {
      window.__benchRun = window.OpenHWE2E.run({ forMs: 300000, serialNeedle: null, telemetryMode: 'detail' });
    });
    await poll(page, 'GO:');
    const t0 = await page.evaluate(() => performance.now());
    await poll(page, 'DONE:');
    const t1 = await page.evaluate(() => performance.now());
    const wallMs = t1 - t0;
    const serial = await page.evaluate(() => String(window.OpenHWE2E?.snapshot?.().serialText || ''));
    await page.evaluate(() => window.OpenHWE2E.stop());

    const guestAt = (tag) => {
      const m = serial.match(new RegExp(tag + '\\s*(\\d+)'));
      return m ? Number(m[1]) : NaN;
    };
    const guestMs = guestAt('DONE:') - guestAt('GO:');
    const innerIters = BUDGET * 4000;
    console.log('F1BENCH ' + JSON.stringify({
      board: BOARD,
      shape: process.env.F1_BENCH_SHAPE || 'forup',
      budget: BUDGET,
      innerIters,
      guestMs,
      wallMs: +wallMs.toFixed(1),
      guestPerWall: +(guestMs / wallMs).toFixed(3),
      innerItersPerWallS: +(innerIters / (wallMs / 1000)).toFixed(0),
    }));
    expect(wallMs).toBeGreaterThan(0);
    expect(Number.isFinite(guestMs) && guestMs > 0).toBe(true);
  });
});
