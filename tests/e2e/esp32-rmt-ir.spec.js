import { test, expect } from '@playwright/test';

// ESP32 RMT-IR TX (guest→host NEC/raw capture, no DHT involved): real
// Arduino rmtWrite sends a 68-item NEC burst (leader + 32 data bits +
// stop, ×2 copies) on GPIO18 at 1MHz. Runner §E2 arms ch0/1 at wire
// time and drains guest→host captures as HOST_RMT_TX: — the cell asserts
// BOTH the firmware self-report (RMT_SENT) AND the engine-observed capture
// with words >= 60. Yields while rmtDhtArmed, so no DHT component is
// wired here (DHT path stays covered by esp32-dht22.spec.js).
const CODE = '#include <esp32-hal-rmt.h>\nvoid necFill(rmt_data_t*f,int o,uint8_t a,uint8_t c){f[o].duration0=9000;f[o].level0=1;f[o].duration1=4500;f[o].level1=0;uint32_t d=((uint32_t)a<<24)|((uint32_t)(~a&0xFF)<<16)|((uint32_t)c<<8)|(uint32_t)(~c&0xFF);for(int i=0;i<32;i++){int b=(d>>(31-i))&1;f[o+1+i].duration0=560;f[o+1+i].level0=1;f[o+1+i].duration1=b?1690:560;f[o+1+i].level1=0;}f[o+33].duration0=560;f[o+33].level0=1;f[o+33].duration1=0;f[o+33].level1=0;}\nvoid setup(){Serial.begin(115200);Serial.println("RMTIR_READY");if(!rmtInit(18,RMT_TX_MODE,RMT_MEM_NUM_BLOCKS_1,1000000)){Serial.println("RMT_INIT_FAIL");return;}rmtSetEOT(18,1);Serial.println("RMT_INIT_OK");static rmt_data_t frame[68];necFill(frame,0,0x00,0x16);necFill(frame,34,0x00,0x16);size_t n=rmtWrite(18,frame,68,3000);Serial.print("RMT_WROTE:");Serial.println((int)n);Serial.println("RMT_SENT");}\nvoid loop(){delay(5000);}\n';

test.describe('ESP32 RMT-IR TX (guest NEC burst, host capture)', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('NEC burst lands in the host RMT capture', async ({ page }) => {
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
      forMs: 60000, serialNeedle: 'HOST_RMT_TX:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('RMTIR reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('RMTIR serial:', JSON.stringify((verdict.serial || '').slice(0, 400)));
    expect(verdict.pass).toBe(true);
    // Firmware belt-and-braces + engine-observed proof (NEC ≈ 68 items).
    expect(verdict.serial || '').toContain('RMT_SENT');
    const m = /HOST_RMT_TX:ch=\d+,words=(\d+)/.exec(verdict.serial || '');
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBeGreaterThanOrEqual(60);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
