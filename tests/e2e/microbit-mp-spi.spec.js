import { test, expect } from '@playwright/test';

// MicroPython driving a host-attached SPI component (MAX7219) from main.py.
//
// The high-level `microbit.spi.write()` path is BLOCKED in this engine image:
// headless probe with the byte-matched engine stages no SPIM take/event,
// spins at PC 0x539e6 (a WFE loop) after `spi.init()` and never emits bytes.
// This cell therefore drives the same wire protocol from Python via GPIO
// bit-bang (DIN/CLK/CS), sleeping 1 ms per edge so the runner's GPIO pump
// publishes each transition to the host MAX7219 model. Guest truth is the
// bare marker; host truth is the MAX7219 matrix/register telemetry.
const MP_MAIN = `
from microbit import pin13, pin14, pin15, sleep
pin13.write_digital(0)
pin14.write_digital(0)
pin15.write_digital(1)
def clk():
    pin13.write_digital(1)
    sleep(1)
    pin13.write_digital(0)
    sleep(1)
def byte(b):
    for i in range(7, -1, -1):
        pin14.write_digital((b >> i) & 1)
        sleep(1)
        clk()
def wr(r, d):
    pin15.write_digital(0)
    sleep(1)
    byte(r)
    byte(d)
    pin15.write_digital(1)
    sleep(1)
wr(0x0c, 1)
wr(0x09, 0)
wr(0x0b, 7)
wr(0x0a, 8)
wr(0x0f, 0)
wr(0x01, 0x7e)
wr(0x02, 0x30)
print("MP_SPI_BITBANG_DRAWN")
`.trim() + '\n';

test.describe('micro:bit v2 MicroPython SPI component (MAX7219 bit-bang)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('guest script sets MAX7219 digits through GPIO edges', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript(() => window.localStorage.setItem('openhw-tour-completed', 'true'));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });

    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'mb1', type: 'openhw-microbit-v2', attrs: { env: 'micropython' }, x: 100, y: 100 },
        { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'mb1:P14', to: 'mx1:DIN' },
        { from: 'mb1:P13', to: 'mx1:CLK' },
        { from: 'mb1:P15', to: 'mx1:CS' },
        { from: 'mb1:3V3', to: 'mx1:VCC' },
        { from: 'mb1:GND', to: 'mx1:GND' },
      ],
      code: '// main.py installed below',
    }));
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((mp) => window.OpenHWE2E.setupCircuitBoards({
      extra: { mb1: mp },
    }), MP_MAIN);
    expect(setup2.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, selectTelemetry: ['mx1'], serialNeedle: 'MP_SPI_BITBANG_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MP-SPI reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('MP-SPI serial tail:', JSON.stringify((verdict.serial || '').slice(-900)));
    expect(verdict.pass).toBe(true);
    expect(verdict.reasons || []).toEqual([]);
    expect(verdict.serial || '').toContain('MP_SPI_BITBANG_DRAWN');

    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    console.log('MP-SPI MAX7219 telemetry:', JSON.stringify(mx || null).slice(0, 700));
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    console.log('MP-SPI MAX7219 custom:', JSON.stringify(custom).slice(0, 350));
    expect(custom.shutdown).toBe(false);
    expect(custom.csActive).toBe(false);
    expect(custom.matrix?.[0]).toBe(0x7e);
    expect(custom.matrix?.[1]).toBe(0x30);
    expect(errors).toEqual([]);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
