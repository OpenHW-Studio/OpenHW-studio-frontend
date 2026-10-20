import { test, expect } from '@playwright/test';

// 8088 GPIO-out + GPIO-in + RX-echo (asm-first, zero runner changes — the
// runner maps openhw-8088 onto the 8086 core, so the PPI/USART paths are
// the proven 8086 ones; only per-board cells were missing).
test.describe('Retro 8088 GPIO + RX echo', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('LED lights via GPIO: openhw-8088', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(
      ({ asm }) =>
        window.OpenHWE2E.setupCircuit({
          components: [
            { id: 'r88', type: 'openhw-8088', attrs: {}, x: 100, y: 100 },
            { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 300, y: 120 },
            { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
          ],
          wires: [
            { from: 'r88:L2', to: 'res1:p1' },
            { from: 'res1:p2', to: 'led1:A' },
            { from: 'led1:K', to: 'r88:SWD_GND' },
          ],
          code: asm,
        }),
      { asm: `ORG 100h\nMOV AL, 80h\nOUT 0E3h, AL\nMOV AL, 04h\nOUT 0E0h, AL\nMOV DX, OFFSET msg\nMOV AH, 09h\nINT 21h\nHLT\nmsg: DB 'LED88$'\nEND` },
    );
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 12000, serialNeedle: 'LED88', telemetryMode: 'detail', selectTelemetry: ['led1'],
    }));
    console.log('8088-gpio verdict:', JSON.stringify({
      pass: verdict.pass, pins: verdict.pins?.r88,
      serialHead: (verdict.serial || '').slice(0, 60),
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    expect(verdict.pins?.r88?.L2).toBe(true);
    const ledEntry = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(ledEntry).toBeTruthy();
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('switch HIGH on L2 reaches 8088 PPI PA', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'r88', type: 'openhw-8088', attrs: {}, x: 100, y: 100 },
        { id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 },
      ],
      wires: [
        { from: 'r88:SWD_3V3', to: 'sw1:3' },
        { from: 'r88:SWD_GND', to: 'sw1:1' },
        { from: 'sw1:2', to: 'r88:L2' },
      ],
      code: `ORG 100h\nMOV AL, 90h\nOUT 0E3h, AL\nwait:\nIN AL, 0E0h\nTEST AL, 04h\nJZ wait\nMOV DX, OFFSET msg\nMOV AH, 09h\nINT 21h\nHLT\nmsg: DB 'SW88$'\nEND`,
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, serialNeedle: 'SW88', telemetryMode: 'detail',
    }));
    console.log('8088-gpio-in verdict:', JSON.stringify({
      pass: verdict.pass, serialHead: (verdict.serial || '').slice(0, 60),
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('echoes an injected byte through the 8088 8251', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const asm = `ORG 100h\nMOV DX, OFFSET msg\nMOV AH, 09h\nINT 21h\necho:\nIN AL, 51h\nTEST AL, 02h\nJZ echo\nIN AL, 50h\nOUT 50h, AL\nJMP echo\nmsg: DB 'RX88_RDY$'\nEND`;
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'r88e', type: 'openhw-8088', attrs: {}, x: 100, y: 100 }],
      wires: [],
      code,
    }), asm);
    expect(setup.ok).toBe(true);
    const v1 = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 25000, serialNeedle: 'RX88_RDY', telemetryMode: 'detail',
    }));
    expect(v1.ok).toBe(true);
    expect(v1.pass).toBe(true);
    const runP = page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'Z', telemetryMode: 'detail',
    }));
    await page.waitForTimeout(9000);
    const pushed = await page.evaluate(() => {
      try {
        if (typeof window.__sabSerialRxPushToBoard === 'function') {
          return window.__sabSerialRxPushToBoard('r88e', 'Z');
        }
        if (typeof window.__sabSerialRxPush === 'function') return window.__sabSerialRxPush('Z');
        return 'no-push-helper';
      } catch (e) { return 'push-threw:' + String(e && e.message || e); }
    });
    console.log('RX88 pushed:', JSON.stringify(pushed));
    const v2 = await runP;
    expect(v2.ok).toBe(true);
    console.log('RX88 serial:', JSON.stringify((v2.serial || '').slice(0, 300)));
    expect(v2.pass).toBe(true);
    expect(v2.serial || '').toContain('Z');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
