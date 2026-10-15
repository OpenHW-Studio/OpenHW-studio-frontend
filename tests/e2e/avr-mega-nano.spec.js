import { test, expect } from '@playwright/test';

// AVR Mega + Nano UART TX + GPIO-out latch (live). Mirrors the
// board-family-sweep latch-HIGH rows for exactly these two boards, with the
// UART TX needle folded into the same sketch: firmware blinks pin 13 3x,
// latches HIGH printing HOLD_HIGH, and prints a per-board UART needle every
// loop. Serial receipt of the needle IS the UART TX proof (avr8js USART,
// same path as Uno — no runner changes); the end-snapshot LED telemetry is
// the GPIO-out proof. FQBNs resolve per board via the backend registry.
const CASES = [
  {
    name: 'mega', board: { id: 'mega1', type: 'openhw-arduino-mega' },
    pin: '13', gnd: 'GND.1', needle: 'UART_MEGA_TX',
  },
  {
    name: 'nano', board: { id: 'nano1', type: 'openhw-arduino-nano' },
    pin: '13', gnd: 'GND.1', needle: 'UART_NANO_TX',
  },
];

const CODE = (needle) =>
  `int n=0;\nvoid setup(){pinMode(13,OUTPUT);Serial.begin(9600);Serial.println("${needle}_READY");}\nvoid loop(){if(n<6){digitalWrite(13,HIGH);delay(250);digitalWrite(13,LOW);delay(250);n++;Serial.println("${needle}_TICK");}else{digitalWrite(13,HIGH);Serial.println("${needle}");Serial.println("HOLD_HIGH");delay(1000);}}\n`;

test.describe('AVR Mega/Nano UART TX + GPIO-out latch (live)', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const c of CASES) {
    test(`UART TX + latch-HIGH on ${c.board.type}`, async ({ page }) => {
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
        }), [c, CODE(c.needle)]);
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
      console.log(`${c.name} liveOop:`, JSON.stringify((verdict.liveOop || {}).led1 || {}).slice(0, 300));
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      // UART TX proof: the per-board needle arrived over emulated serial.
      expect(verdict.serial || '').toContain(c.needle);
      // GPIO-out proof: latched HIGH drives the LED at the end snapshot.
      const ledEntry = (verdict.telemetry || []).find((t) => t.id === 'led1');
      expect(ledEntry).toBeTruthy();
      expect(String(ledEntry.summary || '')).toMatch(/illuminated: true|brightness: ([1-9]|0\.\d*[1-9])|brightness: [1-9]/);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
