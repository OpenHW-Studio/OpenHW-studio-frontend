import { test, expect } from '@playwright/test';

// Pico USB-DEV cell (RP2040 M0+ and RP2350 M33).
//
// WHAT THIS PROVES: arduino-pico's `Serial` is the USB CDC DEVICE (not a
// UART). pico-emu models a USB HOST that enumerates the guest's CDC
// device (src/usb.c: bus reset → GET_DESCRIPTOR → SET_ADDRESS → config
// descriptor → SET_CONFIGURATION → CDC SET_LINE_CODING / SET_CONTROL_LINE_STATE
// → ACTIVE) and bridges CDC bulk IN to the browser serial monitor.
//
// Board attr `usbCdc:'1'` keeps `Serial` on the real CDC (the frontend's
// Pico Serial->Serial1 rewrite is skipped in that mode —
// src/pages/simulationpage/utils/genericBoardCompile.js), and the runner
// routes host-injected bytes into the CDC OUT endpoint
// (`_picoemu_write_usb`, src/worker/runners/pico-runner.ts).
//
// The cell is a full CDC LOOPBACK: host types "P" → CDC OUT → guest reads
// it → guest writes "USBCDC_ECHO:P" → CDC IN → serial monitor. Plus the
// enumeration state is read from the engine (`_picoemu_usb_state32`) and
// published to the `openhw-usb-device` sink, so the proof is not just
// "some bytes showed up" but "the CDC enumerated".
const CODE = 'void setup(){Serial.begin(115200);}\nvoid loop(){if(Serial.available()){int c=Serial.read();Serial.print("USBCDC_ECHO:");Serial.print((char)c);Serial.println();}delay(20);}\n';

async function runUsbCell(page, { boardType, boardId, comps = [], wires = [], forMs = 45000 }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('openhw-tour-completed', 'true');
  });
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const setup = await page.evaluate(([bt, c, w, cd]) => window.OpenHWE2E.setupCircuit({
    components: [{ id: 'usbhost', type: bt, attrs: { usbCdc: '1' }, x: 100, y: 100 }, ...c],
    wires: w,
    code: cd,
  }), [boardType, comps, wires, CODE]);
  expect(setup.ok).toBe(true);
  // Start the run (do NOT await yet): the host must type into the guest
  // while the sim is live.
  const runPromise = page.evaluate((ms) => window.OpenHWE2E.run({
    forMs: ms, serialNeedle: 'USBCDC_ECHO:', telemetryMode: 'detail',
  }), forMs);
  // Wait for the CDC to enumerate (the engine's host-sim runs the control
  // transfers), then type into the CDC OUT endpoint.
  await page.waitForTimeout(12000);
  const injected = [];
  for (let i = 0; i < 6; i++) {
    const r = await page.evaluate(([t, b]) => window.OpenHWE2E.serialInput(t, b), ['P', boardId]);
    injected.push(r);
    await page.waitForTimeout(1500);
  }
  const verdict = await runPromise;
  console.log('USB injected:', JSON.stringify(injected));
  console.log('USB verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
  console.log('USB serial:', JSON.stringify((verdict.serial || '').slice(0, 400)));
  console.log('USB liveOop:', JSON.stringify(verdict.liveOop || {}).slice(0, 600));
  return verdict;
}

test.describe('Pico USB device (CDC)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Pico (M0+) USB CDC enumerates and echoes a host byte', async ({ page }) => {
    const verdict = await runUsbCell(page, {
      boardType: 'openhw-pico', boardId: 'usbhost',
      comps: [{ id: 'usbdev', type: 'openhw-usb-device', attrs: {}, x: 450, y: 120 }],
      wires: [],
    });
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('USBCDC_ECHO:P');
    const dev = (verdict.liveOop || {}).usbdev;
    console.log('PICO-USB sink:', JSON.stringify(dev || {}).slice(0, 400));
    expect(String((dev || {}).enumState || '')).toBe('active');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico 2 (M33) USB CDC enumerates and echoes a host byte', async ({ page }) => {
    const verdict = await runUsbCell(page, {
      boardType: 'openhw-pico-2', boardId: 'usbhost',
      comps: [{ id: 'usbdev', type: 'openhw-usb-device', attrs: {}, x: 450, y: 120 }],
      wires: [],
    });
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('USBCDC_ECHO:P');
    const dev = (verdict.liveOop || {}).usbdev;
    console.log('PICO2-USB sink:', JSON.stringify(dev || {}).slice(0, 400));
    expect(String((dev || {}).enumState || '')).toBe('active');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
