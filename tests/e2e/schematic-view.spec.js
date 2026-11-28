import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emulatorComponents = path.resolve(__dirname, '../../../openhw-studio-emulator/src/components');

// Explicit, representative set: small passives, a board, an IC.
const CASES = [
  { folder: 'openhw-led', type: 'openhw-led', label: 'LED', x: 220, y: 180 },
  { folder: 'openhw-resistor', type: 'openhw-resistor', label: 'Resistor', x: 360, y: 180 },
  { folder: 'openhw-pushbutton', type: 'openhw-pushbutton', label: 'Push Button', x: 500, y: 180 },
  { folder: 'PI3', type: 'openhw-pi3', label: 'Raspberry Pi 3 B+ (Pyodide)', x: 620, y: 300 },
  { folder: 'openhw-max7219', type: 'openhw-max7219', label: 'MAX7219 Dot Matrix', x: 900, y: 300 },
];

const manifestFor = (folder) =>
  JSON.parse(fs.readFileSync(path.join(emulatorComponents, folder, 'manifest.json'), 'utf8'));

test.describe('Tool → Schematic View', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180000);

  test('renders manifest-derived symbols for every placed component and still exports', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.addInitScript(() => {
      // Correct key used by useTourLogic — avoid the tour overlay intercepting
      // clicks (the hyphenated variant is kept for older cached builds).
      window.localStorage.setItem('openhw_tour_completed', 'true');
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });

    // A fresh browser context always starts with an empty canvas.
    await page.goto('/simulator', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main', { timeout: 60000 });
    await page.waitForTimeout(800);

    // Place the representative components via the same Quick Add event the
    // canvas uses, so this exercises the real catalog/placement path.
    for (const c of CASES) {
      await page.evaluate(({ x, y }) => {
        window.dispatchEvent(new CustomEvent('quick-add-open', {
          detail: { screenX: 240, screenY: 200, canvasX: x, canvasY: y },
        }));
      }, c);
      const input = page.locator('input[data-quickadd="true"]');
      await input.waitFor({ state: 'visible', timeout: 10000 });
      await input.fill(c.type);
      // Match the result's own text so "Push Button" never picks "6mm Push Button".
      const result = page.locator('.canvas-menu-item[data-quickadd="true"]')
        .filter({ hasText: new RegExp(`^${c.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}↵?$`) })
        .first();
      await result.waitFor({ state: 'visible', timeout: 10000 });
      await result.click();
      await page.waitForTimeout(150);
    }

    // Tool → Schematic View
    await page.getByRole('button', { name: 'Tool', exact: true }).click();
    await page.getByText('Schematic View', { exact: true }).click();

    const panel = page.locator('[data-testid="schematic-view"]');
    await panel.waitFor({ state: 'visible', timeout: 30000 });
    const svg = page.locator('[data-testid="schematic-svg"] svg');
    await svg.waitFor({ state: 'visible', timeout: 30000 });

    // One <g class="comp"> per placed component, each with its manifest type.
    await expect(svg.locator('g.comp')).toHaveCount(CASES.length);
    console.log('[schematic] rendered types:', await svg.locator('g.comp').evaluateAll((els) => els.map((e) => e.getAttribute('data-symbol-type'))));

    for (const c of CASES) {
      const manifest = manifestFor(c.folder);
      const group = svg.locator(`g.comp[data-symbol-type="${c.type}"]`);
      await expect(group).toHaveCount(1);
      const pins = group.locator('[data-pin]');
      await expect(pins).toHaveCount(manifest.pins.length);
      for (const pin of manifest.pins) {
        await expect(group.locator(`[data-pin="${pin.id}"]`)).toHaveCount(1);
      }
      console.log(`[schematic] ${c.type}: ${manifest.pins.length} manifest pins rendered`);
    }

    // The generated A4 drawing still contains its frame and title block.
    await expect(svg.locator('g#wires')).toHaveCount(1);
    await expect(svg.locator('g#components')).toHaveCount(1);
    await expect(svg.getByText('Wiring view — not a SPICE netlist')).toHaveCount(1);

    // Schematic export still produces a real PNG download.
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('[data-testid="schematic-download-png"]').click(),
    ]);
    expect(download.suggestedFilename()).toBe('schematic.png');
    const outPath = path.join(__dirname, 'test-results', 'schematic-view.png');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await download.saveAs(outPath);
    expect(fs.statSync(outPath).size).toBeGreaterThan(1000);
    console.log(`[schematic] PNG export bytes: ${fs.statSync(outPath).size}`);

    const ignorable = (m) =>
      /Failed to load resource|net::ERR_|favicon|ResizeObserver loop/i.test(m);
    expect(consoleErrors.filter((m) => !ignorable(m))).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
