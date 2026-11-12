import { test, expect } from '@playwright/test';

// Runtime pace pill: measured per-board pace + themed per-board tooltip.
test.describe('runtime pace pill', () => {
  test.setTimeout(120000);
  test('pill shows measured pace with board tooltip', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
      window.localStorage.setItem('theme', 'light');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'uno2', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 300 },
      ],
      wires: [],
      code: 'void setup(){Serial.begin(9600);Serial.println(\"READY\");}\nvoid loop(){Serial.println(\"TICK\");delay(500);}\n',
    }));
    await page.evaluate(() => window.OpenHWE2E.setupCircuitBoards({
      extra: {
        uno2: 'void setup(){Serial.begin(9600);Serial.println("READY");}\nvoid loop(){Serial.println("TICK");delay(500);}\n',
      },
    }));
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 12000, serialNeedle: 'READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const pill = await page.evaluate(() => {
      const el = document.querySelector('[data-pace-tip]');
      const host = el ? el.parentElement : null;
      return {
        hostText: host ? host.innerText : null,
        tipText: el ? el.textContent : null,
        tipBg: el ? getComputedStyle(el).backgroundColor : null,
        pillBg: host ? getComputedStyle(host.closest('div[data-export-ignore]') || host).backgroundColor : null,
        theme: document.documentElement.getAttribute('data-theme'),
      };
    });
    console.log('PILL:', JSON.stringify(pill));
    expect(pill.hostText).toBeTruthy();
    expect(pill.tipText).toContain('uno1');
    expect(pill.tipText).toContain('uno2');
    expect(pill.theme).toBe('light');
    // Light-theme surface: pill bg must derive from the theme (was
    // hardcoded dark). Accept resolved-light lum or the color-mix rule.
    const styleAttr = await page.evaluate(() => {
      const el = document.querySelector('[data-pace-tip]');
      const host = el ? el.parentElement : null;
      const pill = host ? host.closest('div[data-export-ignore]') : null;
      return pill ? (pill.getAttribute('style') || '') : '';
    });
    console.log('PILL bg:', pill.pillBg);
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(pill.pillBg || '');
    if (m) {
      const lum = (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3;
      console.log('PILL lum:', Math.round(lum));
      expect(lum).toBeGreaterThan(150);
    } else {
      expect(styleAttr).toContain('color-mix');
    }
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
