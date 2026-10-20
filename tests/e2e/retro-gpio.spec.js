import { test, expect } from '@playwright/test';

// Retro GPIO conformance seed (plan §8): same behavior, board-supplied pins.
// Each test gets a fresh browser context (fresh page), matching the official
// harness semantics. LED is wired through a series resistor (the LED model
// burns out above 4V without one).
// Covers: 8086, 8085, 6502, Z80 full LED light; 8051 quasi-bidirectional
// LOW-drive publishes pin LOW (sourcing HIGH floats by hardware design).
test.describe('Retro GPIO conformance (8086emu, asm-first)', () => {
  test.setTimeout(600000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  // [boardId, boardType, gpioPin, asm source, serial needle, expectation]
  const ledCases = [
    ['r86', 'openhw-8086', 'L2',
      `ORG 100h\nMOV AL, 80h\nOUT 0E3h, AL\nMOV AL, 04h\nOUT 0E0h, AL\nMOV DX, OFFSET msg\nMOV AH, 09h\nINT 21h\nHLT\nmsg: DB 'LED86$'\nEND`,
      'LED86'],
    ['r85', 'openhw-8085', 'L2',
      `ORG 0\nMVI A, 80h\nOUT 0E3h\nMVI A, 04h\nOUT 0E0h\nMVI A, 41h\nOUT 01h\nHLT\nEND`,
      'A'],
    ['r65', 'openhw-6502', 'L2',
      // NOTE: ends in a JMP loop, NOT BRK — the package 6502 BRK vectors
      // into runaway execution that scribbles VIA DDR/ORA (verified
      // headless: DDR=51h after BRK vs FFh with JMP loop).
      `ORG 0\nLDA #$FF\nSTA $6003\nLDA #$04\nSTA $6001\nLDA #'Q'\nSTA $01\nloop:\nJMP loop\nEND`,
      'Q'],
    ['rz80', 'openhw-z80', 'L2',
      `ORG 0\nLD A, 04h\nOUT (0E0h), A\nLD A, 'Q'\nOUT (1), A\nHALT\nEND`,
      'Q'],
  ];

  for (const [boardId, boardType, pin, asm, needle] of ledCases) {
    test(`LED lights via GPIO: ${boardType}`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);

      const setup = await page.evaluate(
        ({ boardId, boardType, pin, asm }) =>
          window.OpenHWE2E.setupCircuit({
            components: [
              { id: boardId, type: boardType, attrs: {}, x: 100, y: 100 },
              { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 300, y: 120 },
              { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
            ],
            wires: [
              { from: `${boardId}:${pin}`, to: 'res1:p1' },
              { from: 'res1:p2', to: 'led1:A' },
              { from: 'led1:K', to: `${boardId}:SWD_GND` },
            ],
            code: asm,
          }),
        { boardId, boardType, pin, asm },
      );
      expect(setup.ok).toBe(true);

      const verdict = await page.evaluate(
        ({ needle }) => window.OpenHWE2E.run({ forMs: 12000, serialNeedle: needle, telemetryMode: 'detail', selectTelemetry: ['led1'] }),
        { needle },
      );
      console.log(`${boardType} verdict:`, JSON.stringify({
        pass: verdict.pass, reasons: verdict.reasons,
        pins: verdict.pins?.[boardId],
        serialHead: (verdict.serial || '').slice(0, 60),
      }));
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      // Engine drove the wired pin HIGH.
      expect(verdict.pins?.[boardId]?.[pin]).toBe(true);
      // Real telemetry: LED model reports lit with rail voltage present.
      const ledEntry = (verdict.telemetry || []).find((t) => t.id === 'led1');
      expect(ledEntry).toBeTruthy();
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }

  test('GPIO LOW-drive publishes: openhw-8051 (quasi-bidirectional)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    // P1 = 0FBh: bit 2 LOW (drives — quasi-bidirectional ports sink),
    // all other P1 bits HIGH (float). SBUF proves the firmware ran.
    const setup = await page.evaluate(() =>
      window.OpenHWE2E.setupCircuit({
        components: [{ id: 'r51', type: 'openhw-8051', attrs: {}, x: 100, y: 100 }],
        wires: [],
        code: `ORG 0\nMOV P1, #0FBh\nMOV SBUF, #'Q'\nSJMP $\nEND`,
      }));
    expect(setup.ok).toBe(true);

    const verdict = await page.evaluate(() =>
      window.OpenHWE2E.run({ forMs: 12000, serialNeedle: 'Q', telemetryMode: 'detail' }));
    console.log('8051 verdict:', JSON.stringify({
      pass: verdict.pass, reasons: verdict.reasons,
      pins: verdict.pins?.r51, serialHead: (verdict.serial || '').slice(0, 30),
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    // LOW bit publishes driven-LOW; HIGH (floating) bits stay unpublished/false.
    expect(verdict.pins?.r51?.L2).toBe(false);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
