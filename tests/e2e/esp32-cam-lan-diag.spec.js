import { test, expect } from '@playwright/test';
import fs from 'fs';
import { SERVER_CODE, CLIENT_CODE } from './esp32-cam-lan-sketches.js';

// DIAGNOSTIC twin of esp32-cam-lan.spec.js: the SAME scenario and the
// SAME sketches (shared module — no drift), but it
//   * turns the runner's opt-in engine CMD trace ON for both boards
//     (board attr `cmdTrace: '1'` -> esp32-runner.ts logs every engine
//     CMD it issues plus a 1/s liveness heartbeat; the LAST CMD line
//     before a stall names the wedged command),
//   * dumps the FULL (untruncated) serial, the console log (worker +
//     engine messages surface as page console events) and the verdict,
//   * uses its OWN gateway room (netcamcov2d) so it never collides with
//     the real cell's room.
// So a flake can be diagnosed without guessing.
test.describe('ESP32-CAM LAN DIAG', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('diag 2-board TCP echo', async ({ page }) => {
    const logs = [];
    page.on('console', (m) => {
      const t = m.text();
      if (t && !/Download the React DevTools|WebSocket connection to|Failed to load resource/i.test(t)) {
        logs.push(`[${m.type()}] ${t}`);
      }
    });
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) logs.push(`[nav] ${f.url()}`); });
    page.on('crash', () => logs.push('[crash] page crashed'));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e?.message || e).slice(0, 200)}`));
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('NETWORK_ROOM_CODE', 'netcamcov2d');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => !!window.OpenHWE2E, null, { timeout: 30000 });
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'cam_srv', type: 'openhw-esp32-cam', attrs: { macAddress: '24:6F:28:00:00:21', cmdTrace: '1' }, x: 100, y: 100 },
        { id: 'cam_cli', type: 'openhw-esp32-cam', attrs: { macAddress: '24:6F:28:00:00:22', cmdTrace: '1' }, x: 500, y: 100 },
      ],
      wires: [],
      code,
    }), SERVER_CODE);
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((code) => window.OpenHWE2E.setupCircuitBoards({
      extra: { cam_cli: code },
    }), CLIENT_CODE);
    expect(setup2.ok).toBe(true);
    let verdict = null;
    try {
      verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 180000, serialNeedle: 'CCLI-LAN-DONE', telemetryMode: 'detail',
      }));
    } catch (err) {
      console.log('DIAG run() threw: ' + String(err?.message || err));
    }
    console.log('DIAG console:\n' + logs.slice(-150).join('\n'));
    try { fs.writeFileSync('/tmp/opencode/esp32-cam-lan-diag-console.log', logs.join('\n')); } catch { /* ignore */ }
    if (!verdict) {
      throw new Error('DIAG: run() failed; see console dump above');
    }
    console.log('DIAG verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines, 'wall:', verdict.wallMs);
    console.log('DIAG serial(len=' + String(verdict.serial || '').length + '):\n' + (verdict.serial || ''));
    try { fs.writeFileSync('/tmp/opencode/esp32-cam-lan-diag-serial.log', (verdict.serial || '')); } catch { /* ignore */ }
    await page.evaluate(() => window.OpenHWE2E.stop()).catch(() => {});
    await page.waitForTimeout(2000);
  });
});
