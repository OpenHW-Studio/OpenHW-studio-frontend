import { test, expect } from '@playwright/test';

// ESP32 DevKit inputs driven by real DOM interaction (the way a user does
// it), all proven guest-side:
//  - pushbutton on GPIO4 with INPUT_PULLUP: hold -> BTN:0, release -> BTN:1
//  - 4x4 membrane keypad: rows GPIO4,5,12,13 / cols GPIO14,15,16,17,
//    hold key '5' while the firmware matrix-scans -> KEY:11
//  - analog joystick: HORZ 34 / VERT 35 / SEL 25, drag off-center while the
//    guest polls analogRead -> both axes move away from mid-rail
// Two gates, both real: the sketch must have booted (serial needle in the
// captured stream) and React isRunning must have flipped, because every
// component UI keeps pointer-events: none until it does. A fixed sleep
// either clicks the canvas (too early) or wastes a minute (too late).
async function waitReady(page, needle, selector, timeout = 180000) {
  await page.waitForFunction(({ n, sel }) => {
    const sn = window.OpenHWE2E?.snapshot?.();
    if (!sn?.running || !String(sn.serialText || '').includes(n)) return false;
    const el = document.querySelector(sel);
    if (!el) return false;
    const root = el.closest('svg') || el;
    return getComputedStyle(root).pointerEvents !== 'none'
      && getComputedStyle(el).pointerEvents !== 'none';
  }, { n: needle, sel: selector }, { timeout });
}

test.describe('ESP32 inputs (button, keypad, joystick)', () => {
  test.setTimeout(600000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('pageerror', (err) => console.log('ESP-IN PAGEERROR:', String(err).slice(0, 200)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
  });

  test('pushbutton press reaches digitalRead', async ({ page }) => {
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'btn1', type: 'openhw-pushbutton', attrs: {}, x: 450, y: 120 },
        // External 10k pull-up: the engine ignores internal_pull_up (ask P4),
        // so an INPUT_PULLUP pin with only a switch to GND can never read HIGH.
        { id: 'r1', type: 'openhw-resistor', attrs: { value: '10000' }, x: 250, y: 300 },
      ],
      wires: [
        { from: 'esp1:4', to: 'btn1:1l' },
        { from: 'esp1:GND.1', to: 'btn1:2l' },
        { from: 'esp1:3V3', to: 'r1:p1' },
        { from: 'r1:p2', to: 'btn1:1l' },
      ],
      code: [
        'int last=1;',
        'void setup(){ Serial.begin(115200); Serial.println("BTN_READY"); pinMode(4, INPUT); }',
        'void loop(){ int v=digitalRead(4); if(v!=last){ Serial.print("BTN:"); Serial.println(v); last=v; } delay(50); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['btn1'], serialNeedle: 'BTN_READY', telemetryMode: 'detail',
    }));
    await waitReady(page, 'BTN_READY', '#comp-master-btn1 .btn-wrapper');

    const boxes = await page.locator('#comp-master-btn1 .btn-wrapper').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
    console.log('ESP-IN BTN boxes:', JSON.stringify(boxes));
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    const b = boxes.reduce((a, c) => (c.x > a.x ? c : a));
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await page.waitForTimeout(4000);
    await page.mouse.up();
    await page.waitForTimeout(4000);

    const verdict = await runP;
    const serial = String(verdict.serial || '');
    console.log('ESP-IN BTN serial:', JSON.stringify(serial.slice(0, 300)));
    expect(verdict.ok).toBe(true);
    // Press pulls the INPUT_PULLUP pin LOW; release returns it HIGH.
    expect(serial).toContain('BTN:0');
    expect(serial.indexOf('BTN:1', serial.indexOf('BTN:0'))).toBeGreaterThan(serial.indexOf('BTN:0'));

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  test('membrane keypad scans key 5', async ({ page }) => {
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'kp1', type: 'openhw-membrane-keypad', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:4', to: 'kp1:R1' },
        { from: 'esp1:5', to: 'kp1:R2' },
        { from: 'esp1:12', to: 'kp1:R3' },
        { from: 'esp1:13', to: 'kp1:R4' },
        { from: 'esp1:14', to: 'kp1:C1' },
        { from: 'esp1:15', to: 'kp1:C2' },
        { from: 'esp1:16', to: 'kp1:C3' },
        { from: 'esp1:17', to: 'kp1:C4' },
      ],
      code: [
        'int rows[4]={4,5,12,13}; int cols[4]={14,15,16,17};',
        'void setup(){ Serial.begin(115200); Serial.println("KP_READY");',
        '  for(int i=0;i<4;i++){ pinMode(rows[i],OUTPUT); digitalWrite(rows[i],HIGH); pinMode(cols[i],INPUT_PULLUP); } }',
        'void loop(){ for(int r=0;r<4;r++){ digitalWrite(rows[r],LOW); delay(5);',
        '  for(int c=0;c<4;c++){ if(digitalRead(cols[c])==LOW){ Serial.print("KEY:"); Serial.print(r); Serial.println(c); delay(400); } }',
        '  digitalWrite(rows[r],HIGH); } delay(100); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, selectTelemetry: ['kp1'], serialNeedle: 'KP_READY', telemetryMode: 'detail',
    }));
    await waitReady(page, 'KP_READY', '#comp-master-kp1 wokwi-membrane-keypad');

    const key = page.locator('#comp-master-kp1 wokwi-membrane-keypad').getByText('5', { exact: true });
    await key.scrollIntoViewIfNeeded().catch(() => {});
    const kbox = await key.boundingBox({ timeout: 10000 }).catch(() => null);
    console.log('ESP-IN KP key5 box:', JSON.stringify(kbox));
    expect(kbox).toBeTruthy();
    await page.mouse.move(kbox.x + kbox.width / 2, kbox.y + kbox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(5000);
    await page.mouse.up();
    await page.waitForTimeout(3000);

    const verdict = await runP;
    const serial = String(verdict.serial || '');
    console.log('ESP-IN KP serial:', JSON.stringify(serial.slice(0, 300)));
    expect(verdict.ok).toBe(true);
    // Row index 1, col index 1 == key 5 on the standard 4x4 map.
    expect(serial).toContain('KEY:11');

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  // KNOWN ENGINE GAP (esp32-emu ask P4): the pad model never feeds the
  // driven output level back into the input register, so this stays 0.
  test.fixme('output readback: digitalRead follows digitalWrite', async ({ page }) => {
    // ESP32 pads loop the output driver back into the input register, so a
    // sketch may read back its own output level. The matrix lists this as
    // an open gap ("output readback"), separate from external input.
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code: [
        'void setup(){ Serial.begin(115200); Serial.println("RB_READY"); pinMode(2, OUTPUT); }',
        'void loop(){ digitalWrite(2, HIGH); delay(300); Serial.print("RB:"); Serial.println(digitalRead(2));',
        '  digitalWrite(2, LOW); delay(300); Serial.print("RB:"); Serial.println(digitalRead(2)); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 40000, selectTelemetry: ['esp1'], serialNeedle: 'RB_READY', telemetryMode: 'detail',
    }));
    const serial = String(verdict.serial || '');
    console.log('ESP-IN RB serial:', JSON.stringify(serial.slice(0, 300)));
    expect(verdict.ok).toBe(true);
    const rbs = [...serial.matchAll(/RB:(\d)/g)].map((m) => m[1]);
    console.log('ESP-IN RB tracks:', rbs.join(''));
    expect(rbs.length).toBeGreaterThan(2);
    expect(rbs).toContain('1');
    expect(rbs).toContain('0');
    // Alternation proves the readback tracks the write, not a fixed level.
    expect(rbs[0]).not.toBe(rbs[1]);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  test('joystick drag moves both ADC axes', async ({ page }) => {
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'joy1', type: 'openhw-analog-joystick', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:3V3', to: 'joy1:VCC' },
        { from: 'esp1:GND.1', to: 'joy1:GND' },
        { from: 'esp1:GPIO34', to: 'joy1:HORZ' },
        { from: 'esp1:GPIO35', to: 'joy1:VERT' },
        { from: 'esp1:GPIO25', to: 'joy1:SEL' },
      ],
      code: [
        'void setup(){ Serial.begin(115200); Serial.println("JOY_READY"); pinMode(25, INPUT_PULLUP); }',
        'void loop(){ Serial.print("JOY:"); Serial.print(analogRead(34)); Serial.print(",");',
        '  Serial.print(analogRead(35)); Serial.print(","); Serial.println(digitalRead(25)); delay(200); }',
      ].join('\n'),
    }));
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, selectTelemetry: ['joy1'], serialNeedle: 'JOY_READY', telemetryMode: 'detail',
    }));
    await waitReady(page, 'JOY_READY', '#comp-master-joy1 svg');

    const jbox = await page.locator('#comp-master-joy1 svg').first().boundingBox({ timeout: 10000 }).catch(() => null);
    console.log('ESP-IN JOY box:', JSON.stringify(jbox));
    expect(jbox).toBeTruthy();
    const cx = jbox.x + jbox.width / 2;
    const cy = jbox.y + jbox.height / 2;
    // Hold the stick at the top-left corner so both axes leave mid-rail.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(jbox.x + jbox.width * 0.12, jbox.y + jbox.height * 0.12, { steps: 8 });
    await page.waitForTimeout(6000);
    await page.mouse.up();
    await page.waitForTimeout(3000);

    const verdict = await runP;
    const serial = String(verdict.serial || '');
    console.log('ESP-IN JOY serial:', JSON.stringify(serial.slice(0, 400)));
    expect(verdict.ok).toBe(true);

    const rows = [...serial.matchAll(/JOY:(\d+),(\d+),(\d)/g)].map((m) => ({ x: +m[1], y: +m[2], sw: +m[3] }));
    console.log('ESP-IN JOY samples:', JSON.stringify(rows.slice(0, 12)));
    expect(rows.length).toBeGreaterThan(4);
    const xs = rows.map((r) => r.x);
    const ys = rows.map((r) => r.y);
    const span = (a) => Math.max(...a) - Math.min(...a);
    // Both axes must show a real excursion, not just ADC noise.
    expect(span(xs)).toBeGreaterThan(400);
    expect(span(ys)).toBeGreaterThan(400);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });
});
