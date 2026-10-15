import { test, expect } from '@playwright/test';

// 8086 PIT timer IRQ (8253 ch0 -> IRQ0/INT 8, asm-first, zero runner
// changes — countdown + IRQ delivery are engine-internal per
// retro-timer-plan.md). PIT ch0 mode 3 divisor FFFFh (~18.2 Hz); INT 8
// handler bumps [ticks] + EOI; main prints T per change. Mode bytes are
// the standard 8253/8259 recipe (examples/ not vendored — see plan).
test.describe('Retro 8086 PIT timer IRQ', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('PIT ch0 IRQs increment the tick counter', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const asm = [
      'ORG 100h',
      'CLI',
      'XOR AX, AX',
      'PUSH DS',
      'MOV DS, AX',
      'MOV AX, OFFSET pit_isr',
      'MOV [0020h], AX',
      'MOV AX, CS',
      'MOV [0022h], AX',
      'POP DS',
      'MOV AL, 36h',
      'OUT 43h, AL',
      'MOV AL, 0FFh',
      'OUT 40h, AL',
      'OUT 40h, AL',
      'IN AL, 21h',
      'AND AL, 0FEh',
      'OUT 21h, AL',
      'STI',
      'poll:',
      'MOV AX, ticks',
      'CMP AX, last',
      'JE poll',
      'MOV last, AX',
      'MOV DL, \'T\'',
      'MOV AH, 02h',
      'INT 21h',
      'JMP poll',
      'pit_isr:',
      'PUSH AX',
      'INC ticks',
      'MOV AL, 20h',
      'OUT 20h, AL',
      'POP AX',
      'IRET',
      'ticks: DW 0',
      'last: DW 0',
      'END',
    ].join('\n');
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'r86', type: 'openhw-8086', attrs: {}, x: 100, y: 100 }],
      wires: [],
      code,
    }), asm);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'TTTTTTTT', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    const ticks = ((verdict.serial || '').match(/T/g) || []).length;
    console.log('PIT ticks:', ticks, 'serial:', JSON.stringify((verdict.serial || '').slice(0, 120)));
    expect(verdict.pass).toBe(true);
    expect(ticks).toBeGreaterThanOrEqual(8);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
