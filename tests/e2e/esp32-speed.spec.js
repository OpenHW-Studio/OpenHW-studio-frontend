import { test, expect } from '@playwright/test';

// ESP32 speed cell: how fast does the engine actually run?
//
// Two independent measurements in one run, both from the guest's own clock:
//   compute — the guest counts 200k-iteration loops and reports them with
//             millis(); consecutive serial samples give loops per GUEST
//             second (core throughput) and loops per WALL second. The
//             counter is `volatile` and the loop body is `total = total + 1`
//             on purpose: a plain `total++` counting loop gets folded into
//             one add by the optimizer, and the measurement then times a
//             loop that no longer exists.
//   idle    — setup prints D0, calls delay(2000), prints D1; the wall gap
//             between the two lines is what a guest second of waiting costs
//             (the engine fast-forwards idle time, so this is the pacing
//             users see in delay()-driven sketches).
// The app's pace store (window.__simPaceByBoard, sim ms per wall ms, EMA)
// is printed for comparison — it is NOT used as the measurement: it comes
// from the engine's sim.nanos counter, which on a busy loop runs far ahead
// of the guest's millis() (observed 2.3x vs 0.05x on the same run).
//
// Assertions stay loose so a loaded CI box does not turn a measurement into
// a flake; the numbers themselves are the deliverable.

const CODE = [
  'volatile unsigned long total = 0;',
  'void setup(){',
  '  Serial.begin(115200);',
  '  delay(300);',
  '  Serial.println("D0");',
  '  delay(2000);',
  '  Serial.println("D1");',
  '  Serial.println("SPEED_READY");',
  '}',
  'void loop(){',
  '  for (unsigned long i = 0; i < 200000UL; i++) total = total + 1;',
  '  Serial.print("SPD ");',
  '  Serial.print(total);',
  '  Serial.print(" ");',
  '  Serial.println(millis());',
  '}',
].join('\n');

test.describe('ESP32 speed', () => {
  // Scaled in the test body (it depends on the preset): a 4x faster guest
  // clock needs 4x the wall window for the same `forMs` guest-time run.
  test.setTimeout(1500000);

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
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
  });

  test('compute throughput, delay pacing and the pace pill', async ({ page }) => {
    // ESP32_TICK_MHZ=<n> measures the board Clock preset (board attr
    // tickMHz -> init config cpuFrequency -> engine CPU clock: guest cycles
    // per virtual second = target MHz, while APB 80 MHz and RTC 32.768 kHz
    // stay absolute). Unset (the default) is the native 160 MHz timebase.
    // History: until 2026-11-03 any value below native left the board with
    // zero guest serial — the runner counted its own ESP32CLK marker as
    // proof-of-life and never re-posted RUN. Fixed in esp32-runner
    // (liveness = retired instructions); 40 MHz now boots.
    // Computed in Node: nothing inside page.evaluate can see process.env.
    const tickMHz = process.env.ESP32_TICK_MHZ || '';
    // Guest time per wall second scales with 160/preset, and `forMs` is guest
    // time: a 4x faster guest clock needs 4x the wall window. Keep every wait
    // proportional so the cell measures rather than times out.
    const div = tickMHz ? 160 / Number(tickMHz) : 1;
    const setup = await page.evaluate(({ code, tickMHz }) => window.OpenHWE2E.setupCircuit({
      components: [
        {
          id: 'esp1',
          type: 'openhw-esp32',
          attrs: { macAddress: '24:6F:28:00:00:41', ...(tickMHz ? { tickMHz } : {}) },
          x: 100,
          y: 100,
        },
      ],
      wires: [],
      code,
    }), { code: CODE, tickMHz });
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 45000, serialNeedle: 'SPD ', telemetryMode: 'detail',
    }));

    // Timestamp the two delay markers as they reach the serial monitor.
    const marks = {};
    const deadline = Date.now() + 60000 * Math.min(div, 8);
    while ((!marks.D0 || !marks.D1) && Date.now() < deadline) {
      const text = await page.evaluate(() => String(window.OpenHWE2E.snapshot()?.serialText || ''));
      if (!marks.D0 && /(^|\n)D0\s*(\r?\n|$)/.test(text)) marks.D0 = Date.now();
      if (!marks.D1 && /(^|\n)D1\s*(\r?\n|$)/.test(text)) marks.D1 = Date.now();
      if (marks.D1) break;
      await page.waitForTimeout(100);
    }

    // Printed BEFORE the SPD wait so a timed-out cell still shows whether the
    // board booted (D0/D1) or never reached setup.
    console.log('ESP32SPEED marks:', JSON.stringify({
      tickMHz: tickMHz || 'native',
      D0: !!marks.D0,
      D1: !!marks.D1,
      delayWallMs: marks.D0 && marks.D1 ? marks.D1 - marks.D0 : null,
      serial: await page.evaluate(() => String(window.OpenHWE2E.snapshot()?.serialText || '').slice(-160)),
    }));
    await page.waitForFunction(
      () => String(window.OpenHWE2E.snapshot()?.serialText || '').includes('SPD '),
      null,
      { timeout: 180000 * Math.min(div, 4) },
    );

    const sample = () => page.evaluate(() => {
      const sn = window.OpenHWE2E.snapshot() || {};
      const lines = String(sn.serialText || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith('SPD '))
        .map((l) => l.slice(4).split(/\s+/).map(Number))
        .filter((v) => v.length === 2 && v.every((x) => Number.isFinite(x)));
      const store = window.__simPaceByBoard || {};
      const now = Date.now();
      const fresh = Object.values(store)
        .filter((e) => e && now - Number(e.at || 0) < 3000 && Number.isFinite(Number(e.ema)))
        .sort((x, y) => Number(y.at) - Number(x.at));
      return {
        last: lines.length ? lines[lines.length - 1] : null,
        lines: lines.length,
        paceEma: fresh[0] ? Number(fresh[0].ema) : null,
        wall: now,
      };
    });

    const a = await sample();
    await page.waitForTimeout(10000);
    const b = await sample();
    const verdict = await runP;

    expect(verdict.ok).toBe(true);
    expect(a.last).toBeTruthy();
    expect(b.last).toBeTruthy();

    const wallMs = b.wall - a.wall;
    const guestMs = b.last[1] - a.last[1];
    const iters = b.last[0] - a.last[0];
    const realtime = guestMs > 0 && wallMs > 0 ? guestMs / wallMs : NaN;
    const loopsPerGuestSec = guestMs > 0 ? (iters * 1000) / guestMs : NaN;
    const loopsPerWallSec = wallMs > 0 ? (iters * 1000) / wallMs : NaN;
    const delayWallMs = marks.D0 && marks.D1 ? marks.D1 - marks.D0 : NaN;
    const delayRatio = Number.isFinite(delayWallMs) ? 2000 / delayWallMs : NaN;

    console.log('ESP32SPEED tickMHz:', process.env.ESP32_TICK_MHZ || 'native');
    console.log('ESP32SPEED delay: guest-ms 2000 in wall-ms', delayWallMs,
      'guest/wall:', Number.isFinite(delayRatio) ? delayRatio.toFixed(3) : 'n/a');
    console.log('ESP32SPEED compute: guest/wall:', Number.isFinite(realtime) ? realtime.toFixed(3) : 'n/a',
      'loops/guest-s:', Math.round(loopsPerGuestSec),
      'loops/wall-s:', Math.round(loopsPerWallSec),
      'guest-ms:', guestMs, 'iters:', iters, 'samples:', b.lines);
    console.log('ESP32SPEED pace pill:', b.paceEma === null ? 'n/a' : b.paceEma.toFixed(3),
      '(sim ms per wall ms, engine sim.nanos)');

    // Both halves are real numbers, not thresholds tuned to one machine.
    // At a preset the guest clock is target MHz, so the same host throughput
    // reports `div` times more guest time per wall second and `div` times
    // fewer loops per guest second. Bracket against that rather than the
    // native constants. delay() is tick-based and the idle loop fast-forwards
    // straight to the next alarm, so its wall time is mostly host cost, not
    // guest time: the bound only says the wait was not skipped (160 MHz
    // ~330 ms, 8 MHz ~1 s after the MessageChannel yield fix).
    const minDelay = 50;
    expect(Number.isFinite(delayWallMs)).toBe(true);
    expect(delayWallMs).toBeGreaterThan(minDelay);      // the delay is not skipped
    expect(delayWallMs).toBeLessThan(60000);            // and not 20x slow either
    expect(Number.isFinite(realtime)).toBe(true);
    expect(realtime).toBeGreaterThan(0.01);             // compute-bound code progresses
    expect(loopsPerGuestSec).toBeGreaterThan(1000000 / div); // core throughput is real
    expect(iters).toBeGreaterThan(0);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });
});
