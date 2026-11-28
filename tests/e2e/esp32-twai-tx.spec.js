import { test, expect } from '@playwright/test';

// ESP32 TWAI-TX (guest transmit, DevKit pins 21/22): real ESP-IDF twai
// driver installs + starts, then twai_transmit sends one standard frame
// (id 0x123 = 291). Runner §E1 polls the virtual peer's getTwaiTx capture
// and surfaces new frames as HOST_TWAI_TX: — the cell asserts BOTH the
// firmware self-report (TWAI_TX_OK:291) AND the engine-observed capture
// with matching id. If twai_transmit never succeeds (no ACK from the
// peer) the cell fails loudly — that is the honest ACK answer, not a
// patch to fake it. RX direction stays covered by esp32-twai.spec.js.
const CODE = '#include "driver/twai.h"\nvoid setup(){Serial.begin(115200);Serial.println("TWAI_TX_READY");twai_general_config_t g=TWAI_GENERAL_CONFIG_DEFAULT((gpio_num_t)21,(gpio_num_t)22,TWAI_MODE_NORMAL);twai_timing_config_t t=TWAI_TIMING_CONFIG_500KBITS();twai_filter_config_t f=TWAI_FILTER_CONFIG_ACCEPT_ALL();if(twai_driver_install(&g,&t,&f)==ESP_OK){Serial.println("TWAI_DRV_OK");}else{Serial.println("TWAI_DRV_FAIL");return;}if(twai_start()==ESP_OK){Serial.println("TWAI_START_OK");}else{Serial.println("TWAI_START_FAIL");return;}twai_message_t tx;tx.identifier=0x123;tx.extd=0;tx.rtr=0;tx.data_length_code=4;tx.data[0]=0xDE;tx.data[1]=0xAD;tx.data[2]=0xBE;tx.data[3]=0xEF;for(int i=0;i<20;i++){if(twai_transmit(&tx,pdMS_TO_TICKS(200))==ESP_OK){Serial.println("TWAI_TX_OK:291");break;}Serial.println("TWAI_TX_RETRY");delay(500);}}\nvoid loop(){twai_message_t m;if(twai_receive(&m,pdMS_TO_TICKS(100))==ESP_OK){Serial.print("TWAI_RX:id=");Serial.println(m.identifier);}delay(500);}\n';

test.describe('ESP32 TWAI-TX (devkit guest transmit)', () => {
  test.setTimeout(600000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('guest transmit is captured by the virtual peer (host-observed)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 120000, serialNeedle: 'HOST_TWAI_TX:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('TWAITX reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('TWAITX serial:', JSON.stringify((verdict.serial || '').slice(0, 400)));
    expect(verdict.pass).toBe(true);
    // Firmware belt-and-braces + engine-observed proof, ids must match.
    expect(verdict.serial || '').toContain('TWAI_TX_OK:291');
    const m = /HOST_TWAI_TX:id=(\d+)/.exec(verdict.serial || '');
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBe(291);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
