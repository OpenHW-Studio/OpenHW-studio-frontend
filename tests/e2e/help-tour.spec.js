import { test, expect } from '@playwright/test';

// Canonical step order from TourGuide.jsx. Keeping the expectations here (as
// opposed to reading them from the DOM under test) means the assertions still
// fail if the tour highlights the wrong element.
const STEPS = [
  { id: 'welcome', target: null },
  { id: 'quick-add', target: '[data-tour-id="tour-canvas"]' },
  { id: 'drag-demo', target: '[data-tour-id="tour-canvas"]' },
  { id: 'wiring', target: '[data-tour-id="tour-canvas"]' },
  { id: 'autowiring', target: '[data-tour-id="tour-canvas"]' },
  { id: 'components-palette', target: '[data-tour-id="palette-panel"]' },
  { id: 'projects', target: '[data-tour-id="menu-file"]' },
  { id: 'ide', target: '[data-tour-step="ide"]' },
  { id: 'blockly', target: '[data-tour-step="blockly"]' },
  { id: 'library', target: '[data-tour-step="library"]' },
  { id: 'serial', target: '[data-tour-step="serial"]' },
  { id: 'plotter', target: '[data-tour-step="plotter"]' },
  { id: 'console', target: '#tour-console-btn' },
  { id: 'finish', target: null },
];

async function rectOf(locator) {
  if (await locator.count() === 0) return null;
  return locator.first().evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

// Fraction of the target's area that lies inside the spotlight. The spotlight
// is padded, so a correct highlight yields ~1 (clamped).
function coverage(spotlight, target) {
  if (!spotlight || !target || target.w <= 0 || target.h <= 0) return 0;
  const x = Math.max(0, Math.min(spotlight.x + spotlight.w, target.x + target.w) - Math.max(spotlight.x, target.x));
  const y = Math.max(0, Math.min(spotlight.y + spotlight.h, target.y + target.h) - Math.max(spotlight.y, target.y));
  return Math.min(1, (x * y) / (target.w * target.h));
}

function pointerCentreInside(pointer, target) {
  if (!pointer || !target) return false;
  const cx = pointer.x + pointer.w / 2;
  const cy = pointer.y + pointer.h / 2;
  return cx >= target.x - 2 && cx <= target.x + target.w + 2 &&
         cy >= target.y - 2 && cy <= target.y + target.h + 2;
}

async function expectAttachedTo(page, targetSelector) {
  const target = page.locator(targetSelector).first();
  await expect(target).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => coverage(await rectOf(page.locator('.tour-spotlight')), await rectOf(target)), {
    timeout: 10000,
  }).toBeGreaterThan(0.85);
  await expect.poll(async () => pointerCentreInside(
    await rectOf(page.locator('.tour-ghost-cursor')),
    await rectOf(target),
  ), { timeout: 10000 }).toBe(true);
}

test.describe('Help → Start Tour', () => {
  test('walks every step with the correct highlight and pointer, then records completion', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

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

    for (let i = 0; i < STEPS.length; i++) {
      const { id, target } = STEPS[i];
      const tooltip = page.locator('.tour-tooltip');
      await expect(tooltip).toHaveAttribute('data-tour-step-id', id);
      await expect(tooltip).toHaveAttribute('data-tour-target', target ?? '');
      await expect(page.locator('.tour-steps-indicator')).toHaveText(`${i + 1} / ${STEPS.length}`);

      if (target) {
        await expect(page.locator('.tour-spotlight')).toHaveAttribute('data-tour-target', target);
        await expectAttachedTo(page, target);
      } else {
        await expect(page.locator('.tour-spotlight')).toHaveCount(0);
      }

      // Prove the spotlight/pointer are re-measured, not frozen at step entry:
      // change the viewport and scroll, then re-check attachment.
      if (id === 'quick-add') {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.mouse.wheel(0, 120);
        await expectAttachedTo(page, target);
        await page.setViewportSize({ width: 1440, height: 900 });
        await expectAttachedTo(page, target);
      }

      await tooltip.getByRole('button', {
        name: i === STEPS.length - 1 ? 'Finish tour' : 'Go to next step',
      }).click();
    }

    await expect.poll(() => page.evaluate(() => localStorage.getItem('openhw-tour-completed'))).toBe('true');
    await expect(page.locator('.tour-tooltip')).toHaveCount(0);
    await expect(page.locator('.tour-spotlight')).toHaveCount(0);

    // Tour demo artefacts must not be left behind.
    await expect(page.locator('[data-tour-step="library"]')).toHaveCount(0);
    await expect(page.locator('[id*="demo-comp-tour"]')).toHaveCount(0);

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
    await expect(page.locator('.tour-steps-indicator')).toHaveText('1 / 14');
    expect(errors).toEqual([]);
  });
});
