import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

// Canonical step order/titles from TourGuide.jsx. Keeping the expectations
// here (instead of reading them from the DOM under test) means the assertions
// still fail if the tour highlights the wrong element or skips a step.
const STEPS = [
  { id: 'welcome', target: null, title: 'Welcome to OpenHW Studio! 🚀' },
  { id: 'quick-add', target: '[data-tour-id="tour-canvas"]', title: 'Quick Add Portal' },
  { id: 'drag-demo', target: '[data-tour-id="tour-canvas"]', title: 'Component Movement' },
  { id: 'wiring', target: '[data-tour-id="tour-canvas"]', title: 'Intelligent Wiring' },
  { id: 'autowiring', target: '[data-tour-id="tour-canvas"]', title: 'Intelligent Autowiring' },
  { id: 'autowiring-controls', target: '[data-tour-id="menu-item-assist"]', title: 'Autowiring Controls' },
  { id: 'components-palette', target: '[data-tour-id="palette-panel"]', title: 'Components Palette' },
  { id: 'boards-pi3', target: '[data-tour-type="openhw-pi3"]', title: 'New Board: Raspberry Pi 3' },
  { id: 'boards-pi4', target: '[data-tour-type="openhw-pi4"]', title: 'New Board: Raspberry Pi 4' },
  { id: 'boards-pi5', target: '[data-tour-type="openhw-pi5"]', title: 'New Board: Raspberry Pi 5' },
  { id: 'boards-esp32sc', target: '[data-tour-type="openhw-esp32sc"]', title: 'New Board: ESP32-S3 (esp32sc)' },
  { id: 'projects', target: '[data-tour-id="menu-file"]', title: 'Save Your Work' },
  { id: 'file-tabs', target: '[data-tour-step="ide"] .panel-scroll.hide-scrollbar', title: 'File Tabs & Extensions' },
  { id: 'ide', target: '[data-tour-step="ide"]', title: 'Integrated IDE' },
  { id: 'blockly', target: '[data-tour-step="blockly"]', title: 'Visual Block Coding' },
  { id: 'library', target: '[data-tour-step="library"]', title: 'Library Manager' },
  { id: 'schematic', target: '[data-tour-id="menu-item-schematic-view"]', title: 'Tool → Schematic View' },
  { id: 'help', target: '[data-tour-id="menu-help"]', title: 'Help Menu' },
  { id: 'run', target: '[data-tour-id="toolbar-run"]', title: 'Run & Compile' },
  { id: 'serial', target: '[data-tour-step="serial"]', title: 'Serial Monitor' },
  { id: 'plotter', target: '[data-tour-step="plotter"]', title: 'Real-time Plotter' },
  { id: 'console', target: '#tour-console-btn', title: 'System Console' },
  { id: 'finish', target: null, title: 'Ready to Create!' },
];

const SHOT_DIR = '/tmp/opencode/tour-shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

// Mirrors TourGuide's queryVisible(): a selector is only useful when its
// element is actually laid out and intersect the viewport.
const MEASURE = ({ target }) => {
  const usable = (el) => {
    if (!el || el.getClientRects().length === 0) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2 && r.right > 0 && r.bottom > 0 &&
      r.left < window.innerWidth && r.top < window.innerHeight;
  };
  const find = (selector) => {
    if (!selector) return null;
    for (const part of selector.split(',')) {
      for (const el of document.querySelectorAll(part.trim())) if (usable(el)) return el;
    }
    return null;
  };
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  };
  const describe = (el) => {
    if (!el) return null;
    // Report the selector from the expected step target that actually matched,
    // so an element carrying several data-* hooks is described unambiguously.
    for (const part of (target || '').split(',')) {
      const selector = part.trim();
      try {
        for (const candidate of document.querySelectorAll(selector)) {
          if (candidate === el) return {
            selector,
            tag: el.tagName,
            text: (el.textContent || '').trim().slice(0, 70),
          };
        }
      } catch {
        // Ignore malformed selectors — the next part may still match.
      }
    }
    return {
      selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
      tag: el.tagName,
      text: (el.textContent || '').trim().slice(0, 70),
    };
  };

  const tooltip = document.querySelector('.tour-tooltip');
  const spotlight = document.querySelector('.tour-spotlight');
  const pointerEl = document.querySelector('.tour-ghost-cursor');
  const el = find(target);
  const targetRect = rect(el);
  const spotlightRect = rect(spotlight);
  const pointerRect = rect(pointerEl);
  // The 48px SVG is centred on the computed point via transform: translate(-24,-24).
  const centre = pointerRect
    ? { x: pointerRect.x + pointerRect.w / 2, y: pointerRect.y + pointerRect.h / 2 }
    : null;
  const overlap = !!(spotlightRect && targetRect && centre &&
    centre.x >= Math.min(spotlightRect.x, targetRect.x) - 2 &&
    centre.x <= Math.max(spotlightRect.x + spotlightRect.w, targetRect.x + targetRect.w) + 2 &&
    centre.y >= Math.min(spotlightRect.y, targetRect.y) - 2 &&
    centre.y <= Math.max(spotlightRect.y + spotlightRect.h, targetRect.y + targetRect.h) + 2);

  return {
    stepId: tooltip?.getAttribute('data-tour-step-id') ?? null,
    actualDataTourTarget: spotlight?.getAttribute('data-tour-target') ?? null,
    tooltipDataTourTarget: tooltip?.getAttribute('data-tour-target') ?? null,
    actualTarget: describe(el),
    targetRect,
    spotlightRect,
    pointerRect,
    pointerCentre: centre,
    overlap,
    title: tooltip?.querySelector('#tour-title')?.textContent ?? null,
    text: tooltip?.querySelector('#tour-content')?.textContent ?? null,
    indicator: document.querySelector('.tour-steps-indicator')?.textContent ?? null,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
};

function coverage(spotlight, target) {
  if (!spotlight || !target || target.w <= 0 || target.h <= 0) return 0;
  const x = Math.max(0, Math.min(spotlight.x + spotlight.w, target.x + target.w) - Math.max(spotlight.x, target.x));
  const y = Math.max(0, Math.min(spotlight.y + spotlight.h, target.y + target.h) - Math.max(spotlight.y, target.y));
  return Math.min(1, (x * y) / (target.w * target.h));
}

function centreInside(centre, target, tolerance = 2) {
  if (!centre || !target) return false;
  return centre.x >= target.x - tolerance && centre.x <= target.x + target.w + tolerance &&
    centre.y >= target.y - tolerance && centre.y <= target.y + target.h + tolerance;
}

// One poll result per step: id, DOM target attribute, geometry coverage,
// pointer containment and the overlap flag are all checked together.
async function expectAttachedTo(page, step) {
  const expected = JSON.stringify({
    id: true, domTarget: true, selector: true, coverage: true, pointer: true, overlap: true,
  });
  await expect.poll(async () => {
    const m = await page.evaluate(MEASURE, step);
    return JSON.stringify({
      id: m.stepId === step.id,
      domTarget: m.actualDataTourTarget === step.target,
      selector: m.actualTarget?.selector === step.target,
      coverage: coverage(m.spotlightRect, m.targetRect) > 0.85,
      pointer: centreInside(m.pointerCentre, m.targetRect),
      overlap: m.overlap,
    });
  }, { timeout: 15000, message: `spotlight + pointer attached to ${step.id}` }).toBe(expected);
}

test.describe('Help → Start Tour', () => {
  test('walks every step with the correct highlight and pointer, then records completion', async ({ page }) => {
    test.setTimeout(240000);
    const errors = [];
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    // Unique IDs in the canonical list are a precondition for "no repeats".
    expect(new Set(STEPS.map(s => s.id)).size).toBe(STEPS.length);

    // Start from a completed state so this specifically exercises the Help
    // menu entry (the original bug: the tour refused to re-open from Help).
    await page.addInitScript(() => {
      localStorage.setItem('openhw-tour-completed', 'true');
      localStorage.removeItem('openhw_tour_completed');
    });
    await page.goto('/simulator');
    await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeVisible();
    await expect(page.locator('.tour-tooltip')).toHaveCount(0);

    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await page.getByRole('button', { name: 'Start Tour' }).click();
    await expect(page.locator('.tour-tooltip')).toBeVisible();
    await expect(page.locator('.tour-tooltip')).toHaveAttribute('data-tour-step-id', 'welcome');

    const segmentCount = await page.locator('.tour-progress-segment').count();
    expect(segmentCount, 'expected one progress segment per tour step').toBe(STEPS.length);

    const evidence = [];
    const seen = [];
    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i];
      const tooltip = page.locator('.tour-tooltip');
      await expect(tooltip).toHaveAttribute('data-tour-step-id', step.id);
      await expect(tooltip).toHaveAttribute('data-tour-target', step.target ?? '');
      await expect(tooltip.locator('h3')).toHaveText(step.title);
      await expect(page.locator('.tour-steps-indicator')).toHaveText(`${i + 1} / ${STEPS.length}`);
      seen.push(await tooltip.getAttribute('data-tour-step-id'));

      if (step.target) {
        await expect(page.locator('.tour-spotlight')).toHaveAttribute('data-tour-target', step.target);
        await expectAttachedTo(page, step);

        // ── Disturbances: geometry must be re-measured, not frozen ──────
        if (step.id === 'run') {
          await page.mouse.move(720, 450);
          await page.mouse.wheel(0, 240);
          await expectAttachedTo(page, step);
          await page.setViewportSize({ width: 1280, height: 800 });
          await expectAttachedTo(page, step);
          await page.setViewportSize({ width: 1440, height: 900 });
          await expectAttachedTo(page, step);

          const themeBtn = page.locator('button[title="Switch to Light Mode"], button[title="Switch to Dark Mode"]').first();
          const themeBefore = await themeBtn.getAttribute('title');
          await themeBtn.click();
          await expect(page.locator('button[title="Switch to Light Mode"], button[title="Switch to Dark Mode"]').first())
            .not.toHaveAttribute('title', themeBefore);
          await expectAttachedTo(page, step);

          await page.locator('[data-tour-id="palette-panel"]').hover();
          await page.waitForTimeout(500);
          await expectAttachedTo(page, step);
          await page.mouse.move(720, 450);
          await page.waitForTimeout(500);
          await expectAttachedTo(page, step);
        }
      } else {
        await expect(page.locator('.tour-spotlight')).toHaveCount(0);
      }

      // Let CSS transitions settle so the screenshot shows the final position.
      await page.waitForTimeout(500);
      const m = await page.evaluate(MEASURE, step);
      const shot = path.join(SHOT_DIR, `${String(i).padStart(2, '0')}-${step.id}.png`);
      await page.screenshot({ path: shot });
      evidence.push({
        index: i,
        expectedStepId: step.id,
        expectedTarget: step.target,
        actualStepId: m.stepId,
        actualDataTourTarget: m.actualDataTourTarget,
        actualTarget: m.actualTarget,
        targetBox: m.targetRect,
        spotlightBox: m.spotlightRect,
        pointerBox: m.pointerRect,
        pointerCentre: m.pointerCentre,
        overlap: m.overlap,
        coverage: coverage(m.spotlightRect, m.targetRect),
        title: m.title,
        text: m.text,
        indicator: m.indicator,
        screenshot: shot,
      });
      console.log(`tour-step ${i}: ${JSON.stringify(evidence[evidence.length - 1])}`);

      await tooltip.getByRole('button', {
        name: i === STEPS.length - 1 ? 'Finish tour' : 'Go to next step',
      }).click();
    }

    expect(seen, 'tour steps must appear in order with no skips or repeats').toEqual(STEPS.map(s => s.id));
    fs.writeFileSync(path.join(SHOT_DIR, 'evidence.json'), JSON.stringify(evidence, null, 2));

    await expect.poll(() => page.evaluate(() => localStorage.getItem('openhw-tour-completed'))).toBe('true');
    await expect(page.locator('.tour-tooltip')).toHaveCount(0);
    await expect(page.locator('.tour-spotlight')).toHaveCount(0);

    // Tour demo artefacts must not be left behind.
    await expect(page.locator('[data-tour-step="library"]')).toHaveCount(0);
    await expect(page.locator('[id*="demo-comp-tour"]')).toHaveCount(0);

    // Completion survives a reload: no automatic restart on the next visit.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.locator('.tour-tooltip')).toHaveCount(0);
    await expect(page.locator('.tour-spotlight')).toHaveCount(0);
    await expect(page.locator('.tour-ghost-cursor')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('openhw-tour-completed'))).toBe('true');

    expect(errors, `page/console errors during tour:\n${errors.join('\n')}`).toEqual([]);
  });

  test('does not auto-start again after the completion flag is set', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    await page.addInitScript(() => localStorage.setItem('openhw-tour-completed', 'true'));
    await page.goto('/simulator');
    await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeVisible();
    await page.waitForTimeout(1200);

    await expect(page.locator('.tour-tooltip')).toHaveCount(0);
    await expect(page.locator('.tour-spotlight')).toHaveCount(0);
    await expect(page.locator('.tour-ghost-cursor')).toHaveCount(0);

    // But the Help entry can still launch a fresh tour on demand.
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await page.getByRole('button', { name: 'Start Tour' }).click();
    await expect(page.locator('.tour-tooltip')).toHaveAttribute('data-tour-step-id', 'welcome');
    await expect(page.locator('.tour-steps-indicator')).toHaveText(`1 / ${STEPS.length}`);
    expect(errors).toEqual([]);
  });
});
