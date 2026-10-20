import { test, expect } from '@playwright/test';

// Retro GPIO-in per board (asm-first, zero runner changes — all inject
// paths exist in retro-runner.ts setGpioInput: 8085 via ppi_set_input,
// 8051 quasi-bidirectional P1/P2, 6502 via via_pins, Z80 kit latch E0h).
// Slide-switch preset HIGH wired to L2; firmware polls and prints.
// 8086 covered by retro-gpio-in.spec.js; 8088 by retro-8088-gpio.spec.js.
test.describe('Retro GPIO input per board (8085/8051/6502/Z80)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  const cases = [
    ['r85', 'openhw-8085', 'SW85',
      `    MVI C, 05h\n    MVI A, 90h\n    OUT 0E3h\nwait:\n    IN 0E0h\n    ANI 04h\n    JZ wait\n    LXI H, msg\nploop:\n    MOV A, M\n    CPI '$'\n    JZ wait\n    OUT 01h\n    INX H\n    JMP ploop\nmsg: DB 'SW85!', '$'\nEND`],
    ['r51', 'openhw-8051', 'SW51',
      `ORG 0\nMOV P1, #0FFh\nwait:\nMOV A, P1\nANL A, #04h\nJZ wait\nMOV DPTR, #msg\nMOV R1, #00h\nploop:\nMOV A, R1\nMOVC A, @A+DPTR\nJZ pwait\nMOV SBUF, A\nwtx:\nJNB TI, wtx\nCLR TI\nINC R1\nSJMP ploop\npwait:\nSJMP wait\nmsg: DB 'SW51!', 0\nEND`],
    ['r65', 'openhw-6502', 'SW65',
      `ORG 0\nLDA #$FB\nSTA $6003\nwait:\nLDA $6001\nAND #$04\nBEQ wait\nLDA #'S'\nSTA $01\nLDA #'W'\nSTA $01\nLDA #'6'\nSTA $01\nLDA #'5'\nSTA $01\nloop:\nJMP loop\nEND`],
    ['rz80', 'openhw-z80', 'SWZ80',
      `ORG 0\nLD A, 0\nOUT (224), A\nwait:\nIN A, (224)\nAND 4\nJR Z, wait\nLD A, 83\nOUT (1), A\nLD A, 87\nOUT (1), A\nLD A, 90\nOUT (1), A\nLD A, 56\nOUT (1), A\nLD A, 48\nOUT (1), A\nHALT\nEND`],
  ];

  for (const [boardId, boardType, needle, asm] of cases) {
    test(`switch HIGH on L2 reaches ${boardType}`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);
      const setup = await page.evaluate(
        ({ boardId, boardType, asm }) => window.OpenHWE2E.setupCircuit({
          components: [
            { id: boardId, type: boardType, attrs: {}, x: 100, y: 100 },
            { id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 },
          ],
          wires: [
            { from: `${boardId}:SWD_3V3`, to: 'sw1:3' },
            { from: `${boardId}:SWD_GND`, to: 'sw1:1' },
            { from: 'sw1:2', to: `${boardId}:L2` },
          ],
          code: asm,
        }),
        { boardId, boardType, asm },
      );
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(
        ({ needle }) => window.OpenHWE2E.run({ forMs: 25000, serialNeedle: needle, telemetryMode: 'detail' }),
        { needle },
      );
      console.log(`${boardType}-gpio-in verdict:`, JSON.stringify({
        pass: verdict.pass, serialHead: (verdict.serial || '').slice(0, 60),
      }));
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
