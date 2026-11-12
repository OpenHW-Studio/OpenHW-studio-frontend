import { test, expect } from '@playwright/test';

// F4 USB OTG_FS device (407VE): same-silicon port of the Disco cell — the
// engine's usb_cdc_test firmware (CDC-ACM echo FIXEDBIN) runs unmodified
// (stm32f407ve shares the F407 die/IDCODE/SVD; only flash size differs)
// against the same runner-hosted enumeration + bulk-echo machine. No
// runner changes. 429/401/401 need per-chip .bin assets (STAGED, not
// written here): their clock init differs, so the F407 binary is not
// assumed to boot there.
// CODE is a placeholder sketch: FIXEDBIN wins before Arduino compile.
const CODE = 'void setup() {}\nvoid loop() {}\n';

test.describe('F4 USB on 407VE (OTG_FS CDC echo, same-silicon port)', () => {
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
        { id: 'f47e', type: 'openhw-stm32f407ve', attrs: { firmware: '/firmware/f4/usb_cdc_test.bin' }, x: 100, y: 100 },
        { id: 'usb1', type: 'openhw-usb-device', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'f47e:5V', to: 'usb1:VCC' },
        { from: 'f47e:GND.1', to: 'usb1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, selectTelemetry: ['usb1'], serialNeedle: 'USB done', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('VEUSB reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('VEUSB serial head:', (verdict.serial || '').slice(0, 500));
    console.log('VEUSB liveOop:', JSON.stringify(verdict.liveOop && verdict.liveOop.usb1));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('USB enum done');
    expect(verdict.serial || '').toContain('USB echo OK');
    expect(verdict.serial || '').toContain('USB_ECHO:PASS');
    const sink = (verdict.liveOop || {}).usb1;
    expect(sink).toBeTruthy();
    expect(String(sink.enumState)).toBe('enumerated');
    expect(Number(sink.rxCount)).toBeGreaterThanOrEqual(16);
    expect(String(sink.lastEcho || '')).toContain('World!!!');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
