import { test, expect } from '@playwright/test';

// Pico GPIO-in (RP2040 / RP2350-M33): the host pushes an external level
// into the guest-visible IN latch and the guest must OBSERVE it.
//
// Why this cell exists: the engine's `_picoemu_set_gpio` writes the OUT
// latch only (engine gpio.c: gpio_set_pin -> gpio_state.gpio_out), which
// the guest ignores while the pin is an input, so every Pico input pin
// used to read stuck-at-1 (the IN latch reset default). The engine's
// `gpio_set_input_pin()` is the right entry point (IN latch + edge detect
// + NVIC) but had no export until patches/pico-in-latch-inject.patch.
// The runner (pico-runner.ts setGpioInput) now reaches it through
// `_picoemu_set_gpio_input` when the engine provides it, and otherwise
// through the engine's devtools script path ("0ms: gpio<n> <level>"),
// so this cell is green on both engine builds.
//
// Proof standard: the needle is the GUEST's own digitalRead() of the
// GND-wired pin (LOW) and the 3V3-wired pin (HIGH). A stuck-at-HIGH
// engine fails the LOW half, so the cell is a real discriminator.

const M0_CODE = 'void setup(){Serial.begin(115200);pinMode(13,INPUT);pinMode(14,INPUT);Serial.println("PICO_IN_READY");}\n'
  + 'void loop(){Serial.print("PICO_IN_LEVEL:");Serial.print(digitalRead(13));Serial.print(":");Serial.println(digitalRead(14));delay(300);}\n';

const M33_CODE = 'void setup(){Serial.begin(115200);pinMode(13,INPUT);pinMode(14,INPUT);Serial.println("PICO2_IN_READY");}\n'
  + 'void loop(){Serial.print("PICO2_IN_LEVEL:");Serial.print(digitalRead(13));Serial.print(":");Serial.println(digitalRead(14));delay(300);}\n';

async function gpioInCell(page, boardType, code, needle) {
  await page.addInitScript(() => {
    window.localStorage.setItem('openhw-tour-completed', 'true');
  });
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  const setup = await page.evaluate(({ boardType, code }) => window.OpenHWE2E.setupCircuit({
    components: [
      { id: 'pico1', type: boardType, attrs: {}, x: 100, y: 100 },
    ],
    wires: [
      // GND rail -> GP13 (must read LOW), 3V3 rail -> GP14 (must read HIGH)
      { from: 'pico1:GND', to: 'pico1:GP13' },
      { from: 'pico1:3V3', to: 'pico1:GP14' },
    ],
    code,
  }), { boardType, code });
  expect(setup.ok).toBe(true);

  const verdict = await page.evaluate(() => window.OpenHWE2E.run({
    forMs: 20000, serialNeedle: 'READY', telemetryMode: 'detail',
  }));
  console.log('PICO-GPIO-IN reasons:', JSON.stringify(verdict.reasons || []));
  console.log('PICO-GPIO-IN serial:', (verdict.serial || '').slice(0, 400));
  expect(verdict.ok).toBe(true);
  expect(verdict.pass).toBe(true);
  expect(verdict.serial || '').toContain(needle);
  // LOW half: GP13 is wired to GND -> the guest must read 0 (NOT the
  // stuck-at-1 reset default). HIGH half: GP14 on 3V3 -> 1.
  expect(verdict.serial || '').toMatch(new RegExp(`${needle}:0:1`));
  await page.evaluate(() => window.OpenHWE2E.stop());
  await page.waitForTimeout(1500);
}

test.describe('Pico GPIO-in (host inject -> guest digitalRead)', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('RP2040 reads GND-wired GP13 LOW and 3V3-wired GP14 HIGH', async ({ page }) => {
    await gpioInCell(page, 'openhw-pico', M0_CODE, 'PICO_IN_LEVEL');
  });

  test('RP2350-M33 reads GND-wired GP13 LOW and 3V3-wired GP14 HIGH', async ({ page }) => {
    await gpioInCell(page, 'openhw-pico-2', M33_CODE, 'PICO2_IN_LEVEL');
  });
});
