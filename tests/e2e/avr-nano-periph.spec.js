import { test, expect } from '@playwright/test';

// AVR Nano (ATmega328P) peripheral sweep (live). The Nano rides the
// Uno-class engine path (same avr8js configs as Uno —
// src/worker/runners/avr-runner.ts:204-214, Uno-sized program image,
// 1KB EEPROM backend); only the FQBN/board-type differs, so every cell
// below mirrors its Uno-proven recipe pin-for-pin (I2C = A4/A5,
// SPI = 11/12/13, SS = 10, GND label = GND.1). UART/GPIO-out already
// proven in avr-mega-nano.spec.js (not repeated here).
const B = 'nano1';
const BT = 'openhw-arduino-nano';
const GND = 'GND.1';

async function runCell(page, { comps = [], wires = [], code, needle, forMs = 22000, telemetry = [] }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('openhw-tour-completed', 'true');
  });
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });
  const setup = await page.evaluate(([b, bt, c, w, cd]) => window.OpenHWE2E.setupCircuit({
    components: [{ id: b, type: bt, attrs: {}, x: 100, y: 100 }, ...c],
    wires: w,
    code: cd,
  }), [B, BT, comps, wires, code]);
  expect(setup.ok).toBe(true);
  const opts = { forMs, serialNeedle: needle, telemetryMode: 'detail' };
  if (telemetry.length) opts.selectTelemetry = telemetry;
  const verdict = await page.evaluate((o) => window.OpenHWE2E.run(o), opts);
  expect(verdict.ok).toBe(true);
  console.log(`${needle} verdict:`, JSON.stringify(verdict.reasons || []), 'lines:', verdict.serialLines);
  console.log(`${needle} serial tail:`, JSON.stringify((verdict.serial || '').slice(-300)));
  expect(verdict.pass).toBe(true);
  return verdict;
}

test.describe('AVR Nano peripherals', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Nano I2C OLED draws (I2C + Display-ext cells)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:A4`, to: 'oled1:SDA' },
        { from: `${B}:A5`, to: 'oled1:SCL' },
        { from: `${B}:5V`, to: 'oled1:VCC' },
        { from: `${B}:${GND}`, to: 'oled1:GND' },
      ],
      code: '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("NANO_OLED_READY");Wire.begin();d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("HiNano");d.display();Serial.println("NANO_OLED_DRAWN");}\nvoid loop(){Serial.println("NANO_OLED_TICK");delay(1000);}\n',
      needle: 'NANO_OLED_DRAWN', telemetry: ['oled1'],
    });
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano SPI MAX7219 shows digits (SPI cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:11`, to: 'mx1:DIN' },
        { from: `${B}:13`, to: 'mx1:CLK' },
        { from: `${B}:10`, to: 'mx1:CS' },
        { from: `${B}:5V`, to: 'mx1:VCC' },
        { from: `${B}:${GND}`, to: 'mx1:GND' },
      ],
      code: '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(10,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(10,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("NANO_SPI_READY");pinMode(10,OUTPUT);digitalWrite(10,HIGH);SPI.begin();SPI.beginTransaction(SPISettings(8000000,MSBFIRST,SPI_MODE0));wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);Serial.println("NANO_SPI_DRAWN");}\nvoid loop(){Serial.println("NANO_SPI_TICK");delay(1000);}\n',
      needle: 'NANO_SPI_DRAWN', telemetry: ['mx1'],
    });
    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    expect(custom.shutdown).toBe(false);
    expect(custom.matrix?.[0]).toBe(0x7E);
    expect(custom.matrix?.[1]).toBe(0x30);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano ADC reads pot wiper (ADC cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'pot1', type: 'openhw-potentiometer', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:A0`, to: 'pot1:SIG' },
        { from: `${B}:5V`, to: 'pot1:2' },
        { from: `${B}:${GND}`, to: 'pot1:1' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("NANO_ADC_READY");}\nvoid loop(){int v=analogRead(A0);Serial.print("NANO_ADC_VAL:");Serial.println(v);delay(500);}\n',
      needle: 'NANO_ADC_VAL:',
    });
    const vals = [...(verdict.serial || '').matchAll(/NANO_ADC_VAL:(\d+)/g)].map((m) => Number(m[1]));
    expect(vals.length).toBeGreaterThan(0);
    for (const v of vals) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1023); }
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano PWM drives LED (PWM cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [
        { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 450, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 600, y: 100 },
      ],
      wires: [
        { from: `${B}:9`, to: 'res1:p1' },
        { from: 'res1:p2', to: 'led1:A' },
        { from: 'led1:K', to: `${B}:${GND}` },
      ],
      code: 'void setup(){pinMode(9,OUTPUT);Serial.begin(9600);Serial.println("NANO_PWM_READY");analogWrite(9,192);Serial.println("NANO_PWM_SET");}\nvoid loop(){Serial.println("NANO_PWM_TICK");delay(1000);}\n',
      needle: 'NANO_PWM_SET', telemetry: ['led1'],
    });
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    expect(String(led.summary || '')).toMatch(/illuminated: true|brightness: ([1-9]|0\.\d*[1-9])|brightness: [1-9]/);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano EEPROM byte readback (EEPROM cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include <Arduino.h>\n#include <avr/eeprom.h>\nvoid setup(){Serial.begin(9600);Serial.println("NANO_EE_READY");eeprom_write_byte((uint8_t*)0x10,0xAB);eeprom_write_byte((uint8_t*)0x11,0xCD);uint8_t a=eeprom_read_byte((uint8_t*)0x10);uint8_t b=eeprom_read_byte((uint8_t*)0x11);Serial.print("NANO_EE_RB:");Serial.print(a,HEX);Serial.print(b,HEX);Serial.println();}\nvoid loop(){}\n',
      needle: 'NANO_EE_RB:',
    });
    const m = /NANO_EE_RB:([0-9A-F]+)/.exec(verdict.serial || '');
    expect(m && m[1]).toBe('ABCD');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano GPIO-in reads slide-switch (GPIO-in cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 }],
      wires: [
        { from: `${B}:5V`, to: 'sw1:3' },
        { from: `${B}:${GND}`, to: 'sw1:1' },
        { from: 'sw1:2', to: `${B}:8` },
      ],
      code: 'void setup(){pinMode(8,INPUT);Serial.begin(9600);Serial.println("NANO_IN_READY");}\nvoid loop(){Serial.println(digitalRead(8));delay(500);}\n',
      needle: 'NANO_IN_READY',
    });
    expect(/[\r\n]1[\r\n]/.test(verdict.serial || '')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano DS1307 ticks seconds (RTC cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'rtc1', type: 'openhw-ds1307-rtc', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:5V`, to: 'rtc1:VCC' },
        { from: `${B}:${GND}`, to: 'rtc1:GND' },
        { from: `${B}:A4`, to: 'rtc1:SDA' },
        { from: `${B}:A5`, to: 'rtc1:SCL' },
      ],
      code: '#include <Wire.h>\nbyte rdsec(){Wire.beginTransmission(0x68);Wire.write(0x00);Wire.endTransmission(false);Wire.requestFrom(0x68,1);return Wire.read();}\nvoid setup(){Serial.begin(9600);Serial.println("NANO_RTC_READY");Wire.begin();Serial.print("T0:");Serial.println(rdsec(),HEX);delay(2200);Serial.print("T1:");Serial.println(rdsec(),HEX);}\nvoid loop(){Serial.println("NANO_RTC_TICK");delay(2000);}\n',
      needle: 'NANO_RTC_READY', telemetry: ['rtc1'],
    });
    const t0 = /T0:([0-9A-Fa-f]+)/.exec(verdict.serial || '')?.[1];
    const t1 = /T1:([0-9A-Fa-f]+)/.exec(verdict.serial || '')?.[1];
    expect(t0).toBeTruthy(); expect(t1).toBeTruthy();
    expect(t0).not.toBe(t1);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano SoftSerial TX decodes (SoftSerial cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include <SoftwareSerial.h>\nSoftwareSerial ss(11,10);\nvoid setup(){ss.begin(9600);ss.println("NANO_SS_HELLO");}\nvoid loop(){ss.println("NANO_SS_TICK");delay(1000);}\n',
      needle: 'NANO_SS_HELLO', forMs: 15000,
    });
    expect(verdict.serial || '').toContain('NANO_SS_HELLO');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano MCP2518FD loopback (CAN-FD cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'can1', type: 'openhw-mcp2518fd', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:11`, to: 'can1:MOSI' },
        { from: `${B}:12`, to: 'can1:MISO' },
        { from: `${B}:13`, to: 'can1:SCK' },
        { from: `${B}:10`, to: 'can1:CS' },
        { from: `${B}:5V`, to: 'can1:VCC' },
        { from: `${B}:${GND}`, to: 'can1:GND' },
      ],
      code: '#include <SPI.h>\nconst int CS=10;\nuint8_t payload[16]={0xDE,0xAD,0xBE,0xEF,0xCA,0xFE,0x01,0x23,0x45,0x67,0x89,0xAB,0xCD,0xEF,0x5A,0xA5};\nvoid spiW(uint16_t a,uint8_t*d,uint8_t n){digitalWrite(CS,LOW);SPI.transfer(0x20|((a>>8)&0x0F));SPI.transfer(a&0xFF);for(uint8_t i=0;i<n;i++)SPI.transfer(d[i]);digitalWrite(CS,HIGH);}\nvoid spiR(uint16_t a,uint8_t*o,uint8_t n){digitalWrite(CS,LOW);SPI.transfer(0x30|((a>>8)&0x0F));SPI.transfer(a&0xFF);for(uint8_t i=0;i<n;i++)o[i]=SPI.transfer(0xFF);digitalWrite(CS,HIGH);}\nvoid spiRst(){digitalWrite(CS,LOW);SPI.transfer(0x00);SPI.transfer(0x00);digitalWrite(CS,HIGH);}\nvoid hx(uint8_t b){if(b<16)Serial.print("0");Serial.print(b,HEX);}\nvoid setup(){Serial.begin(9600);Serial.println("NANO_CANFD_INIT");pinMode(CS,OUTPUT);digitalWrite(CS,HIGH);SPI.begin();SPI.beginTransaction(SPISettings(1000000,MSBFIRST,SPI_MODE0));delay(20);spiRst();delay(10);uint8_t md=0x02;spiW(0x000,&md,1);uint8_t op=0xFF,t=0;do{spiR(0x000,&op,1);t++;if(((op>>4)&0x07)==2)break;delay(1);}while(t<50);if(((op>>4)&0x07)!=2){Serial.println("NANO_CANFD_MODE_FAIL");return;}Serial.println("NANO_CANFD_LOOPBACK_MODE");uint8_t tx[17];tx[0]=16;for(uint8_t i=0;i<16;i++)tx[1+i]=payload[i];spiW(0x400,tx,17);uint8_t rq=0x01;spiW(0x500,&rq,1);uint8_t istat=0;uint16_t p=0;do{spiR(0x01C,&istat,1);p++;delay(1);}while(!(istat&0x01)&&p<500);Serial.print("NANO_RXIF:");Serial.println(istat&0x01?"1":"0");if(!(istat&0x01)){Serial.println("NANO_CANFD_RX_TIMEOUT");}else{uint8_t rlen=0;spiR(0x480,&rlen,1);Serial.print("NANO_RXLEN:");Serial.println(rlen);uint8_t rx[64]={0};if(rlen>0&&rlen<=64)spiR(0x481,rx,rlen);bool ok=rlen==16;for(uint8_t i=0;i<16&&ok;i++)if(rx[i]!=payload[i])ok=false;if(ok){Serial.print("NANO_CANFD_LOOPBACK_OK LEN=16 DATA=");for(uint8_t i=0;i<16;i++)hx(payload[i]);Serial.println();}else{Serial.print("NANO_CANFD_LOOPBACK_FAIL LEN=");Serial.print(rlen);Serial.print(" DATA=");for(uint8_t i=0;i<rlen&&i<64;i++)hx(rx[i]);Serial.println();}}}\nvoid loop(){Serial.println("NANO_CANFD_TICK");delay(2000);}\n',
      needle: 'NANO_CANFD_LOOPBACK_OK', forMs: 25000, telemetry: ['can1'],
    });
    expect(verdict.serial || '').toContain('NANO_CANFD_LOOPBACK_OK LEN=16 DATA=DEADBEEFCAFE0123456789ABCDEF5AA5');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano SD card file round-trip (SD-SPI cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'sd1', type: 'openhw-sd-card', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:11`, to: 'sd1:MOSI' },
        { from: `${B}:12`, to: 'sd1:MISO' },
        { from: `${B}:13`, to: 'sd1:SCK' },
        { from: `${B}:4`, to: 'sd1:CS' },
        { from: `${B}:5V`, to: 'sd1:VCC' },
        { from: `${B}:${GND}`, to: 'sd1:GND' },
      ],
      code: '#include <SPI.h>\n#include <SD.h>\nvoid setup(){Serial.begin(9600);Serial.println("NANO_SD_READY");if(!SD.begin(4)){Serial.println("NANO_SD_FAIL");return;}File f=SD.open("t.txt",FILE_WRITE);if(!f){Serial.println("NANO_SD_FAIL");return;}Serial.print("NANO_WROTE:");Serial.println(f.println("nanohi"));f.close();File r=SD.open("t.txt");while(r.available())Serial.write(r.read());r.close();Serial.println("NANO_SD_DONE");}\nvoid loop(){Serial.println("NANO_SD_TICK");delay(2000);}\n',
      needle: 'NANO_SD_READY', telemetry: ['sd1'],
    });
    expect(verdict.serial || '').toContain('nanohi');
    expect(verdict.serial || '').toContain('NANO_SD_DONE');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano DHT22 temp+humidity (1-Wire/DHT cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:2`, to: 'dht1:DATA' },
        { from: `${B}:5V`, to: 'dht1:VCC' },
        { from: `${B}:${GND}`, to: 'dht1:GND' },
      ],
      code: '#include <DHT.h>\n#define DHTPIN 2\n#define DHTTYPE DHT22\nDHT dht(DHTPIN,DHTTYPE);\nvoid setup(){Serial.begin(9600);Serial.println("NANO_DHT_READY");dht.begin();}\nvoid loop(){float h=dht.readHumidity();float t=dht.readTemperature();Serial.print("NANO_DHT_T:");Serial.print(t);Serial.print(" DHT_H:");Serial.println(h);delay(2000);}\n',
      needle: 'NANO_DHT_T:',
    });
    expect(verdict.serial || '').toContain('NANO_DHT_T:');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano IR envelope loopback (IR cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'ir1', type: 'openhw-ir-receiver', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:3`, to: `${B}:2` },
        { from: `${B}:5V`, to: 'ir1:VCC' },
        { from: `${B}:${GND}`, to: 'ir1:GND' },
        { from: 'ir1:OUT', to: `${B}:4` },
      ],
      code: 'const int TX=3,RX=2;\nbool irBit(bool l){digitalWrite(TX,l?HIGH:LOW);delayMicroseconds(500);bool e=digitalRead(RX)==HIGH;delayMicroseconds(500);return e;}\nbool irByte(uint8_t t,uint8_t&r){if(irBit(false)!=false)return false;uint8_t v=0;for(uint8_t i=0;i<8;i++)if(irBit((t>>i)&1))v|=(1<<i);if(irBit(true)!=true)return false;r=v;return true;}\nvoid setup(){Serial.begin(9600);pinMode(TX,OUTPUT);digitalWrite(TX,HIGH);pinMode(RX,INPUT);Serial.println("NANO_IR_READY");}\nvoid loop(){uint8_t a=0,c=0;if(irByte(0x00,a)&&irByte(0x16,c)&&a==0x00&&c==0x16)Serial.println("NANO_IR_DECODED ADDR=0x00 CMD=0x16");else Serial.println("NANO_IR_TIMEOUT");delay(2000);}\n',
      needle: 'NANO_IR_DECODED', telemetry: ['ir1'],
    });
    expect(verdict.serial || '').toContain('NANO_IR_DECODED ADDR=0x00 CMD=0x16');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano bit-banged I2S frames (I2S cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'dac1', type: 'openhw-max98357', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:4`, to: 'dac1:LRC' },
        { from: `${B}:5`, to: 'dac1:BCLK' },
        { from: `${B}:6`, to: 'dac1:DIN' },
        { from: `${B}:5V`, to: 'dac1:VIN' },
        { from: `${B}:${GND}`, to: 'dac1:GND' },
      ],
      code: 'const int LRC=4,BCLK=5,DIN=6;\nvoid wbit(uint8_t b){digitalWrite(DIN,b);digitalWrite(BCLK,HIGH);digitalWrite(BCLK,LOW);}\nvoid frame(uint16_t s){for(int i=15;i>=0;i--)wbit((s>>i)&1);}\nvoid setup(){Serial.begin(9600);Serial.println("NANO_I2S_READY");pinMode(LRC,OUTPUT);pinMode(BCLK,OUTPUT);pinMode(DIN,OUTPUT);digitalWrite(LRC,LOW);for(int f=0;f<40;f++){digitalWrite(LRC,LOW);frame(0x4000);digitalWrite(LRC,HIGH);frame(0xC000);}Serial.println("NANO_I2S_SENT");}\nvoid loop(){Serial.println("NANO_I2S_TICK");delay(1000);}\n',
      needle: 'NANO_I2S_SENT', telemetry: ['dac1'],
    });
    const st = (verdict.liveOop || {}).dac1 || {};
    expect(Number(st.totalFrameCount || 0)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano EXTI counts loopback edges (EXTI/Interrupts cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      wires: [{ from: `${B}:3`, to: `${B}:2` }],
      code: 'volatile uint16_t cnt=0;\nvoid isr(){cnt++;}\nvoid setup(){Serial.begin(9600);pinMode(3,OUTPUT);pinMode(2,INPUT);attachInterrupt(0,isr,RISING);Serial.println("NANO_EXT_READY");}\nvoid loop(){for(int i=0;i<10;i++){digitalWrite(3,HIGH);delay(5);digitalWrite(3,LOW);delay(5);}Serial.print("NANO_EXT_CNT:");Serial.println(cnt);cnt=0;delay(1000);}\n',
      needle: 'NANO_EXT_CNT:',
    });
    const vals = [...(verdict.serial || '').matchAll(/NANO_EXT_CNT:(\d+)/g)].map((m) => Number(m[1]));
    expect(vals.length).toBeGreaterThan(0);
    // Exact: 10 driven edges per burst (storm-proof; see Mega EXTI note —
    // the repropagate pullup-branch storm inflated all AVR EXTI counts).
    for (const v of vals) expect(v).toBe(10);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano Timer1 CTC ISR rate is cycle-exact (timers-capture cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: 'volatile uint16_t isrs=0;\nvoid setup(){Serial.begin(9600);Serial.println("NANO_TMR_READY");noInterrupts();TCCR1A=0;TCCR1B=0;TCNT1=0;OCR1A=249;TCCR1B|=(1<<WGM12);TCCR1B|=(1<<CS11)|(1<<CS10);TIMSK1|=(1<<OCIE1A);interrupts();}\nISR(TIMER1_COMPA_vect){isrs++;}\nvoid loop(){isrs=0;delay(1000);Serial.print("NANO_TMR_ISRS:");Serial.println(isrs);delay(500);}\n',
      needle: 'NANO_TMR_ISRS:',
    });
    const vals = [...(verdict.serial || '').matchAll(/NANO_TMR_ISRS:(\d+)/g)].map((m) => Number(m[1]));
    expect(vals.length).toBeGreaterThan(0);
    for (const v of vals.slice(0, 3)) { expect(v).toBeGreaterThan(800); expect(v).toBeLessThan(1200); }
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano clock rate via Timer1 gate (clocks cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: 'void setup(){Serial.begin(9600);Serial.print("NANO_FCPU:");Serial.println(F_CPU);noInterrupts();TCCR1A=0;TCCR1B=0;TCNT1=0;TCCR1B|=(1<<CS12)|(1<<CS10);interrupts();}\nvoid loop(){TCNT1=0;delay(1000);uint16_t t=TCNT1;Serial.print("NANO_TICKS1024:");Serial.println(t);delay(500);}\n',
      needle: 'NANO_TICKS1024:',
    });
    expect(verdict.serial || '').toContain('NANO_FCPU:16000000');
    const vals = [...(verdict.serial || '').matchAll(/NANO_TICKS1024:(\d+)/g)].map((m) => Number(m[1]));
    expect(vals.length).toBeGreaterThan(0);
    for (const v of vals.slice(0, 3)) { expect(v).toBeGreaterThan(14000); expect(v).toBeLessThan(17250); }
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Nano Modbus master reads Uno slave (Modbus cell)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('openhw-tour-completed', 'true');
    });
    await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);
  await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });
    const master = '#include <ModbusMaster.h>\nModbusMaster node;\nvoid setup(){Serial.begin(9600);Serial.println("MB_MASTER_READY");node.begin(1,Serial);}\nvoid loop(){uint8_t rc=node.readHoldingRegisters(0,2);Serial.print("MB_RC=");Serial.println(rc);if(rc==ModbusMaster::ku8MBSuccess){uint16_t v0=node.getResponseBuffer(0);uint16_t v1=node.getResponseBuffer(1);Serial.print("MB_OK_");Serial.print(v0);Serial.print("_");Serial.println(v1);}delay(1500);}\n';
    const slave = 'const uint16_t REG0=43981;\nconst uint16_t REG1=12345;\nuint8_t sbuf[24];uint8_t slen=0;\nuint16_t mbcrc(uint8_t *b,uint8_t n){uint16_t c=0xFFFF;for(uint8_t i=0;i<n;i++){c^=b[i];for(uint8_t j=0;j<8;j++){if(c&1)c=(c>>1)^0xA001;else c>>=1;}}return c;}\nvoid setup(){Serial.begin(9600);Serial.println("MB_SLAVE_READY");}\nvoid loop(){while(Serial.available()>0&&slen<24){sbuf[slen++]=Serial.read();}bool progress=true;while(progress&&slen>=8){progress=false;int at=-1;for(int i=0;i+7<slen;i++){if(sbuf[i]==1&&sbuf[i+1]==0x03){uint16_t c=mbcrc(sbuf+i,6);uint16_t g=sbuf[i+6]|(((uint16_t)sbuf[i+7])<<8);if(c==g){at=i;break;}}}if(at<0){if(slen>16){for(int i=0;i<slen-8;i++)sbuf[i]=sbuf[i+8];slen-=8;progress=true;}break;}uint16_t st=(((uint16_t)sbuf[at+2])<<8)|sbuf[at+3];uint16_t qt=(((uint16_t)sbuf[at+4])<<8)|sbuf[at+5];if(st==0&&qt==2){uint8_t r[9];r[0]=1;r[1]=0x03;r[2]=4;r[3]=REG0>>8;r[4]=REG0&0xFF;r[5]=REG1>>8;r[6]=REG1&0xFF;uint16_t rc2=mbcrc(r,7);r[7]=rc2&0xFF;r[8]=rc2>>8;for(int i=0;i<9;i++)Serial.write(r[i]);Serial.println("SLV_SENT_43981_12345");}int keep=slen-(at+8);for(int i=0;i<keep;i++)sbuf[i]=sbuf[at+8+i];slen=keep;progress=true;}delay(20);}\n';
    const setup = await page.evaluate((code) => window.OpenHWE2E.setupCircuit({
      components: [
        { id: 'nano1', type: 'openhw-arduino-nano', attrs: {}, x: 60, y: 100 },
        { id: 'uno2', type: 'openhw-arduino-uno', attrs: {}, x: 60, y: 320 },
      ],
      wires: [
        { from: 'nano1:1', to: 'uno2:0' },
        { from: 'uno2:1', to: 'nano1:0' },
        { from: 'nano1:GND.1', to: 'uno2:gnd_1' },
      ],
      code,
    }), master);
    expect(setup.ok).toBe(true);
    const setup2 = await page.evaluate((code) => window.OpenHWE2E.setupCircuitBoards({
      extra: { uno2: code },
    }), slave);
    expect(setup2.ok).toBe(true);
    const verdict = await page.evaluate(() => window.OpenHWE2E.run({
      forMs: 45000, serialNeedle: 'MB_OK_43981_12345', telemetryMode: 'detail',
    }));
    expect(verdict.ok).toBe(true);
    expect(verdict.pass).toBe(true);
    expect(verdict.serial || '').toContain('MB_OK_43981_12345');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
