import { test, expect } from '@playwright/test';

// INMP441 I2S mic (input direction, live): Uno bit-bangs WS/SCK and
// samples SD; the subclassed model mirrors SD into the board input via
// _driveBoardPin (package model alone never reaches PIN). Proof: real
// non-zero audio samples (440Hz fallback sine) on hardware Serial.
const CODE = 'const int WS=4,BCK=5,SDP=6;\nlong readSample(){digitalWrite(WS,LOW);long v=0;for(int i=0;i<32;i++){digitalWrite(BCK,LOW);delayMicroseconds(20);digitalWrite(BCK,HIGH);delayMicroseconds(20);int b=digitalRead(SDP);if(i>=1&&i<=24){v=(v<<1)|b;}}digitalWrite(WS,HIGH);return v;}\nvoid setup(){Serial.begin(9600);Serial.println("MIC_READY");pinMode(WS,OUTPUT);pinMode(BCK,OUTPUT);pinMode(SDP,INPUT);}\nvoid loop(){long s=readSample();Serial.print("MIC_S:");Serial.println(s);delay(347);}\n';

test.describe('AVR INMP441 mic', () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Uno samples INMP441 audio', async ({ page }) => {
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'mic1', type: 'openhw-inmp441', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:4', to: 'mic1:WS' },
        { from: 'uno1:5', to: 'mic1:SCK' },
        { from: 'uno1:6', to: 'mic1:SD' },
        { from: 'uno1:5V', to: 'mic1:VDD' },
        { from: 'uno1:GND', to: 'mic1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['mic1'], serialNeedle: 'MIC_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('MIC verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('MIC serial head:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const vals = [...(verdict.serial || '').matchAll(/MIC_S:(-?\d+)/g)].map((m) => Number(m[1]));
    console.log('MIC samples:', JSON.stringify(vals.slice(0, 8)));
    expect(vals.length).toBeGreaterThan(3);
    const peak = Math.max(...vals.map((v) => Math.abs(v)));
    console.log('MIC peak:', peak);
    expect(peak).toBeGreaterThan(1000);
    expect(new Set(vals).size).toBeGreaterThan(1);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
