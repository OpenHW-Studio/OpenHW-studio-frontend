import { test, expect } from '@playwright/test';

// ESP32-CAM shell cells (AI-Thinker shell pins only: 12/13/15/14/2/4/16/0 +
// UART 1/3 + rails; NO 21/22/25/26/32-39 — TWAI/DAC/ADC1 are board-level
// NO-GOs, filed in the report). All firmware below uses shell pins only
// and the same engine taps as the DevKit cells. No runner change.
const HELLO = 'void setup(){Serial.begin(115200);Serial.println("CAM_HELLO");}\nvoid loop(){Serial.println("CAM_TICK");delay(1000);}\n';
const GPIOIN = 'void setup(){Serial.begin(115200);Serial.println("CAMGPIO_READY");pinMode(13,INPUT);pinMode(14,INPUT);}\nvoid loop(){Serial.print("CAMGPIO13=");Serial.print(digitalRead(13));Serial.print(" CAMGPIO14=");Serial.println(digitalRead(14));delay(500);}\n';
const PWM = 'void setup(){Serial.begin(115200);Serial.println("CAMPWM_READY");ledcAttach(2,5000,8);ledcWrite(2,128);Serial.println("CAMPWM_SET");}\nvoid loop(){Serial.println("CAMPWM_TICK");delay(2000);}\n';
const ONEWIRE = '#include <OneWire.h>\n#include <DallasTemperature.h>\nOneWire ow(15);DallasTemperature dt(&ow);\nvoid setup(){Serial.begin(115200);Serial.println("CAMOW_READY");dt.begin();}\nvoid loop(){dt.requestTemperatures();float t=dt.getTempCByIndex(0);Serial.print("CAMOW_T:");Serial.println(t);delay(2000);}\n';
const DHT = '#include <esp32-hal-rmt.h>\nvoid dread(){rmt_data_t start;start.duration0=1100;start.level0=0;start.duration1=30;start.level1=1;rmtWrite(14,&start,1,2000);rmt_data_t rx[96];size_t n=96;if(!rmtRead(14,rx,&n,4000)){Serial.println("CAMDHT_RDTIMEOUT");return;}Serial.print("CAMDHT_NSYM:");Serial.println((int)n);int hi=-1;for(size_t i=0;i+40<n;i++){if(rx[i].duration0==80&&rx[i].level0==0&&rx[i].duration1==80&&rx[i].level1==1){hi=i;break;}}if(hi<0){Serial.println("CAMDHT_NOHDR");return;}uint8_t d[5]={0,0,0,0,0};bool ok=true;for(int i=0;i<40;i++){rmt_data_t s=rx[hi+1+i];if(s.duration0!=50||s.level0!=0||s.level1!=1){ok=false;break;}if(s.duration1>=50)d[i/8]|=(uint8_t)(1<<(7-(i%8)));}if(!ok){Serial.println("CAMDHT_SHAPE");return;}uint8_t ck=(uint8_t)(d[0]+d[1]+d[2]+d[3]);if(ck!=d[4]){Serial.println("CAMDHT_CKSUM");return;}Serial.println("CAMDHT_READ");}\nvoid setup(){Serial.begin(115200);Serial.println("CAMDHT_READY");pinMode(14,OUTPUT);digitalWrite(14,HIGH);bool okt=rmtInit(14,RMT_TX_MODE,RMT_MEM_NUM_BLOCKS_1,1000000);Serial.print("CAMDHT_TX:");Serial.println(okt?1:0);rmtSetEOT(14,1);bool okr=rmtInit(14,RMT_RX_MODE,RMT_MEM_NUM_BLOCKS_1,1000000);Serial.print("CAMDHT_RX:");Serial.println(okr?1:0);dread();}\nvoid loop(){delay(15000);dread();}\n';
const I2COLED = '#include <Wire.h>\nvoid w(uint8_t a,uint8_t b){Wire.beginTransmission(0x3C);Wire.write(a);Wire.write(b);Wire.endTransmission();}\nvoid setup(){Serial.begin(115200);Serial.println("CAMOLED_READY");Wire.begin(13,14);w(0x00,0xAE);w(0x00,0xD5);w(0x00,0x80);w(0x00,0xA8);w(0x00,0x3F);w(0x00,0xD3);w(0x00,0x00);w(0x00,0x40);w(0x00,0x8D);w(0x00,0x14);w(0x00,0x20);w(0x00,0x00);w(0x00,0xA1);w(0x00,0xC8);w(0x00,0xDA);w(0x00,0x12);w(0x00,0x81);w(0x00,0xCF);w(0x00,0xD9);w(0x00,0xF1);w(0x00,0xDB);w(0x00,0x40);w(0x00,0xA4);w(0x00,0xA6);w(0x00,0xAF);Wire.beginTransmission(0x3C);Wire.write(0x40);for(int i=0;i<128;i++)Wire.write(0xFF);Wire.endTransmission();Serial.println("CAMOLED_DRAWN");}\nvoid loop(){Serial.println("CAMOLED_TICK");delay(2000);}\n';
const SPIMAX = '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(15,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(15,HIGH);}\nvoid setup(){Serial.begin(115200);Serial.println("CAMSPI_READY");SPI.begin(14,12,13,15);pinMode(15,OUTPUT);wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);Serial.println("CAMSPI_DRAWN");}\nvoid loop(){Serial.println("CAMSPI_TICK");delay(1000);}\n';

test.describe('ESP32-CAM shell cells', () => {
  test.setTimeout(400000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  async function setupCam(page, extraComponents, wires, code) {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    return page.evaluate(({ comps, wires, code }) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'cam1', type: 'openhw-esp32-cam', attrs: {}, x: 100, y: 100 },
        ...comps,
      ],
      wires,
      code,
    }), { comps: extraComponents, wires, code });
  }

  test('CAM UART hello', async ({ page }) => {
    const setup = await setupCam(page, [], [], HELLO);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 30000, serialNeedle: 'CAM_HELLO', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('CAM GPIO-in static HIGH/LOW', async ({ page }) => {
    const setup = await setupCam(page, [], [
      { from: 'cam1:3V3', to: 'cam1:13' },
      { from: 'cam1:GND.1', to: 'cam1:14' },
    ], GPIOIN);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 20000, serialNeedle: 'CAMGPIO_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAMGPIOIN serial:', (verdict.serial || '').slice(0, 200));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('CAMGPIO13=1');
    expect(verdict.serial || '').toContain('CAMGPIO14=0');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('CAM LEDC LED lights', async ({ page }) => {
    const setup = await setupCam(page, [
      { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 300, y: 120 },
      { id: 'led1', type: 'openhw-led', attrs: {}, x: 450, y: 120 },
    ], [
      { from: 'cam1:2', to: 'res1:p1' },
      { from: 'res1:p2', to: 'led1:A' },
      { from: 'led1:K', to: 'cam1:GND.1' },
    ], PWM);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 150000, selectTelemetry: ['led1'], serialNeedle: 'CAMPWM_SET', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAMPWM reasons:', JSON.stringify(verdict.reasons || []));
    expect(verdict.pass).toBe(true);
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('CAM 1-Wire DS18B20 reads', async ({ page }) => {
    const setup = await setupCam(page, [
      { id: 'ow1', type: 'openhw-ds18b20', attrs: { temperature: '25' }, x: 450, y: 120 },
    ], [
      { from: 'cam1:15', to: 'ow1:DQ' },
      { from: 'cam1:3V3', to: 'ow1:VCC' },
      { from: 'cam1:GND.1', to: 'ow1:GND' },
    ], ONEWIRE);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, serialNeedle: 'CAMOW_T:', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAMOW serial:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    const m = /CAMOW_T:([\d.]+)/.exec(verdict.serial || '');
    expect(m).toBeTruthy();
    expect(Math.abs(Number(m[1]) - 25)).toBeLessThan(1);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('CAM DHT22 over RMT reads', async ({ page }) => {
    const setup = await setupCam(page, [
      { id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 450, y: 120 },
    ], [
      { from: 'cam1:14', to: 'dht1:DATA' },
      { from: 'cam1:3V3', to: 'dht1:VCC' },
      { from: 'cam1:GND.1', to: 'dht1:GND' },
    ], DHT);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 60000, serialNeedle: 'CAMDHT_READ', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAMDHT serial:', (verdict.serial || '').slice(0, 300));
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('CAMDHT_READ');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('CAM I2C OLED draws', async ({ page }) => {
    const setup = await setupCam(page, [
      { id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 100 },
    ], [
      { from: 'cam1:13', to: 'oled1:SDA' },
      { from: 'cam1:14', to: 'oled1:SCL' },
      { from: 'cam1:3V3', to: 'oled1:VCC' },
      { from: 'cam1:GND.1', to: 'oled1:GND' },
    ], I2COLED);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 45000, selectTelemetry: ['oled1'], serialNeedle: 'CAMOLED_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    console.log('CAMOLED reasons:', JSON.stringify(verdict.reasons || []));
    expect(verdict.pass).toBe(true);
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    console.log('CAMOLED vramFill:', ocustom.vramFillPercentage);
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('CAM SPI MAX7219 shows digits', async ({ page }) => {
    const setup = await setupCam(page, [
      { id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 },
    ], [
      { from: 'cam1:13', to: 'mx1:DIN' },
      { from: 'cam1:14', to: 'mx1:CLK' },
      { from: 'cam1:15', to: 'mx1:CS' },
      { from: 'cam1:3V3', to: 'mx1:VCC' },
      { from: 'cam1:GND.1', to: 'mx1:GND' },
    ], SPIMAX);
    expect(setup.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 45000, selectTelemetry: ['mx1'], serialNeedle: 'CAMSPI_DRAWN', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    console.log('CAMSPI custom:', JSON.stringify(custom).slice(0, 250));
    expect(custom.matrix?.[0]).toBe(0x7E);
    expect(custom.matrix?.[1]).toBe(0x30);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
