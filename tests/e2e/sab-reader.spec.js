import { test, expect } from '@playwright/test';

// SAB reader verification (§12.5 step 3):
// 1. Simulator page loads with zero console errors (regression gate for the
//    SimulatorPage.jsx rAF-loop edit + sabReader.js import).
// 2. SAB plumbing is live: crossOriginIsolated, SharedArrayBuffer,
//    __sabPollStats object published by the reader loop.
// 3. sabReader unit contract runs IN the browser: synthetic v1 SAB →
//    pollSabFrames decodes slots, applySabFrames mirrors into live-OOP shape,
//    bad buffer returns null (fallback contract).
test.describe('SAB reader (useSabReader)', () => {
  test.setTimeout(120000);

  test('simulator loads clean and publishes SAB reader hooks', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const probe = await page.evaluate(() => ({
      crossOriginIsolated: window.crossOriginIsolated,
      hasSAB: typeof SharedArrayBuffer !== 'undefined',
      hasReaderLoadedKey: '__sabReaderLoaded' in window,
      readerLoaded: window.__sabReaderLoaded || false,
      hasPollStatsKey: '__sabPollStats' in window,
      pollStats: window.__sabPollStats || null,
    }));
    console.log('SAB probe:', JSON.stringify(probe));

    expect(probe.hasSAB).toBe(true);
    expect(probe.crossOriginIsolated).toBe(true);
    // Reader loop publishes stats key even before any run (zero polls).
    expect(probe.hasPollStatsKey).toBe(true);
    expect(probe.readerLoaded).toBe(true);
    expect(probe.pollStats).not.toBeNull();

    const sabErrors = errors.filter((e) => /sab|Sab|SAB|SharedArrayBuffer/i.test(e));
    expect(sabErrors).toEqual([]);
  });

  test('sabReader decodes a synthetic v1 SAB in-browser', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    const result = await page.evaluate(async () => {
      const m = await import('/src/pages/simulationpage/utils/sabReader.js');
      const HEADER = 64, STRIDE = 64, TELE = 1024 * 32, N = 2;
      const size = Math.max(4096, Math.ceil((HEADER + N * STRIDE + TELE) / 4096) * 4096);
      const sab = new SharedArrayBuffer(size);
      const u32 = new Uint32Array(sab);
      new Float64Array(sab);
      u32[0] = 0x4f485753; u32[1] = 1; u32[2] = 0; u32[3] = N;
      u32[6] = 0; u32[7] = 1;
      u32[10] = HEADER; u32[11] = N * STRIDE;
      u32[12] = HEADER + N * STRIDE; u32[13] = TELE;
      const writeSlot = (slot, version, kind, f, i) => {
        const base = HEADER + slot * STRIDE;
        u32[(base + 0) >>> 2] = version; u32[(base + 4) >>> 2] = 1;
        new Uint16Array(sab, base + 8, 2).set([kind, 0]);
        new Float32Array(sab, base + 12, 8).set(f);
        new Int32Array(sab, base + 44, 4).set(i);
      };
      writeSlot(0, 7, 1, [200, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0]);
      u32[2] = 1;
      const cursor = m.createSabCursor();
      const frames = m.pollSabFrames(sab, { led1: 0, servo1: 1 }, cursor);
      const mirror = { current: {} };
      const changed = m.applySabFrames(frames, mirror, { current: {} });
      const repoll = m.pollSabFrames(sab, { led1: 0 }, cursor);
      const bad = m.pollSabFrames(new ArrayBuffer(64), { x: 0 }, m.createSabCursor());
      return {
        frames, changed,
        led: mirror.current.led1,
        repollEmpty: Array.isArray(repoll) && repoll.length === 0,
        badIsNull: bad === null,
        diag: m.getSabDiag(sab),
      };
    });

    expect(result.frames).toHaveLength(1);
    expect(result.frames[0].id).toBe('led1');
    expect(result.frames[0].state.brightness).toBe(200);
    expect(result.frames[0].state.illuminated).toBe(true);
    expect(result.changed).toEqual(['led1']);
    expect(result.led.brightness).toBe(200);
    expect(result.repollEmpty).toBe(true);
    expect(result.badIsNull).toBe(true);
    expect(result.diag.magic).toBe(0x4f485753);
    expect(result.diag.version).toBe(1);
    expect(result.diag.frameSeq).toBe(1);
  });
});
