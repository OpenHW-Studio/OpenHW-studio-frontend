import { test, expect } from '@playwright/test';

// Pico watchdog countdown proof (runner-side poll in pico-runner.ts:
// pollPicoWDT — pico-emu models the WDT registers + TRIGGER reboot but runs
// no timeout countdown, so this runner owns the countdown via
// _picoemu_mem_read32 and resets the core on expiry).
// Cell 1+2: unfed wdt_begin(200) reboots on both dies (RP2040 XFACTOR 2,
// RP2350 XFACTOR 1 paths). Cell 3: wdt_begin(2000) boot COUNT proves the
// countdown honors the LOAD period instead of a fixed delay (a fixed 200ms
// reset would print ~60 boots in the same window, not ~6).
// Fed-same-value control intentionally absent: watchdog_update() rewrites
// the identical LOAD, which no runner-ABI read can observe (needs an engine
// write-trap / engine-side countdown) — see the field note in pico-runner.ts.

async function runCell(page, board, type, { code, needle, forMs = 25000 }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('openhw-tour-completed', 'true');
  });
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const setup = await page.evaluate(([b, bt, cd]) => window.OpenHWE2E.setupCircuit({
    components: [{ id: b, type: bt, attrs: {}, x: 100, y: 100 }],
    wires: [],
    code: cd,
  }), [board, type, code]);
  expect(setup.ok).toBe(true);
  const verdict = await page.evaluate((o) => window.OpenHWE2E.run(o), {
    forMs, serialNeedle: needle, telemetryMode: 'detail',
  });
  expect(verdict.ok).toBe(true);
  console.log(`${needle} verdict:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
  console.log(`${needle} serial tail:`, JSON.stringify((verdict.serial || '').slice(-300)));
  expect(verdict.pass).toBe(true);
  return verdict;
}

test.describe('Pico watchdog countdown (runner poll)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Pico RP2040 unfed WDT reboots (200ms)', async ({ page }) => {
    const verdict = await runCell(page, 'pico1', 'openhw-pico', {
      code: 'void setup(){Serial.begin(9600);Serial.println("PICO_WDT2_BOOT");rp2040.wdt_begin(200);Serial.println("PICO_WDT2_ARMED");}\nvoid loop(){Serial.println("PICO_WDT2_SPIN");delay(100);}\n',
      needle: 'PICO_WDT2_BOOT',
    });
    const boots = (verdict.serial || '').match(/PICO_WDT2_BOOT/g) || [];
    console.log('PICO_WDT2 boots:', boots.length);
    expect(boots.length).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico 2 M33 unfed WDT reboots (200ms)', async ({ page }) => {
    const verdict = await runCell(page, 'pico2', 'openhw-pico-2', {
      code: 'void setup(){Serial.begin(9600);Serial.println("PICO2_WDT2_BOOT");rp2040.wdt_begin(200);Serial.println("PICO2_WDT2_ARMED");}\nvoid loop(){Serial.println("PICO2_WDT2_SPIN");delay(100);}\n',
      needle: 'PICO2_WDT2_BOOT',
    });
    const boots = (verdict.serial || '').match(/PICO2_WDT2_BOOT/g) || [];
    console.log('PICO2_WDT2 boots:', boots.length);
    expect(boots.length).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico RP2040 WDT honors LOAD period (2000ms -> ~6 boots / 13s)', async ({ page }) => {
    const verdict = await runCell(page, 'pico1', 'openhw-pico', {
      code: 'void setup(){Serial.begin(9600);Serial.println("PICO_WDT2B_BOOT");rp2040.wdt_begin(2000);}\nvoid loop(){delay(100);}\n',
      needle: 'PICO_WDT2B_BOOT', forMs: 13000,
    });
    const boots = (verdict.serial || '').match(/PICO_WDT2B_BOOT/g) || [];
    console.log('PICO_WDT2B boots:', boots.length);
    expect(boots.length).toBeGreaterThanOrEqual(3);
    expect(boots.length).toBeLessThanOrEqual(9);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
