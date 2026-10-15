import { test, expect } from '@playwright/test';

// AVR Watchdog (Uno + Nano, live). Runner wires avr8js AVRWatchdog +
// AVRClock on the Uno/Nano branch only (avr-runner.ts: P1a-c); the WDT is
// disabled until firmware programs WDTCSR, so all non-WDT cells are
// unaffected. Proof shape mirrors the Pico WDT cell
// (pico-periph.spec.js): firmware pets the dog, arms it, then starves it —
// a second BOOT needle over emulated serial IS the reboot proof (avr8js
// calls cpu.reset() + sets MCUSR_WDRF on timeout). Interrupt-mode cell
// uses WDE+WDIE (interrupt-before-reset): ISR fires once, then reboot.
// Honest boundaries (NOT claimed here): Mega WDT (P1d blocked — no 2560
// WDT vector in-file), Tiny WDT (P1e deferred — WDTCR vs WDTCSR), Uno/Mega
// CAN-2.0 (no controller silicon), tiny native I2C/SPI/UART (USI-only),
// AVR sleep (CPU no-op), Modbus stays Uno-side.

const RESET_CODE =
  '#include <avr/wdt.h>\n' +
  'void setup(){Serial.begin(9600);pinMode(13,OUTPUT);Serial.println("AVR_WDT_BOOT");' +
  'wdt_enable(WDTO_1S);' +
  'for(uint8_t i=0;i<6;i++){wdt_reset();Serial.println("AVR_WDT_PET");' +
  'digitalWrite(13,HIGH);delay(200);digitalWrite(13,LOW);delay(200);}' +
  'Serial.println("AVR_WDT_ARMED");}\n' +
  'void loop(){delay(400);}\n';

const INT_CODE =
  '#include <avr/wdt.h>\n' +
  '#include <avr/interrupt.h>\n' +
  'volatile uint8_t wdtFires=0;\n' +
  'ISR(WDT_vect){wdtFires++;}\n' +
  'void setup(){Serial.begin(9600);Serial.println("AVRWDT_I_BOOT");' +
  'wdt_enable(WDTO_1S);WDTCSR|=(1<<WDIE);' +
  'Serial.println("AVRWDT_I_ARMED");}\n' +
  'void loop(){static uint8_t last=0;' +
  'if(wdtFires!=last){last=wdtFires;Serial.print("AVRWDT_I_ISR:");Serial.println(wdtFires);}' +
  'delay(200);}\n';

const CASES = [
  {
    name: 'uno', board: { id: 'uno1', type: 'openhw-arduino-uno' },
    code: RESET_CODE, boot: 'AVR_WDT_BOOT', armed: 'AVR_WDT_ARMED', pet: 'AVR_WDT_PET',
  },
  {
    name: 'nano', board: { id: 'nano1', type: 'openhw-arduino-nano' },
    code: RESET_CODE, boot: 'AVR_WDT_BOOT', armed: 'AVR_WDT_ARMED', pet: 'AVR_WDT_PET',
  },
];

test.describe('AVR watchdog reboot (live)', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  for (const c of CASES) {
    test(`WDT starves and reboots on ${c.board.type} (pet->arm->reboot)`, async ({ page }) => {
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
            { from: `${cc.board.id}:13`, to: 'res1:p1' },
            { from: 'res1:p2', to: 'led1:A' },
            { from: 'led1:K', to: `${cc.board.id}:GND.1` },
          ],
          code,
        }), [c, c.code]);
      expect(setup.ok).toBe(true);

      const verdict = await page.evaluate(() => window.OpenHWE2E.run({
        forMs: 25000, selectTelemetry: ['led1'], serialNeedle: 'AVR_WDT_ARMED', telemetryMode: 'detail',
      }));
      console.log(`${c.name} verdict:`, JSON.stringify({
        pass: verdict.pass, reasons: verdict.reasons,
        serialHead: (verdict.serial || '').slice(-300),
        telemetry: (verdict.telemetry || []).map((t) => ({ id: t.id, status: t.status, summary: String(t.summary || '').slice(0, 160) })),
      }));
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      const serial = verdict.serial || '';
      // Pet phase ran (dog was fed while armed window was open).
      expect(serial).toContain(c.pet);
      // Arm point reached (firmware stopped petting after this).
      expect(serial).toContain(c.armed);
      // Reboot proof: setup() re-ran after the WDT timeout reset.
      const boots = serial.match(/AVR_WDT_BOOT/g) || [];
      console.log(`${c.name} WDT boots:`, boots.length);
      expect(boots.length).toBeGreaterThanOrEqual(2);
      // Telemetry path live alongside the WDT (LED blinked during pet phase).
      const ledEntry = (verdict.telemetry || []).find((t) => t.id === 'led1');
      expect(ledEntry).toBeTruthy();
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }

  test('WDT interrupt-before-reset on uno (ISR fires, then reboot)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const setup = await page.evaluate((code) =>
      window.OpenHWE2E.setupCircuit({
        components: [
          { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        ],
        wires: [],
        code,
      }), INT_CODE);
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, serialNeedle: 'AVRWDT_I_ARMED', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    console.log('WDT-INT serial tail:', JSON.stringify(serial.slice(-300)));
    // First timeout delivered the WDT interrupt (WDIE path, no reset yet).
    expect(serial).toContain('AVRWDT_I_ISR:1');
    // Second timeout reset the CPU (WDE path) — setup() re-ran.
    const boots = serial.match(/AVRWDT_I_BOOT/g) || [];
    console.log('WDT-INT boots:', boots.length);
    expect(boots.length).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
