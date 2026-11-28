import { test, expect } from '@playwright/test';

// A/B: the SAME Arduino merged-bin sketch on two classic ESP32 engines.
//   openhw-esp32sc → esp32sim (direct WASM ABI, esp32sc-runner.ts)
//   openhw-esp32   → esp32-emu (existing esp32-runner.ts, unchanged)
// Both cells assert the real guest needle reaches the host serial console,
// and log wall time to that needle plus a guest/wall ratio computed from the
// guest's own millis() samples (not from runner-internal counters).
//
// Host-component truth here is the app's serial monitor: it is the receiving
// component for the guest TX bytes and its text is what a user sees. GPIO /
// I2C / SPI host cells are NOT weakened — they are skipped below with the
// exact engine fact that blocks them (esp32sim bridge refuses classic ESP32).

const CODE = [
  'volatile unsigned long abTotal = 0;',
  'void setup() {',
  '  Serial.begin(115200);',
  '  Serial.println("AB_NEEDLE");',
  '}',
  'void loop() {',
  '  abTotal = abTotal + 1;',
  '  Serial.print("ABT ");',
  '  Serial.print(millis());',
  '  Serial.print(" ");',
  '  Serial.println(abTotal);',
  '  delay(150);',
  '}',
].join('\n');

const BOARDS = [
  { type: 'openhw-esp32sc', engine: 'esp32sim' },
  { type: 'openhw-esp32', engine: 'esp32-emu' },
];

async function bootAndMeasure(page, board) {
  const setup = await page.evaluate(({ code, type }) => window.OpenHWE2E.setupCircuit({
    components: [{ id: 'board1', type, attrs: {}, x: 100, y: 100 }],
    wires: [],
    code,
  }), { code: CODE, type: board.type });
  expect(setup.ok).toBe(true);

  // Start the run, then poll the host serial console independently. The
  // e2e run() helper has fixed sleeps inside it, so its own wallMs is NOT
  // the time-to-needle we want for the A/B.
  const t0 = Date.now();
  const runP = page.evaluate(() => window.OpenHWE2E.run({
    forMs: 12000, serialNeedle: 'AB_NEEDLE', telemetryMode: 'detail',
  }));
  let needleAt = null;
  const deadline = t0 + 90000;
  while (needleAt === null && Date.now() < deadline) {
    const text = await page.evaluate(() => String(window.OpenHWE2E.snapshot()?.serialText || ''));
    if (text.includes('AB_NEEDLE')) needleAt = Date.now();
    else await page.waitForTimeout(50);
  }

  // Sample guest millis() against wall time while the guest is looping.
  const sample = () => page.evaluate(() => {
    const sn = window.OpenHWE2E.snapshot() || {};
    const rows = String(sn.serialText || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('ABT '))
      .map((l) => l.slice(4).split(/\s+/).map(Number))
      .filter((v) => v.length === 2 && v.every((x) => Number.isFinite(x)));
    return { last: rows.length ? rows[rows.length - 1] : null, lines: rows.length, wall: Date.now() };
  });
  let a = await sample();
  const sampleDeadline = Date.now() + 30000;
  while ((!a.last || a.lines < 2) && Date.now() < sampleDeadline) {
    await page.waitForTimeout(200);
    a = await sample();
  }
  await page.waitForTimeout(6000);
  const b = await sample();
  const verdict = await runP;

  const wallToNeedleMs = needleAt === null ? null : needleAt - t0;
  const windowWallMs = b.wall - a.wall;
  const guestMs = a.last && b.last ? b.last[0] - a.last[0] : null;
  const ratio = guestMs !== null && windowWallMs > 0 ? guestMs / windowWallMs : null;
  const evidence = String(verdict?.serial || '').split(/\r?\n/).filter((l) => l.includes('ABT ')).slice(-2).join(' | ');

  console.log(`AB_BOARD type=${board.type} engine=${board.engine} ` +
    `wallToNeedleMs=${wallToNeedleMs} guestWindowMs=${guestMs} wallWindowMs=${windowWallMs} ` +
    `guestPerWall=${ratio === null ? 'n/a' : ratio.toFixed(3)} samples=${b.lines} serial="${evidence}"`);

  expect(verdict.ok).toBe(true);
  expect(verdict.pass).toBe(true);
  expect(verdict.reasons || []).toEqual([]);
  expect(verdict.serial || '').toContain('AB_NEEDLE');
  expect(verdict.serial || '').toMatch(/ABT \d+ \d+/);
  expect(wallToNeedleMs).not.toBeNull();
  expect(Number.isFinite(ratio)).toBe(true);
  expect(ratio).toBeGreaterThan(0);

  await page.evaluate(() => window.OpenHWE2E.stop());
  await page.waitForTimeout(1200);
  return { wallToNeedleMs, ratio, serial: verdict.serial };
}

test.describe('ESP32 A/B — esp32sim classic vs esp32-emu', () => {
  test.setTimeout(240000);
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

  test('catalog + family resolution: esp32sc → esp32sim runner, esp32 unchanged', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const br = await import('/src/worker/boards-registry.ts');
      const cr = await import('/src/pages/simulationpage/utils/componentRegistry.js');
      await cr.ensureEmulatorRegistry();
      const sc = br.matchBoardFamily('openhw-esp32sc');
      const old = br.matchBoardFamily('openhw-esp32');
      return {
        catalogHasSc: !!cr.COMPONENT_REGISTRY['openhw-esp32sc'],
        catalogHasOld: !!cr.COMPONENT_REGISTRY['openhw-esp32'],
        sc: { family: sc.family, engine: sc.engine, runner: sc.runner, railVoltage: sc.railVoltage },
        old: { family: old.family, engine: old.engine, runner: old.runner },
      };
    });
    console.log('AB_CATALOG', JSON.stringify(r));
    expect(r.catalogHasSc).toBe(true);
    expect(r.catalogHasOld).toBe(true);
    expect(r.sc).toEqual({
      family: 'esp32sc', engine: 'esp32sim',
      runner: 'runners/esp32sc-runner.ts', railVoltage: 3.3,
    });
    expect(r.old.family).toBe('esp32');
    expect(r.old.engine).toBe('esp32-emu');
    expect(r.old.runner).toBe('runners/esp32-runner.ts');
  });

  for (const board of BOARDS) {
    test(`${board.type} boots same sketch and drives the host serial component`, async ({ page }) => {
      const result = await bootAndMeasure(page, board);
      // Keep the numbers in the test result, not only in stdout.
      test.info().annotations.push({
        type: 'ab-speed',
        description: `${board.type}: needle ${result.wallToNeedleMs}ms, guest/wall ${result.ratio.toFixed(3)}`,
      });
    });
  }

  // Honest gap cells. Do NOT weaken them into a serial-only assertion.
  test.skip('openhw-esp32sc lights a GPIO-wired LED', async () => {
    // BLOCKER (verified against the staged WASM, md5 5daf387d...):
    // esp32sim_new_bridge("esp32", ...) returns 0 with
    // "[emu] the host bridge supports only S3, C3 and C6 boards".
    // Without the bridge there is no esp32sim_bridge_gpio_take / gpio_get
    // export on a classic machine, so runner.sampleGpioOut() must return
    // null and an LED net cannot observe a firmware-driven HIGH.
  });

  test.skip('openhw-esp32sc answers an I2C EEPROM / SPI MAX7219', async () => {
    // Same blocker: esp32sim_bridge_i2c_set/take and _spi_set/take are
    // installed only by esp32sim_new_bridge, which refuses classic ESP32.
    // No host device can be attached, so these component cells are skipped.
  });
});
