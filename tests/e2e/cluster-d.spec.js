import { test, expect } from '@playwright/test';

// Cluster D: newly-mapped sensor/radio models, all live with real backend
// firmware. I2C buses are shared per run (addresses never collide:
// MPU 0x68 + BMP 0x77 + ADXL 0x53; DS1307 solo on 0x68).
test.describe('Cluster D (IMU, baro, RTC, shift-RGB, charger, NTC, HX711, radios — live)', () => {
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    page.on('console', (msg) => {
      try {
        const t = `[${msg.type()}] ${msg.text()}`;
        if (/AVRRunner DBG|Received INTERACT|inst id=(mpu1|bmp1|adx1|rtc1|rgb1|nrfA|nrfB|ccA|ccB|hx1|ntc1|chg1|bt0) |\[SPI\] (nrf|ccA|ccB)/.test(t)) console.log('CAPTURED-WORKER:', t.slice(0, 500));
      } catch { /* ignore */ }
    });
  });

  async function boot(page, circuit) {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
    const setup = await page.evaluate(([c]) => window.OpenHWE2E.setupCircuit(c), [circuit]);
    expect(setup.ok).toBe(true);
  }

  test('MPU6050 (lib) + BMP180 (Wire) + ADXL345 (Wire) share one I2C bus', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 100 },
        { id: 'mpu1', type: 'openhw-mpu6050', attrs: {}, x: 400, y: 80 },
        { id: 'bmp1', type: 'openhw-bmp180-breakout', attrs: {}, x: 400, y: 170 },
        { id: 'adx1', type: 'openhw-adxl345', attrs: {}, x: 400, y: 260 },
      ],
      wires: [
        { from: 'uno1:5V', to: 'mpu1:VCC' },
        { from: 'uno1:gnd_1', to: 'mpu1:GND' },
        { from: 'uno1:A4', to: 'mpu1:SDA' },
        { from: 'uno1:A5', to: 'mpu1:SCL' },
        { from: 'uno1:gnd_1', to: 'mpu1:AD0' },
        { from: 'uno1:5V', to: 'bmp1:VIN' },
        { from: 'uno1:gnd_1', to: 'bmp1:GND' },
        { from: 'uno1:A4', to: 'bmp1:SDA' },
        { from: 'uno1:A5', to: 'bmp1:SCL' },
        { from: 'uno1:5V', to: 'adx1:VCC' },
        { from: 'uno1:gnd_1', to: 'adx1:GND' },
        { from: 'uno1:gnd_1', to: 'adx1:SDO' },
        { from: 'uno1:A4', to: 'adx1:SDA' },
        { from: 'uno1:A5', to: 'adx1:SCL' },
      ],
      code: '#include <Wire.h>\n#include <Adafruit_MPU6050.h>\n#include <Adafruit_Sensor.h>\nAdafruit_MPU6050 mpu;\nbyte i2cread(uint8_t addr,uint8_t reg){Wire.beginTransmission(addr);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(addr,(uint8_t)1);return Wire.read();}\nvoid setup(){Serial.begin(9600);Serial.println("IMU_READY");Wire.begin();delay(500);\nSerial.print("BMP:");Serial.println(i2cread(0x77,0xD0),HEX);\nWire.beginTransmission(0x53);Wire.write(0x2D);Wire.write(0x08);Wire.endTransmission();\nSerial.print("ADXL:");Serial.println(i2cread(0x53,0x00),HEX);\nif(!mpu.begin()){Serial.println("MPU_FAIL");}else{Serial.println("MPU_OK");}}\nvoid loop(){sensors_event_t a,g,t;mpu.getEvent(&a,&g,&t);Serial.print("AX:");Serial.print(a.acceleration.x);Serial.print(" AZ:");Serial.println(a.acceleration.z);delay(1500);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['mpu1', 'adx1'], serialNeedle: 'IMU_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    console.log('IMU serial:', JSON.stringify(serial.slice(0, 400)));
    console.log('ADX volts:', JSON.stringify(((verdict.telemetry || []).find((t) => t.id === 'adx1'))?.details?.state?.analogVoltages || {}));
    expect(serial).toContain('BMP:55');
    expect(serial).toContain('ADXL:E5');
    expect(serial).toContain('MPU_OK');
    const ax = Number(/AX:(-?[\d.]+)/.exec(serial)?.[1] ?? NaN);
    const az = Number(/AZ:(-?[\d.]+)/.exec(serial)?.[1] ?? NaN);
    expect(ax).toBeGreaterThan(-2); expect(ax).toBeLessThan(2);
    expect(az).toBeGreaterThan(8); expect(az).toBeLessThan(11.5);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('DS1307 ticks wall-clock seconds over raw Wire', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'rtc1', type: 'openhw-ds1307-rtc', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:5V', to: 'rtc1:VCC' },
        { from: 'uno1:gnd_1', to: 'rtc1:GND' },
        { from: 'uno1:A4', to: 'rtc1:SDA' },
        { from: 'uno1:A5', to: 'rtc1:SCL' },
      ],
      code: '#include <Wire.h>\nbyte rdsec(){Wire.beginTransmission(0x68);Wire.write(0x00);Wire.endTransmission(false);Wire.requestFrom(0x68,1);return Wire.read();}\nvoid setup(){Serial.begin(9600);Serial.println("RTC_READY");Wire.begin();Serial.print("T0:");Serial.println(rdsec(),HEX);delay(2200);Serial.print("T1:");Serial.println(rdsec(),HEX);}\nvoid loop(){Serial.println("RTC_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['rtc1'], serialNeedle: 'RTC_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    console.log('RTC serial:', JSON.stringify(serial.slice(0, 200)));
    const t0 = /T0:([0-9A-Fa-f]+)/.exec(serial)?.[1];
    const t1 = /T1:([0-9A-Fa-f]+)/.exec(serial)?.[1];
    expect(t0).toBeTruthy(); expect(t1).toBeTruthy();
    // Wall-clock seconds (BCD) must advance across the 2.2s gap.
    expect(t0).not.toBe(t1);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Charger + NTC + HX711: charge flag, divider volts, bit-banged grams', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 100 },
        { id: 'chg1', type: 'openhw-charger', attrs: {}, x: 400, y: 80 },
        { id: 'bt0', type: 'openhw-battery', attrs: {}, x: 560, y: 80 },
        { id: 'ntc1', type: 'openhw-ntc-thermistor', attrs: {}, x: 400, y: 180 },
        { id: 'hx1', type: 'openhw-hx711_5', attrs: { load: '2.5' }, x: 400, y: 280 },
      ],
      wires: [
        { from: 'uno1:5V', to: 'chg1:IN+' },
        { from: 'uno1:gnd_1', to: 'chg1:IN-' },
        { from: 'chg1:BAT+', to: 'bt0:VCC' },
        { from: 'chg1:BAT-', to: 'bt0:GND' },
        { from: 'uno1:5V', to: 'ntc1:VCC' },
        { from: 'uno1:gnd_1', to: 'ntc1:GND' },
        { from: 'ntc1:A0', to: 'uno1:A0' },
        { from: 'uno1:5V', to: 'hx1:VCC' },
        { from: 'uno1:gnd_1', to: 'hx1:GND' },
        { from: 'hx1:DT', to: 'uno1:2' },
        { from: 'hx1:SCK', to: 'uno1:3' },
      ],
      code: 'long readHX(){unsigned long t0=millis();while(digitalRead(2)==HIGH){if(millis()-t0>3000){Serial.println("HX_TIMEOUT");return -1;}}long v=0;for(int i=0;i<24;i++){digitalWrite(3,HIGH);delayMicroseconds(10);v=(v<<1)|digitalRead(2);digitalWrite(3,LOW);delayMicroseconds(10);}digitalWrite(3,HIGH);delayMicroseconds(10);digitalWrite(3,LOW);return v;}\nvoid setup(){Serial.begin(9600);Serial.println("CNK_READY");pinMode(3,OUTPUT);pinMode(2,INPUT);delay(500);Serial.print("NTC:");Serial.println(analogRead(A0));}\nvoid loop(){Serial.print("HX:");Serial.println(readHX());delay(1500);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['chg1', 'ntc1', 'hx1'], serialNeedle: 'CNK_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    console.log('CNK serial:', JSON.stringify(serial.slice(0, 300)));
    console.log('NTC volts:', JSON.stringify(((verdict.telemetry || []).find((t) => t.id === 'ntc1'))?.details?.state?.analogVoltages || {}));
    const ntc = Number(/NTC:(\d+)/.exec(serial)?.[1] ?? NaN);
    expect(ntc).toBeGreaterThan(480); expect(ntc).toBeLessThan(545);
    const hx = Number(/HX:(-?\d+)/.exec(serial)?.[1] ?? NaN);
    expect(hx).toBeGreaterThan(1000); expect(hx).toBeLessThan(1100);
    const chg = (verdict.liveOop || {}).chg1 || {};
    console.log('CHG liveOop:', JSON.stringify(chg).slice(0, 200));
    expect(chg.isCharging).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('NLSF595 latches SPI bytes to RGB outputs', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 100, y: 100 },
        { id: 'rgb1', type: 'openhw-nlsf595', attrs: {}, x: 450, y: 120 },
      ],
      wires: [
        { from: 'uno1:11', to: 'rgb1:MOSI' },
        { from: 'uno1:13', to: 'rgb1:SCK' },
        { from: 'uno1:10', to: 'rgb1:CS' },
        { from: 'uno1:5V', to: 'rgb1:VCC' },
        { from: 'uno1:gnd_1', to: 'rgb1:GND' },
      ],
      code: '#include <SPI.h>\nvoid setup(){Serial.begin(9600);Serial.println("NLSF_READY");SPI.begin();pinMode(10,OUTPUT);digitalWrite(10,HIGH);digitalWrite(10,LOW);SPI.transfer(0x00);SPI.transfer(0x00);SPI.transfer(0x07);digitalWrite(10,HIGH);Serial.println("NLSF_LAT");}\nvoid loop(){Serial.println("NLSF_TICK");delay(2000);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 14000, selectTelemetry: ['rgb1'], serialNeedle: 'NLSF_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const rgb = (verdict.liveOop || {}).rgb1 || {};
    console.log('NLSF liveOop:', JSON.stringify(rgb).slice(0, 200));
    expect(Number(rgb.r)).toBe(255);
    expect(Number(rgb.g)).toBe(255);
    expect(Number(rgb.b)).toBe(255);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('NRF24 TX→RX loopback across two radios on one bus', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 100 },
        { id: 'nrfA', type: 'openhw-nrf24l01', attrs: {}, x: 400, y: 80 },
        { id: 'nrfB', type: 'openhw-nrf24l01', attrs: {}, x: 400, y: 220 },
      ],
      wires: [
        { from: 'uno1:5V', to: 'nrfA:VCC' },
        { from: 'uno1:gnd_1', to: 'nrfA:GND' },
        { from: 'uno1:11', to: 'nrfA:MOSI' },
        { from: 'uno1:12', to: 'nrfA:MISO' },
        { from: 'uno1:13', to: 'nrfA:SCK' },
        { from: 'uno1:8', to: 'nrfA:CE' },
        { from: 'uno1:9', to: 'nrfA:CSN' },
        { from: 'uno1:5V', to: 'nrfB:VCC' },
        { from: 'uno1:gnd_1', to: 'nrfB:GND' },
        { from: 'uno1:11', to: 'nrfB:MOSI' },
        { from: 'uno1:12', to: 'nrfB:MISO' },
        { from: 'uno1:13', to: 'nrfB:SCK' },
        { from: 'uno1:7', to: 'nrfB:CE' },
        { from: 'uno1:6', to: 'nrfB:CSN' },
      ],
      code: '#include <SPI.h>\n#define CE_A 8\n#define CSN_A 9\n#define CE_B 7\n#define CSN_B 6\nvoid wreg(uint8_t csn,uint8_t r,uint8_t v){digitalWrite(csn,LOW);SPI.transfer(0x20|r);SPI.transfer(v);digitalWrite(csn,HIGH);}\nuint8_t rreg(uint8_t csn,uint8_t r){digitalWrite(csn,LOW);SPI.transfer(r);uint8_t v=SPI.transfer(0xFF);digitalWrite(csn,HIGH);return v;}\nvoid setup(){Serial.begin(9600);Serial.println("NRF_READY");SPI.begin();pinMode(CE_A,OUTPUT);pinMode(CSN_A,OUTPUT);pinMode(CE_B,OUTPUT);pinMode(CSN_B,OUTPUT);digitalWrite(CE_A,LOW);digitalWrite(CE_B,LOW);digitalWrite(CSN_A,HIGH);digitalWrite(CSN_B,HIGH);\nwreg(CSN_B,0x00,0x0B);digitalWrite(CE_B,HIGH);\nwreg(CSN_A,0x00,0x0A);\ndigitalWrite(CSN_A,LOW);SPI.transfer(0xA0);SPI.transfer(0xDE);SPI.transfer(0xAD);SPI.transfer(0xBE);SPI.transfer(0xEF);digitalWrite(CSN_A,HIGH);\ndigitalWrite(CE_A,HIGH);delayMicroseconds(30);digitalWrite(CE_A,LOW);\nSerial.println("NRF_TX");}\nvoid loop(){uint8_t st=rreg(CSN_B,0x07);if(st&0x40){digitalWrite(CSN_B,LOW);SPI.transfer(0x61);uint8_t b[4];for(int i=0;i<4;i++)b[i]=SPI.transfer(0xFF);digitalWrite(CSN_B,HIGH);Serial.print("NRF_RX:");for(int i=0;i<4;i++){if(b[i]<16)Serial.print("0");Serial.print(b[i],HEX);}Serial.println();delay(500);}else{Serial.println("NRF_WAIT");delay(500);}}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['nrfB'], serialNeedle: 'NRF_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    console.log('NRF serial:', JSON.stringify(serial.slice(0, 300)));
    expect(serial).toContain('NRF_TX');
    expect(serial).toContain('NRF_RX:DEADBEEF');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('CC1101 TX→RX loopback across two radios on one bus', async ({ page }) => {
    await boot(page, {
      components: [
        { id: 'uno1', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 100 },
        { id: 'ccA', type: 'openhw-cc1101', attrs: {}, x: 400, y: 80 },
        { id: 'ccB', type: 'openhw-cc1101', attrs: {}, x: 400, y: 220 },
      ],
      wires: [
        { from: 'uno1:5V', to: 'ccA:VCC' },
        { from: 'uno1:gnd_1', to: 'ccA:GND' },
        { from: 'uno1:11', to: 'ccA:MOSI' },
        { from: 'uno1:12', to: 'ccA:MISO' },
        { from: 'uno1:13', to: 'ccA:SCK' },
        { from: 'uno1:9', to: 'ccA:CSN' },
        { from: 'uno1:5V', to: 'ccB:VCC' },
        { from: 'uno1:gnd_1', to: 'ccB:GND' },
        { from: 'uno1:11', to: 'ccB:MOSI' },
        { from: 'uno1:12', to: 'ccB:MISO' },
        { from: 'uno1:13', to: 'ccB:SCK' },
        { from: 'uno1:6', to: 'ccB:CSN' },
      ],
      code: '#include <SPI.h>\n#define CSN_A 9\n#define CSN_B 6\nvoid strobe(uint8_t csn,uint8_t s){digitalWrite(csn,LOW);SPI.transfer(s);digitalWrite(csn,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("CC_READY");SPI.begin();pinMode(CSN_A,OUTPUT);pinMode(CSN_B,OUTPUT);digitalWrite(CSN_A,HIGH);digitalWrite(CSN_B,HIGH);\nstrobe(CSN_A,0x30);strobe(CSN_B,0x30);strobe(CSN_B,0x34);\ndigitalWrite(CSN_A,LOW);SPI.transfer(0x7F);SPI.transfer(0xCA);SPI.transfer(0xFE);digitalWrite(CSN_A,HIGH);\nstrobe(CSN_A,0x35);Serial.println("CC_TX");}\nvoid loop(){digitalWrite(CSN_B,LOW);SPI.transfer(0xFF);uint8_t b0=SPI.transfer(0xFF);uint8_t b1=SPI.transfer(0xFF);digitalWrite(CSN_B,HIGH);if(b0==0xCA&&b1==0xFE){Serial.println("CC_RX:CAFE");}else{Serial.println("CC_WAIT");}delay(500);}\n',
    });
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 16000, selectTelemetry: ['ccB'], serialNeedle: 'CC_READY', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    const serial = verdict.serial || '';
    console.log('CC serial:', JSON.stringify(serial.slice(0, 300)));
    expect(serial).toContain('CC_TX');
    expect(serial).toContain('CC_RX:CAFE');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
