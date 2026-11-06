import { test, expect } from '@playwright/test';

// ESP32 1-Wire (DS18B20 on GPIO15): engine-side sensor (attachOneWire +
// setOneWireTemp) read with the real DallasTemperature + OneWire libs.
test.describe('ESP32 1-Wire (devkit DS18B20)', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('reads 25C scratchpad over 1-Wire', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/OW diag/i.test(t)) console.log('CAPTURED-DIAG:', t.slice(0, 160));
      } catch { /* ignore */ }
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'esp1', type: 'openhw-esp32', attrs: {}, x: 100, y: 100 },
        { id: 'ow1', type: 'openhw-ds18b20', attrs: { temperature: '25' }, x: 450, y: 120 },
      ],
      wires: [
        { from: 'esp1:GPIO15', to: 'ow1:DQ' },
        { from: 'esp1:3V3', to: 'ow1:VCC' },
        { from: 'esp1:GND', to: 'ow1:GND' },
      ],
      code: '#define OW_PIN 15\nstatic inline void owLow(){pinMode(OW_PIN,OUTPUT);digitalWrite(OW_PIN,LOW);}\nstatic inline void owRel(){pinMode(OW_PIN,INPUT);}\nvoid owWBit(int b){owLow();if(b){delayMicroseconds(6);owRel();delayMicroseconds(64);}else{delayMicroseconds(65);owRel();delayMicroseconds(5);}}\nvoid owW(uint8_t v){for(int i=0;i<8;i++)owWBit((v>>i)&1);}\nint owRBit(){owLow();delayMicroseconds(3);owRel();delayMicroseconds(12);int v=digitalRead(OW_PIN);delayMicroseconds(55);return v;}\nuint8_t owR(){uint8_t v=0;for(int i=0;i<8;i++)v|=(uint8_t)(owRBit()<<i);return v;}\nbool owReset(){owLow();delayMicroseconds(500);owRel();delayMicroseconds(70);int p=digitalRead(OW_PIN);delayMicroseconds(430);return p==0;}\nvoid setup(){Serial.begin(115200);Serial.println("OW_READY");}\nvoid loop(){if(!owReset()){Serial.println("OW_NOPRESENCE");delay(1000);return;}owW(0xCC);owW(0x44);delay(800);if(!owReset()){Serial.println("OW_NOPRESENCE2");delay(1000);return;}owW(0xCC);owW(0xBE);uint8_t sp[9];for(int i=0;i<9;i++)sp[i]=owR();int16_t raw=(sp[1]<<8)|sp[0];float t=raw/16.0;Serial.print("OW_TEMP:");Serial.println(t);delay(1000);}\n',
    }));
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, selectTelemetry: ['ow1'], serialNeedle: 'OW_TEMP:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('OW reasons:', JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
    console.log('OW serial:', JSON.stringify((verdict.serial || '').slice(0, 300)));
    expect(verdict.pass).toBe(true);
    const temps = [...(verdict.serial || '').matchAll(/OW_TEMP:(-?[\d.]+)/g)].map((m) => Number(m[1]));
    console.log('OW temps:', JSON.stringify(temps.slice(0, 6)));
    expect(temps.length).toBeGreaterThan(0);
    for (const t of temps.slice(0, 4)) expect(Math.abs(t - 25)).toBeLessThan(1.5);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
