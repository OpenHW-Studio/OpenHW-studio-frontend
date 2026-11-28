import { test, expect } from '@playwright/test';

// ESP32 NVS + EEPROM (DevKit): Preferences (NVS partition) put/get roundtrip
// plus Arduino EEPROM-on-flash byte roundtrip. Both are guest-flash
// read/write paths needing no host tap (flash image persists in the sim),
// so no runner change. Magic values fail loudly on silent-write gaps.
const CODE_NVS = '#include <Preferences.h>\nvoid setup(){Serial.begin(115200);Serial.println("NVS_READY");Preferences p;p.begin("cell",false);p.putUInt("magic",0xCAFE1234);uint32_t v=p.getUInt("magic",0);p.end();Serial.print("ESP_NVS:");Serial.println(v,HEX);}\nvoid loop(){delay(2000);}\n';
const CODE_EEPROM = '#include <EEPROM.h>\nvoid setup(){Serial.begin(115200);Serial.println("EEPROM_READY");EEPROM.begin(16);EEPROM.write(0,0xA5);EEPROM.write(1,0x5A);EEPROM.commit();int a=EEPROM.read(0);int b=EEPROM.read(1);Serial.print("ESP_EEPROM:");Serial.print(a,HEX);Serial.print(",");Serial.println(b,HEX);}\nvoid loop(){delay(2000);}\n';

test.describe('ESP32 NVS + EEPROM', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Preferences NVS roundtrips a magic word', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE_NVS);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'ESP_NVS:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPNVS reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('ESPNVS serial:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('ESP_NVS:CAFE1234');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Arduino EEPROM roundtrips bytes', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
      ],
      wires: [],
      code,
    }), CODE_EEPROM);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'ESP_EEPROM:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('ESPEEPROM reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('ESP_EEPROM:A5,5A');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
