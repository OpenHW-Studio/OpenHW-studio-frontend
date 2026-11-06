import { test, expect } from '@playwright/test';

// F4 USB OTG_FS device (Disco F407): the engine's own usb_cdc_test firmware
// (CDC-ACM echo, loaded FIXEDBIN via the board `firmware` attr — no Arduino
// core can carry a USB device stack) enumerates against the RUNNER playing
// USB host (bus reset, GET_DESCRIPTOR device/config/string, STALL handshake
// probe, SET_ADDRESS, SET_CONFIGURATION, CDC line coding, 2x bulk echo on
// EP1 — the engine-side test_usb.mjs sequence, driven incrementally). The
// runner reports link state + echo bytes to the openhw-usb-device sink;
// human-senses proof is the liveOop mirror (enumState/rxCount/lastEcho),
// plus the guest's own markers over USART1.
// CODE is a placeholder sketch: FIXEDBIN wins before Arduino compile.
const CODE = 'void setup() {}\nvoid loop() {}\n';

test.describe('F4 USB (OTG_FS CDC echo, runner-hosted)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('enumeration + CDC bulk echo round-trip', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'f41', type: 'openhw-stm32f4', attrs: { firmware: '/firmware/f4/usb_cdc_test.bin' }, x: 100, y: 100 },
        { id: 'usb1', type: 'openhw-usb-device', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f41:5V', to: 'usb1:VCC' },
        { from: 'f41:GND.1', to: 'usb1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, selectTelemetry: ['usb1'], serialNeedle: 'USB done', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('USB reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('USB serial head:', (verdict.serial || '').slice(0, 500));
    console.log('USB liveOop:', JSON.stringify(verdict.liveOop && verdict.liveOop.usb1));
    expect(verdict.pass).toBe(true);
    // Guest-side proof: full stack walked (descriptors, address, config).
    expect(verdict.serial || '').toContain('USB enum done');
    expect(verdict.serial || '').toContain('USB echo OK');
    // Runner-side proof: host observed the echo bytes on the wire.
    expect(verdict.serial || '').toContain('USB_ECHO:PASS');
    // Human-senses proof: sink state (enumerated, 16 echo bytes over 2 rounds).
    const sink = (verdict.liveOop || {}).usb1;
    expect(sink).toBeTruthy();
    expect(String(sink.enumState)).toBe('enumerated');
    expect(Number(sink.rxCount)).toBeGreaterThanOrEqual(16);
    expect(String(sink.lastEcho || '')).toContain('World!!!');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
