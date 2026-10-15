import { test, expect } from '@playwright/test';

// UI-load probe: dual boards + heavy components must not slow the main
// thread. Measures rAF frame rate + worst frame gap during a live run and
// asserts the UI stays interactive (serial/telemetry verdict must pass
// alongside — the sim stays alive while the UI stays smooth).
test.describe('ui load (dual heavy boards)', () => {
  test.setTimeout(180000);
  test('main thread holds frame budget under dual-OLED load', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 100 },
        { id: 'uno2', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 300 },
        { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
        { id: 'oled2', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 300 },
      ],
      wires: [
        { from: 'uno1:A4', to: 'oled1:SDA' },
        { from: 'uno1:A5', to: 'oled1:SCL' },
        { from: 'uno1:5V', to: 'oled1:VCC' },
        { from: 'uno1:gnd_1', to: 'oled1:GND' },
        { from: 'uno2:A4', to: 'oled2:SDA' },
        { from: 'uno2:A5', to: 'oled2:SCL' },
        { from: 'uno2:5V', to: 'oled2:VCC' },
        { from: 'uno2:gnd_1', to: 'oled2:GND' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("UNO1_READY");}\nvoid loop(){Serial.println("UNO1_TICK");delay(200);}\n',
    }));
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate(() => window.OpenHWE2E.setupCircuitBoards({
      extra: {
        uno2: '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d2(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("UNO2_READY");d2.begin(SSD1306_SWITCHCAPVCC,0x3C);}\nvoid loop(){d2.clearDisplay();d2.setTextSize(2);d2.setTextColor(SSD1306_WHITE);d2.setCursor(0,0);d2.println(millis());d2.display();Serial.println("UNO2_TICK");delay(200);}\n',
      },
    }));
    expect(setup2.ok).toBe(true);
    // Start the run WITHOUT awaiting the verdict: measure UI frames while
    // both boards redraw OLEDs + chatter serial at 5 lines/s each.
    const runPromise = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['oled2'], serialNeedle: 'UNO1_READY', telemetryMode: 'detail',
    }));
    await page.waitForTimeout(3000); // let the run reach steady state
    const frames = await page.evaluate(() => new Promise((resolve) => {
      const gaps = [];
      let count = 0;
      let last = performance.now();
      const t0 = last;
      // Warmup: the first ~3s contain compile-finish + START burst + first
      // hydration — one-off startup cost, not sustained load. Steady-state
      // accounting starts after it; fps counts all frames (conservative).
      const WARMUP_MS = 3000;
      const steadyGaps = [];
      const longtasks = [];
      let obs = null;
      try {
        obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.startTime - t0 >= WARMUP_MS) longtasks.push(Math.round(e.duration));
          }
        });
        obs.observe({ entryTypes: ['longtask'] });
      } catch { obs = null; }
      const tick = (t) => {
        count++;
        const gap = t - last;
        gaps.push(gap);
        if (t - t0 >= WARMUP_MS) steadyGaps.push(gap);
        last = t;
        if (t - t0 < 10000) requestAnimationFrame(tick);
        else {
          try { obs && obs.disconnect(); } catch { /* ignore */ }
          gaps.sort((a, b) => a - b);
          steadyGaps.sort((a, b) => a - b);
          resolve({
            frames: count,
            fps: Math.round(count / 10),
            p50: Math.round(gaps[Math.floor(gaps.length * 0.5)]),
            p95: Math.round(gaps[Math.floor(gaps.length * 0.95)]),
            maxGap: Math.round(gaps[gaps.length - 1]),
            steadyMaxGap: steadyGaps.length ? Math.round(steadyGaps[steadyGaps.length - 1]) : 0,
            longtasks: longtasks.slice(0, 10),
            longtaskCount: longtasks.length,
          });
        }
      };
      requestAnimationFrame(tick);
    }));
    console.log('UI frames:', JSON.stringify(frames));
    const verdict = await runPromise;
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // The guarantee: UI holds a usable frame rate with no multi-second
    // stalls while two boards redraw + chatter. Headless rAF still ticks
    // at display rate; a main-thread firehose would collapse fps and show
    // up as second-long gaps + longtasks.
    expect(frames.fps).toBeGreaterThanOrEqual(25);
    expect(frames.maxGap).toBeLessThan(1000);
    // Steady-state only (post-warmup): sustained load must not stall.
    // fps + stall ceiling are the binding guarantees (45–47fps / 83ms
    // worst observed across runs — large margins, and STABLE run to run).
    // longtask COUNT is deliberately not asserted: it varies 7→12 across
    // identical runs (headless compositor + sim Workers share CPU; GC
    // timing noise), so any fixed count is calibrating noise, not load.
    // The array stays logged for forensics.
    expect(frames.steadyMaxGap).toBeLessThan(500);
    console.log('UI steady longtasks:', JSON.stringify(frames.longtasks));
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
