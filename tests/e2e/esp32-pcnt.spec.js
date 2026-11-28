import { test, expect } from '@playwright/test';

// ESP32 PCNT (DevKit): pulse-counter unit 0 counts firmware-driven pulses
// on GPIO12 looped to GPIO13 (board-to-self wire, same as the EXTI cell).
// PCNT + GPIO matrix are engine-internal (native_pcnt_init/reset in the
// wasm; PCNT matrix signals in worker-entry.js), so no runner change.
// UNPROBED RISK: if the engine does not route the GPIO-matrix loopback
// into the PCNT input, the count stays 0 and this fails loudly (no fake).
const CODE = '#include "driver/pcnt.h"\nvoid setup(){Serial.begin(115200);Serial.println("PCNT_READY");pinMode(12,OUTPUT);digitalWrite(12,LOW);pcnt_config_t c={};c.pulse_gpio_num=13;c.ctrl_gpio_num=PCNT_PIN_NOT_USED;c.channel=PCNT_CHANNEL_0;c.unit=PCNT_UNIT_0;c.pos_mode=PCNT_COUNT_INC;c.neg_mode=PCNT_COUNT_DIS;c.lctrl_mode=PCNT_MODE_KEEP;c.hctrl_mode=PCNT_MODE_KEEP;c.counter_h_lim=1000;c.counter_l_lim=-1000;pcnt_unit_config(&c);pcnt_counter_pause(PCNT_UNIT_0);pcnt_counter_clear(PCNT_UNIT_0);pcnt_counter_resume(PCNT_UNIT_0);}\nvoid loop(){for(int i=0;i<5;i++){digitalWrite(12,HIGH);delay(40);digitalWrite(12,LOW);delay(40);}int16_t v=0;pcnt_get_counter_value(PCNT_UNIT_0,&v);Serial.print("PCNT_COUNT:");Serial.println((int)v);delay(1000);}\n';

test.describe('ESP32 PCNT pulse counter', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('PCNT counts looped-back pulses', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [
        { from: 'esp1:12', to: 'esp1:13' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, serialNeedle: 'PCNT_COUNT:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPPCNT reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPPCNT serial:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const counts = [...(verdict.serial || '').matchAll(/PCNT_COUNT:(-?\d+)/g)].map((m) => Number(m[1]));
    console.log('ESPPCNT counts:', JSON.stringify(counts.slice(0, 8)));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts[counts.length - 1]).toBeGreaterThanOrEqual(5);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
