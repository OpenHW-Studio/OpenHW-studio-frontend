import { test, expect } from '@playwright/test';

// ESP32 DevKit GPIO-in, SWITCH variant: the static cell wires fixed rails
// (3V3 -> GPIO13, GND -> GPIO14). This cell closes the other half of the
// matrix gap ("no switch->digitalRead cell"): a slide-switch wiper drives
// GPIO13 and the component is FLIPPED MID-RUN (DOM click), so the guest
// read must follow the wired level in BOTH directions.
//
// Earlier shape ran two circuits back-to-back on one page; the second
// never produced serial (the harness owns one live run per page load),
// so it asserted nothing about the component. One run + two clicks is
// also what a user actually does.
const CODE = [
  'void setup(){ Serial.begin(115200); Serial.println("GPIOSW_READY"); pinMode(13, INPUT); }',
  'void loop(){ Serial.print("GPIO13="); Serial.println(digitalRead(13)); delay(300); }',
].join('\n');

// Gate on firmware readiness (serial needle) plus React isRunning: before
// that, component UIs keep pointer-events: none and a click lands on the
// canvas, which reads as "the switch does nothing". The slide switch paints
// its SVG inert (visual only) and takes clicks on its wrapping div, so the
// click target is verified through elementFromPoint, not the svg.
async function waitReady(page, needle, timeout = 180000) {
  await page.waitForFunction((n) => {
    const sn = window.OpenHWE2E?.snapshot?.();
    return !!(sn?.running && String(sn.serialText || '').includes(n));
  }, needle, { timeout });
}

test.describe('ESP32 GPIO-in (switch -> digitalRead)', () => {
  test.setTimeout(420000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('guest read follows the switch in both directions', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('pageerror', (err) => console.log('ESP-GPIOSW PAGEERROR:', String(err).slice(0, 300)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:3V3', to: 'sw1:3' },
        { from: 'esp1:GND.1', to: 'sw1:1' },
        { from: 'sw1:2', to: 'esp1:13' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, selectTelemetry: ['sw1'], serialNeedle: 'GPIOSW_READY', telemetryMode: 'detail',
    }));

    // Boot, then flip right -> left -> right while the guest polls.
    await waitReady(page, 'GPIOSW_READY');
    const box = await page.locator('#comp-master-sw1 svg').first().boundingBox({ timeout: 10000 }).catch(() => null);
    console.log('SW box:', JSON.stringify(box));
    expect(box).toBeTruthy();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const over = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return { inside: !!el?.closest?.('#comp-master-sw1'), tag: el?.tagName };
    }, [cx, cy]);
    console.log('SW hit:', JSON.stringify(over));
    expect(over.inside).toBe(true);

    await page.mouse.click(cx, cy);      // -> "0"
    await page.waitForTimeout(8000);
    const midState = await page.evaluate(() => {
      const t = (window.OpenHWTelemetry?.getLatestTelemetry?.() || []).find((x) => x.id === 'sw1');
      return t?.details?.custom?.value ?? t?.details?.state?.value ?? null;
    });
    await page.mouse.click(cx, cy);      // -> "1"
    await page.waitForTimeout(8000);

    const verdict = await runP;
    const serial = String(verdict.serial || '');
    console.log('ESP-GPIOSW mid value:', JSON.stringify(midState));
    console.log('ESP-GPIOSW serial:', JSON.stringify(serial.slice(0, 400)));
    expect(verdict.ok).toBe(true);

    // Both levels must appear, and the low must sit between two highs.
    const tracks = serial.split(/\r?\n/).map((l) => /^GPIO13=(\d)$/.exec(l.trim())?.[1]).filter(Boolean);
    console.log('ESP-GPIOSW tracks:', tracks.join(''));
    const firstLow = tracks.indexOf('0');
    const lastHigh = tracks.lastIndexOf('1');
    expect(firstLow).toBeGreaterThan(0);
    expect(lastHigh).toBeGreaterThan(firstLow);
    expect(tracks[0]).toBe('1');

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });
});
