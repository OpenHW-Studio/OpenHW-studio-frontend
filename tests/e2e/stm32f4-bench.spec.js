import { test, expect } from '@playwright/test';

// STM32F4 guest-time throughput benchmark (fixed instruction budget).
//
// The guest prints GO:<millis()> at boot, burns a fixed budget in a fused
// stack-counter delay loop, then prints DONE:<millis()>. The harness times
// the GO->DONE wall gap on the e2e serial mirror and reports the real-time
// metric: guest milliseconds advanced per wall millisecond (1.0 = real time).
// Boot/compile overhead is excluded by using the serial markers as anchors.
//
// The default shape (`doup`/`dowhile`, do..while with a post-increment on a
// volatile stack slot) compiles to the owner engine's fused stack-counter
// loop, which the TB translator accepts (`hits > 0`): ~2.4x the throughput
// of the `for (volatile int i = 0; i < N; i++)` shape, whose counted loop
// has a forward branch to a separate latch block that the translator
// declines. `F4_BENCH_SHAPE=forup` keeps the old shape for A/B.
//
// Env: F4_BENCH_ENGINE=<label>, F4_BENCH_TB=off (interpreter-only arm),
//      F4_BENCH_BUDGET=<delay units> (default 10000 -> 40M inner iters;
//      the longer window amortises transient CPU contention on a shared box),
//      F4_BENCH_SHAPE=<shape> (A/B: forup/doup/dowhile/whiledec/...).

const BUDGET = Number(process.env.F4_BENCH_BUDGET || 10000);
const TB_OFF = String(process.env.F4_BENCH_TB || '').toLowerCase() === 'off';
const SHAPE = process.env.F4_BENCH_SHAPE || 'dowhile';

const BODY = {
  forup: `for (int b = 0; b < ${BUDGET}; b++) for (volatile int i = 0; i < 4000; i++);`,
  doup: `for (int b = 0; b < ${BUDGET}; b++) { volatile int i = 0; do { i++; } while (i < 4000); }`,
  dowhile: `for (int b = 0; b < ${BUDGET}; b++) { volatile int i = 0; do { i = i + 1; } while (i != 4000); }`,
  whiledec: `for (int b = 0; b < ${BUDGET}; b++) { volatile int i = 4000; while (i-- > 0); }`,
  whileinc: `for (int b = 0; b < ${BUDGET}; b++) { volatile int i = 0; while (++i < 4000); }`,
}[SHAPE];
const CODE = [
  'static volatile unsigned long done = 0;',
  'void setup(){ Serial.begin(115200); Serial.print("GO:"); Serial.println(millis()); }',
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

test.describe('STM32F4 guest-time throughput benchmark (fixed instruction budget)', () => {
  test.setTimeout(400000);

  test('fused stack-counter delay loop: guest ms per wall ms', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      if (route.request().url().includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.addInitScript(() => window.localStorage.setItem('openhw-tour-completed', 'true'));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 180000 });
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
    console.log('F4BENCH ' + JSON.stringify({
      engine: process.env.F4_BENCH_ENGINE || 'unknown',
      shape: SHAPE,
      tb: TB_OFF ? 'off' : 'on',
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
