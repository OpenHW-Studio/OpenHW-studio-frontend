import { test, expect } from '@playwright/test';

// ESP32 TWAI (CAN 2.0): virtual-peer frame injected via sendTwaiFrame,
// received with the real ESP-IDF twai driver. No transceiver needed
// (RX direction only; TX needs an ACKing peer — documented gap).
test.describe('ESP32 TWAI (devkit CAN RX)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('receives an injected standard frame', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code: '#include \"driver/twai.h\"\nvoid setup(){Serial.begin(115200);Serial.println("CAN_READY");twai_general_config_t g=TWAI_GENERAL_CONFIG_DEFAULT((gpio_num_t)21,(gpio_num_t)22,TWAI_MODE_NORMAL);twai_timing_config_t t=TWAI_TIMING_CONFIG_500KBITS();twai_filter_config_t f=TWAI_FILTER_CONFIG_ACCEPT_ALL();if(twai_driver_install(&g,&t,&f)==ESP_OK){Serial.println("CAN_DRV_OK");}if(twai_start()==ESP_OK){Serial.println("CAN_START_OK");}}\nvoid loop(){twai_message_t m;if(twai_receive(&m,pdMS_TO_TICKS(100))==ESP_OK){Serial.print("CAN_RX:id=");Serial.print(m.identifier);Serial.print(",dlc=");Serial.print(m.data_length_code);Serial.print(",b0=");Serial.println(m.data[0]);}delay(200);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 120000, serialNeedle: 'CAN_START_OK', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAN reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('CAN serial:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('CAN_RX:id=291');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
