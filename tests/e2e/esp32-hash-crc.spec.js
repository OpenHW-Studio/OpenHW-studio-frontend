import { test, expect } from '@playwright/test';

// ESP32 software crypto + CRC (DevKit): mbedtls SHA-256 of "abc" (known
// digest ba7816bf...15ad) and a bitwise CRC32 of "123456789" (0xCBF43926).
// Both execute on the emulated CPU with no peripheral, so no runner change.
// Hardware AES/RSA/SHA acceleration has no SAB tap (matrix stays NONE).
const CODE = '#include "mbedtls/sha256.h"\nuint32_t crc32(const uint8_t *d,int n){uint32_t c=0xFFFFFFFF;for(int i=0;i<n;i++){c^=d[i];for(int k=0;k<8;k++)c=(c>>1)^(0xEDB88320&(0-(c&1)));}return ~c;}\nvoid setup(){Serial.begin(115200);Serial.println("HASH_READY");uint8_t out[32];mbedtls_sha256((const uint8_t*)"abc",3,out,0);Serial.print("ESP_SHA256:");for(int i=0;i<32;i++){if(out[i]<16)Serial.print("0");Serial.print(out[i],HEX);}Serial.println("");uint32_t c=crc32((const uint8_t*)"123456789",9);Serial.print("ESP_CRC32:");Serial.println(c,HEX);}\nvoid loop(){delay(2000);}\n';

test.describe('ESP32 software hash + CRC', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('SHA-256 and CRC32 match known vectors', async ({ page }) => {
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
      forMs: 30000, serialNeedle: 'ESP_CRC32:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPHASH reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPHASH serial:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    expect((verdict.serial || '').toLowerCase()).toContain('esp_sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect((verdict.serial || '').toUpperCase()).toContain('ESP_CRC32:CBF43926');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
