import { test, expect } from '@playwright/test';

// Cross-family GPIO proof v2 (plan §8 matrix spot-checks): LED+resistor on
// families with no prior live coverage (mega/nano/pico/stm32/attiny85).
// Firmware blinks 3x then latches HIGH + prints HOLD_HIGH, so the end
// snapshot deterministically catches the driven-HIGH line (no 50/50 race)
// and the needle is robust to boot-time serial loss. Backend now carries
// nano + mega FQBNs (boardRegistry.js); mega resolves to its own FQBN
// instead of silently compiling as Uno.
const CASES = [
  {
    name: 'mega13', board: { id: 'mega1', type: 'openhw-arduino-mega' },
    pin: '13', codePin: '13', gnd: 'GND.1',
  },
  {
    name: 'nano13', board: { id: 'nano1', type: 'openhw-arduino-nano' },
    pin: '13', codePin: '13', gnd: 'GND.1',
  },
  {
    name: 'picoGP15', board: { id: 'pico1', type: 'openhw-pico' },
    pin: 'GP15', codePin: '15', gnd: 'GND',
  },
  {
    name: 'stm32PC13', board: { id: 'bp1', type: 'openhw-stm32-bluepill' },
    pin: 'PC13', codePin: 'PC13', gnd: 'GND.1',
  },
  {
    name: 'attinyP0', board: { id: 'att1', type: 'openhw-attiny85' },
    pin: 'P0', codePin: '0', gnd: 'GND',
  },
];

const CODE = (codePin) =>
  `int n=0;\nvoid setup(){pinMode(${codePin},OUTPUT);Serial.begin(9600);Serial.println("BLINK_READY");}\nvoid loop(){if(n<6){digitalWrite(${codePin},HIGH);delay(250);digitalWrite(${codePin},LOW);delay(250);n++;Serial.println("BLINK_TICK");}else{digitalWrite(${codePin},HIGH);Serial.println("HOLD_HIGH");delay(1000);}}\n`;

test.describe('Board-family GPIO sweep v2 (LED latch-HIGH, live)', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const c of CASES) {
    test(`latch-HIGH on ${c.board.type} pin ${c.pin}`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);

      const setup = await page.evaluate(([cc, code]) =>
        window.OpenHWE2E.setupCircuit({
          components: [
            { id: cc.board.id, type: cc.board.type, attrs: {}, x: 100, y: 100 },
            { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 450, y: 100 },
            { id: 'led1', type: 'openhw-led', attrs: {}, x: 600, y: 100 },
          ],
          wires: [
            { from: `${cc.board.id}:${cc.pin}`, to: 'res1:p1' },
            { from: 'res1:p2', to: 'led1:A' },
            { from: 'led1:K', to: `${cc.board.id}:${cc.gnd}` },
          ],
          code,
        }), [c, CODE(c.codePin)]);
      expect(setup.ok).toBe(true);

      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 18000, selectTelemetry: ['led1'], serialNeedle: 'HOLD_HIGH', telemetryMode: 'detail',
      }));
      console.log(`${c.name} verdict:`, JSON.stringify({
        pass: verdict.pass, reasons: verdict.reasons,
        serialHead: (verdict.serial || '').slice(-200),
        pins: verdict.pins,
        telemetry: (verdict.telemetry || []).map((t) => ({ id: t.id, status: t.status, summary: String(t.summary || '').slice(0, 200) })),
      }));
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      // Latched HIGH: the end snapshot must show the driven line.
      const ledEntry = (verdict.telemetry || []).find((t) => t.id === 'led1');
      expect(ledEntry).toBeTruthy();
      expect(String(ledEntry.summary || '')).toMatch(/illuminated: true|brightness: ([1-9]|0\.\d*[1-9])|brightness: [1-9]/);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
