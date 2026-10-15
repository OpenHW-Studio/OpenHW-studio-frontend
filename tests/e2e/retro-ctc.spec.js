import { test, expect } from '@playwright/test';

// Z80 CTC timer IRQ (ch0 -> IM1 vector 38h, asm-first, zero runner
// changes). Numeric-address layout (package Z80 assembler: no forward
// label refs): JP 80 at 0, ISR at 56, main at 80, counter at 96/97.
// CTC ch0 control C7h (timer/int/prescaler-16/TC-follows) + TC 200 per
// the standard recipe (examples/ not vendored — see retro-timer-plan.md).
test.describe('Retro Z80 CTC timer IRQ', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('CTC ch0 IRQs increment the tick counter', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const lines = [
      'ORG 0',
      'JP 80',
      ...Array(53).fill('DB 0'),
      'PUSH AF',
      'LD A, (96)',
      'INC A',
      'LD (96), A',
      'POP AF',
      'EI',
      'RETI',
      ...Array(12).fill('DB 0'),
      'LD A, 199',
      'OUT (16), A',
      'LD A, 200',
      'OUT (16), A',
      'IM 1',
      'EI',
      'LD A, 0',
      'LD (96), A',
      'LD (97), A',
      'loop:',
      'LD A, (96)',
      'LD B, A',
      'LD A, (97)',
      'CP B',
      'JR Z, loop',
      'LD A, B',
      'LD (97), A',
      'LD A, 67',
      'OUT (1), A',
      'JR loop',
      'END',
    ];
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'rz80', type: 'openhw-z80', attrs: {}, x: 100, y: 100 }],
      wires: [],
      code,
    }), lines.join('\n'));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'CCCCCCCC', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    const ticks = ((verdict.serial || '').match(/C/g) || []).length;
    console.log('CTC ticks:', ticks, 'serial:', JSON.stringify((verdict.serial || '').slice(0, 120)));
    expect(verdict.pass).toBe(true);
    expect(ticks).toBeGreaterThanOrEqual(8);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
