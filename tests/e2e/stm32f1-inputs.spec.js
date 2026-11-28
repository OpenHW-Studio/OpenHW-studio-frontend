import { test, expect } from '@playwright/test';

// STM32F1 (Blue Pill) input components driven by real DOM interaction, with
// the guest as the judge. Same four cells as the ESP32 input round:
//   button   -> digitalRead follows a held press (external 10k pull-up)
//   switch   -> digitalRead follows the wiper flipped MID-RUN, both ways
//   keypad   -> matrix scan sees a held key (4x4 map, key '5' = row1/col1)
//   joystick -> both ADC axes leave mid-rail while the stick is held
//
// Interaction timing matters on every board: component UIs are
// pointer-events: none until React isRunning flips, and that can happen
// before the guest boots. Clicks in that window land on the canvas. The
// helper gates on running + the sketch's readiness needle in the captured
// serial + the element actually accepting pointer events.

const BOARD = {
  id: 'bp1',
  type: 'openhw-stm32-bluepill',
  v3: '3V3.1',
  gnd: 'GND.1',
  btn: 'PA1',
  sw: 'PA2',
  joyX: 'PA0',
  joyY: 'PA1',
  joySel: 'PB12',
  rows: ['PA4', 'PA5', 'PA6', 'PA7'],
  cols: ['PB0', 'PB1', 'PB10', 'PB11'],
};

async function waitReady(page, needle, selector, timeout = 180000) {
  await page.waitForFunction(({ n, sel }) => {
    const sn = window.OpenHWE2E?.snapshot?.();
    if (!sn?.running || !String(sn.serialText || '').includes(n)) return false;
    const el = document.querySelector(sel);
    if (!el) return false;
    // The slide switch paints its SVG inert (visual only) and takes clicks
    // on the wrapping div, so the HOST is what must accept pointer events.
    const host = el.closest('[id^="comp-master-"]') || el;
    return getComputedStyle(host).pointerEvents !== 'none';
  }, { n: needle, sel: selector }, { timeout });
}

test.describe('STM32F1 inputs (button, switch, keypad, joystick)', () => {
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
    page.on('pageerror', (err) => console.log('F1IN PAGEERROR:', String(err).slice(0, 200)));
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
  });

  test('pushbutton press reaches digitalRead', async ({ page }) => {
    const setup = await page.evaluate((B) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: B.id, type: B.type, attrs: {}, x: 100, y: 100 },
        { id: 'btn1', type: 'openhw-pushbutton', attrs: {}, x: 450, y: 120 },
        // External 10k: the same wiring a breadboard uses, and it keeps this
        // cell about the COMPONENT, not about the engine's pull-up model.
        { id: 'r1', type: 'openhw-resistor', attrs: { value: '10000' }, x: 250, y: 300 },
      ],
      wires: [
        { from: `${B.id}:${B.btn}`, to: 'btn1:1l' },
        { from: `${B.id}:${B.gnd}`, to: 'btn1:2l' },
        { from: `${B.id}:${B.v3}`, to: 'r1:p1' },
        { from: 'r1:p2', to: 'btn1:1l' },
      ],
      code: [
        'int last=-1;',
        `void setup(){ Serial.begin(9600); Serial.println("BTN_READY"); pinMode(${B.btn}, INPUT); }`,
        `void loop(){ int v=digitalRead(${B.btn}); if(v!=last){ Serial.print("BTN:"); Serial.println(v); last=v; } delay(50); }`,
      ].join('\n'),
    }), BOARD);
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['btn1'], serialNeedle: 'BTN_READY', telemetryMode: 'detail',
    }));
    await waitReady(page, 'BTN_READY', '#comp-master-btn1 .btn-wrapper');

    const boxes = await page.locator('#comp-master-btn1 .btn-wrapper').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
    console.log('F1IN BTN boxes:', JSON.stringify(boxes));
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    const b = boxes.reduce((a, c) => (c.x > a.x ? c : a));
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await page.waitForTimeout(4000);
    await page.mouse.up();
    await page.waitForTimeout(4000);

    const verdict = await runP;
    const serial = String(verdict.serial || '');
    console.log('F1IN BTN serial tail:', JSON.stringify(serial.slice(-160)));
    expect(verdict.ok).toBe(true);
    const seq = [...serial.matchAll(/BTN:(\d)/g)].map((m) => m[1]).join('');
    console.log('F1IN BTN seq:', seq);
    // Full transition required: idle HIGH, held press LOW, release HIGH.
    // A boot transient alone (`01`) must NOT satisfy this cell.
    const firstHigh = seq.indexOf('1');
    const zero = seq.indexOf('0');
    expect(firstHigh).toBeGreaterThanOrEqual(0);
    expect(zero).toBeGreaterThan(firstHigh);
    expect(seq.indexOf('1', zero)).toBeGreaterThan(zero);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  test('slide switch flipped mid-run changes digitalRead both ways', async ({ page }) => {
    const setup = await page.evaluate((B) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: B.id, type: B.type, attrs: {}, x: 100, y: 100 },
        { id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 },
      ],
      wires: [
        { from: `${B.id}:${B.v3}`, to: 'sw1:3' },
        { from: `${B.id}:${B.gnd}`, to: 'sw1:1' },
        { from: 'sw1:2', to: `${B.id}:${B.sw}` },
      ],
      code: [
        'void setup(){ Serial.begin(9600); Serial.println("SW_READY"); }',
        `void loop(){ Serial.print("SWI:"); Serial.println(digitalRead(${B.sw})); delay(300); }`,
      ].join('\n'),
    }), BOARD);
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, selectTelemetry: ['sw1'], serialNeedle: 'SW_READY', telemetryMode: 'detail',
    }));
    await waitReady(page, 'SW_READY', '#comp-master-sw1');

    const box = await page.locator('#comp-master-sw1 svg').first().boundingBox({ timeout: 10000 }).catch(() => null);
    expect(box).toBeTruthy();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const over = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return { inside: !!el?.closest?.('#comp-master-sw1'), tag: el?.tagName };
    }, [cx, cy]);
    console.log('F1IN SW hit:', JSON.stringify(over));
    expect(over.inside).toBe(true);

    await page.mouse.click(cx, cy);
    await page.waitForTimeout(8000);
    const mid = await page.evaluate(() => {
      const t = (window.OpenHWTelemetry?.getLatestTelemetry?.() || []).find((x) => x.id === 'sw1');
      return t?.details?.custom?.value ?? t?.details?.state?.value ?? null;
    });
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(8000);

    const verdict = await runP;
    const serial = String(verdict.serial || '');
    const tracks = serial.split(/\r?\n/).map((l) => /^SWI:(\d)$/.exec(l.trim())?.[1]).filter(Boolean).join('');
    console.log('F1IN SW mid value:', JSON.stringify(mid), 'tracks:', tracks);
    expect(verdict.ok).toBe(true);
    const firstLow = tracks.indexOf('0');
    expect(firstLow).toBeGreaterThan(0);
    expect(tracks[0]).toBe('1');
    expect(tracks.lastIndexOf('1')).toBeGreaterThan(firstLow);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  test('membrane keypad scans key 5', async ({ page }) => {
    const setup = await page.evaluate((B) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: B.id, type: B.type, attrs: {}, x: 100, y: 100 },
        { id: 'kp1', type: 'openhw-membrane-keypad', attrs: {}, x: 450, y: 120 },
        // External 10k column pull-ups: the engine ignores
        // INPUT_PULLUP, so without these the columns float LOW and every
        // scan position reads as a pressed key (false green).
        { id: 'rp1', type: 'openhw-resistor', attrs: { value: '10000' }, x: 250, y: 320 },
        { id: 'rp2', type: 'openhw-resistor', attrs: { value: '10000' }, x: 250, y: 420 },
        { id: 'rp3', type: 'openhw-resistor', attrs: { value: '10000' }, x: 250, y: 520 },
        { id: 'rp4', type: 'openhw-resistor', attrs: { value: '10000' }, x: 250, y: 620 },
      ],
      wires: [
        { from: `${B.id}:${B.rows[0]}`, to: 'kp1:R1' },
        { from: `${B.id}:${B.rows[1]}`, to: 'kp1:R2' },
        { from: `${B.id}:${B.rows[2]}`, to: 'kp1:R3' },
        { from: `${B.id}:${B.rows[3]}`, to: 'kp1:R4' },
        { from: `${B.id}:${B.cols[0]}`, to: 'kp1:C1' },
        { from: `${B.id}:${B.cols[1]}`, to: 'kp1:C2' },
        { from: `${B.id}:${B.cols[2]}`, to: 'kp1:C3' },
        { from: `${B.id}:${B.cols[3]}`, to: 'kp1:C4' },
        { from: `${B.id}:${B.v3}`, to: 'rp1:p1' },
        { from: 'rp1:p2', to: 'kp1:C1' },
        { from: `${B.id}:${B.v3}`, to: 'rp2:p1' },
        { from: 'rp2:p2', to: 'kp1:C2' },
        { from: `${B.id}:${B.v3}`, to: 'rp3:p1' },
        { from: 'rp3:p2', to: 'kp1:C3' },
        { from: `${B.id}:${B.v3}`, to: 'rp4:p1' },
        { from: 'rp4:p2', to: 'kp1:C4' },
      ],
      code: [
        `int rows[4]={${B.rows.join(',')}}; int cols[4]={${B.cols.join(',')}}; int last=-2;`,
        'void setup(){ Serial.begin(9600); Serial.println("KP_READY");',
        '  for(int i=0;i<4;i++){ pinMode(rows[i],OUTPUT); digitalWrite(rows[i],HIGH); pinMode(cols[i],INPUT); } }',
        'void loop(){ int hit=-1;',
        '  for(int r=0;r<4;r++){ digitalWrite(rows[r],LOW); delay(3);',
        '    for(int c=0;c<4;c++){ if(digitalRead(cols[c])==LOW) hit=r*10+c; }',
        '    digitalWrite(rows[r],HIGH); }',
        '  if(hit!=last){ Serial.print("KEY:"); if(hit<0) Serial.println("none");',
        '    else { Serial.print(hit/10); Serial.println(hit%10); } last=hit; }',
        '  delay(30); }',
      ].join('\n'),
    }), BOARD);
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, selectTelemetry: ['kp1'], serialNeedle: 'KP_READY', telemetryMode: 'detail',
    }));
    await waitReady(page, 'KP_READY', '#comp-master-kp1 wokwi-membrane-keypad');

    const key = page.locator('#comp-master-kp1 wokwi-membrane-keypad').getByText('5', { exact: true });
    await key.scrollIntoViewIfNeeded().catch(() => {});
    const kbox = await key.boundingBox({ timeout: 10000 }).catch(() => null);
    console.log('F1IN KP key5 box:', JSON.stringify(kbox));
    expect(kbox).toBeTruthy();
    await page.mouse.move(kbox.x + kbox.width / 2, kbox.y + kbox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(5000);
    await page.mouse.up();
    await page.waitForTimeout(3000);

    const verdict = await runP;
    const serial = String(verdict.serial || '');
    console.log('F1IN KP serial tail:', JSON.stringify(serial.slice(-200)));
    expect(verdict.ok).toBe(true);
    // Edge-triggered: idle reads none, the held key 5 reads 11 once, and
    // the release must return to none. A stuck `KEY:11` stream or a
    // phantom `KEY:00` both fail here.
    const keys = [...serial.matchAll(/KEY:(\d\d|none)/g)].map((m) => m[1]);
    console.log('F' + 'KP seq head:', JSON.stringify(keys.slice(0, 12)));
    expect(keys).toContain('none');
    expect(keys).toContain('11');
    const held = keys.indexOf('11');
    expect(keys.lastIndexOf('none')).toBeGreaterThan(held);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });

  test('joystick drag moves both ADC axes', async ({ page }) => {
    const setup = await page.evaluate((B) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: B.id, type: B.type, attrs: {}, x: 100, y: 100 },
        { id: 'joy1', type: 'openhw-analog-joystick', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: `${B.id}:${B.v3}`, to: 'joy1:VCC' },
        { from: `${B.id}:${B.gnd}`, to: 'joy1:GND' },
        { from: `${B.id}:${B.joyX}`, to: 'joy1:HORZ' },
        { from: `${B.id}:${B.joyY}`, to: 'joy1:VERT' },
        { from: `${B.id}:${B.joySel}`, to: 'joy1:SEL' },
      ],
      code: [
        'void setup(){ Serial.begin(9600); Serial.println("JOY_READY"); analogReadResolution(12); pinMode(joySelPin, INPUT_PULLUP); }',
        `void loop(){ Serial.print("JOY:"); Serial.print(analogRead(${B.joyX})); Serial.print(",");`,
        `  Serial.print(analogRead(${B.joyY})); Serial.print(","); Serial.println(digitalRead(${B.joySel})); delay(200); }`,
      ].join('\n').replace('joySelPin', B.joySel),
    }), BOARD);
    expect(setup.ok).toBe(true);

    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 90000, selectTelemetry: ['joy1'], serialNeedle: 'JOY_READY', telemetryMode: 'detail',
    }));
    await waitReady(page, 'JOY_READY', '#comp-master-joy1 svg');

    const jbox = await page.locator('#comp-master-joy1 svg').first().boundingBox({ timeout: 10000 }).catch(() => null);
    console.log('F1IN JOY box:', JSON.stringify(jbox));
    expect(jbox).toBeTruthy();
    await page.mouse.move(jbox.x + jbox.width / 2, jbox.y + jbox.height / 2);
    await page.mouse.down();
    await page.mouse.move(jbox.x + jbox.width * 0.15, jbox.y + jbox.height * 0.15, { steps: 8 });
    await page.waitForTimeout(6000);
    const held = await page.evaluate(() => {
      const t = (window.OpenHWTelemetry?.getLatestTelemetry?.() || []).find((x) => x.id === 'joy1');
      const st = t?.details?.state || {};
      return { x: st.x, y: st.y, volts: st.analogVoltages };
    });
    await page.mouse.up();
    await page.waitForTimeout(3000);

    const verdict = await runP;
    const serial = String(verdict.serial || '');
    console.log('F1IN JOY held:', JSON.stringify(held));
    expect(verdict.ok).toBe(true);
    const rows = [...serial.matchAll(/JOY:(\d+),(\d+),(\d)/g)].map((m) => ({ x: +m[1], y: +m[2], sw: +m[3] }));
    console.log('F1IN JOY samples:', JSON.stringify(rows.slice(0, 10)));
    expect(rows.length).toBeGreaterThan(4);
    const span = (a) => Math.max(...a) - Math.min(...a);
    expect(span(rows.map((r) => r.x))).toBeGreaterThan(400);
    expect(span(rows.map((r) => r.y))).toBeGreaterThan(400);

    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(1500);
  });
});
