import { test, expect } from '@playwright/test';

// Pico EXTI (IO_BANK0 edge interrupt): the guest drives GP12 as an OUTPUT
// and wires it back to GP13 (INPUT, RISING). The engine's OUT latch is
// published by the runner's output poll, the Pico runner's board-to-board
// fan-out (publishGpio override) pushes that level into the guest-visible
// IN latch of GP13, and the engine's gpio_set_input_pin runs the edge
// detector + NVIC signal -> the guest ISR must count the edges.
//
// Proof standard: the needle is the GUEST's own ISR counter
// (PICO_EXT_CNT / PICO2_EXT_CNT) — not a host-side "OK".
// A run with 0 edges proves the EXTI path is dead (engine-side).

const M0_CODE = 'volatile int cnt=0;\n'
  + 'void onEdge(){cnt++;}\n'
  + 'void setup(){Serial.begin(115200);pinMode(12,OUTPUT);digitalWrite(12,LOW);pinMode(13,INPUT);attachInterrupt(digitalPinToInterrupt(13),onEdge,RISING);Serial.println("PICO_EXT_READY");}\n'
  + 'void loop(){digitalWrite(12,HIGH);delay(60);digitalWrite(12,LOW);delay(300);Serial.print("PICO_EXT_CNT:");Serial.println(cnt);}\n';

const M33_CODE = 'volatile int cnt=0;\n'
  + 'void onEdge(){cnt++;}\n'
  + 'void setup(){Serial.begin(115200);pinMode(12,OUTPUT);digitalWrite(12,LOW);pinMode(13,INPUT);attachInterrupt(digitalPinToInterrupt(13),onEdge,RISING);Serial.println("PICO2_EXT_READY");}\n'
  + 'void loop(){digitalWrite(12,HIGH);delay(60);digitalWrite(12,LOW);delay(300);Serial.print("PICO2_EXT_CNT:");Serial.println(cnt);}\n';

async function extiCell(page, boardType, code, needle) {
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
      { from: 'pico1:GP12', to: 'pico1:GP13' },
    ],
    code,
  }), { boardType, code });
  expect(setup.ok).toBe(true);

  const verdict = await page.evaluate(() => window.OpenHWE2E.run({
    forMs: 20000, serialNeedle: 'READY', telemetryMode: 'detail',
  }));
  console.log('PICO-EXTI reasons:', JSON.stringify(verdict.reasons || []));
  console.log('PICO-EXTI serial:', (verdict.serial || '').slice(0, 400));
  expect(verdict.ok).toBe(true);
  expect(verdict.pass).toBe(true);
  const counts = [...(verdict.serial || '').matchAll(new RegExp(`${needle}:(\\d+)`, 'g'))].map((m) => Number(m[1]));
  console.log('PICO-EXTI counts:', JSON.stringify(counts.slice(0, 10)));
  expect(counts.length).toBeGreaterThan(0);
  expect(counts[counts.length - 1]).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => window.OpenHWE2E.stop());
  await page.waitForTimeout(1500);
}

test.describe('Pico EXTI (IO_BANK0 edge interrupt)', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('RP2040 GP12->GP13 loopback fires the RISING ISR', async ({ page }) => {
    await extiCell(page, 'openhw-pico', M0_CODE, 'PICO_EXT_CNT');
  });

  test('RP2350-M33 GP12->GP13 loopback fires the RISING ISR', async ({ page }) => {
    await extiCell(page, 'openhw-pico-2', M33_CODE, 'PICO2_EXT_CNT');
  });
});
