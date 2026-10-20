import { test, expect } from '@playwright/test';

// AVR bit-banged I2S → MAX98357 DAC (live): Uno toggles LRC/BCLK/DIN via
// digitalWrite; the runner's tickI2S edge decoder feeds onI2SFrame, which
// drives OUT+/- analog + frame counters. Human-senses proof: non-zero
// audio frames decoded from real pin wiggles (no I2S peripheral on AVR).
const CODE = 'const int LRC=4,BCLK=5,DIN=6;\nvoid wbit(uint8_t b){digitalWrite(DIN,b);digitalWrite(BCLK,HIGH);digitalWrite(BCLK,LOW);}\nvoid frame(uint16_t s){for(int i=15;i>=0;i--)wbit((s>>i)&1);}\nvoid setup(){Serial.begin(9600);Serial.println(\"I2S_READY\");pinMode(LRC,OUTPUT);pinMode(BCLK,OUTPUT);pinMode(DIN,OUTPUT);digitalWrite(LRC,LOW);for(int f=0;f<40;f++){digitalWrite(LRC,LOW);frame(0x4000);digitalWrite(LRC,HIGH);frame(0xC000);}Serial.println(\"I2S_FRAMES_SENT\");}\nvoid loop(){Serial.println(\"I2S_TICK\");delay(1000);}\n';

test.describe('AVR bit-banged I2S (MAX98357)', () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Uno I2S frames decode to DAC output', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'dac1', type: 'openhw-max98357', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:4', to: 'dac1:LRC' },
        { from: 'uno1:5', to: 'dac1:BCLK' },
        { from: 'uno1:6', to: 'dac1:DIN' },
        { from: 'uno1:5V', to: 'dac1:VIN' },
        { from: 'uno1:GND', to: 'dac1:GND' },
      ],
      code,
    }), CODE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, selectTelemetry: ['dac1'], serialNeedle: 'I2S_FRAMES_SENT', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('I2S verdict:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    expect(verdict.pass).toBe(true);
    const dac = (verdict.telemetry || []).find((t) => t.id === 'dac1');
    console.log('DAC liveOop:', JSON.stringify((verdict.liveOop || {}).dac1 || {}).slice(0, 500));
    const st = (verdict.liveOop || {}).dac1 || {};
    const frames = Number(st.totalFrameCount || 0);
    console.log('I2S totalFrameCount:', frames, 'peak:', st.peakAmplitude);
    expect(frames).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
