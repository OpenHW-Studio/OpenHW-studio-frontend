import { test, expect } from '@playwright/test';

// ATtiny85 HONEST-substitution cells (live). Read this header before
// quoting any cell below:
//
// 1. There is NO native attiny toolchain in the backend: every firmware
//    here is Uno-compiled and runs on the tiny runner path (generic avr8js
//    CPU + PORTB + ATtinyTimer1, with USART/TWI/SPI/ADC staying Uno-class
//    stand-ins — src/worker/runners/avr-runner.ts:186-203).
// 2. Real ATtiny85 silicon has NO UART, NO TWI/SPI hardware — only USI
//    (plus a real ADC, real EEPROM, real timers, INT0). So:
//    - GPIO/PWM/EXTI/timer/I2S/DHT/IR/SoftSerial-TX cells below prove the
//      documented Uno-binary substitution path over real P-net routing
//      (P0-P5 ARE Arduino digital 0-5 — src/worker/signal/electrical.ts:42-45;
//      PB2/PB3 route SoftSerial 10/11; SPI 11/12/13 route to P3/P1/P0).
//    - I2C/RTC/SD/ADC cells ride the Uno-class TWI/SPI/ADC stand-ins over
//      VIRTUAL A4/A5/A0 nets (no P-route exists); they prove runner-path
//      plumbing, NOT native USI/ADC behavior. Native I2C/SPI = NO-GO
//      (AVRUSI unwired, no attiny FQBN — staged in
//      .tmp-vitest/avr-pico-patches.md).
//    - UART-hardware/Modbus/CAN/Display/native-USI cells are NOT claimed
//      here (NO-GO — see report). The existing PARTIAL UART row (Uno binary)
//      stands as-is.

const B = 'tiny1';
const BT = 'openhw-attiny85';

async function runCell(page, { comps = [], wires = [], code, needle, forMs = 22000, telemetry = [] }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('openhw-tour-completed', 'true');
  });
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
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

test.describe('ATtiny85 honest-substitution cells', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Tiny GPIO-out latch on P0 (honest binary, P-net routed)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [
        { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 450, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 600, y: 100 },
      ],
      wires: [
        { from: `${B}:P0`, to: 'res1:p1' },
        { from: 'res1:p2', to: 'led1:A' },
        { from: 'led1:K', to: `${B}:GND` },
      ],
      code: 'int n=0;\nvoid setup(){pinMode(0,OUTPUT);Serial.begin(9600);Serial.println("TINY_GPIO_READY");}\nvoid loop(){if(n<6){digitalWrite(0,HIGH);delay(250);digitalWrite(0,LOW);delay(250);n++;Serial.println("TINY_GPIO_TICK");}else{digitalWrite(0,HIGH);Serial.println("TINY_HOLD_HIGH");delay(1000);}}\n',
      needle: 'TINY_HOLD_HIGH', telemetry: ['led1'],
    });
    expect(verdict.serial || '').toContain('TINY_GPIO_READY');
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    expect(String(led.summary || '')).toMatch(/illuminated: true|brightness: ([1-9]|0\.\d*[1-9])|brightness: [1-9]/);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny GPIO-in reads slide-switch on P2', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'sw1', type: 'openhw-slide-switch', attrs: { value: '1' }, x: 450, y: 120 }],
      wires: [
        { from: `${B}:5V`, to: 'sw1:3' },
        { from: `${B}:GND`, to: 'sw1:1' },
        { from: 'sw1:2', to: `${B}:P2` },
      ],
      code: 'void setup(){pinMode(2,INPUT);Serial.begin(9600);Serial.println("TINY_IN_READY");}\nvoid loop(){Serial.println(digitalRead(2));delay(500);}\n',
      needle: 'TINY_IN_READY',
    });
    expect(/[\r\n]1[\r\n]/.test(verdict.serial || '')).toBe(true);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny PWM drives LED on P1', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [
        { id: 'res1', type: 'openhw-resistor', attrs: {}, x: 450, y: 100 },
        { id: 'led1', type: 'openhw-led', attrs: {}, x: 600, y: 100 },
      ],
      wires: [
        { from: `${B}:P1`, to: 'res1:p1' },
        { from: 'res1:p2', to: 'led1:A' },
        { from: 'led1:K', to: `${B}:GND` },
      ],
      code: 'void setup(){pinMode(1,OUTPUT);Serial.begin(9600);Serial.println("TINY_PWM_READY");analogWrite(1,192);Serial.println("TINY_PWM_SET");}\nvoid loop(){Serial.println("TINY_PWM_TICK");delay(1000);}\n',
      needle: 'TINY_PWM_SET', telemetry: ['led1'],
    });
    const led = (verdict.telemetry || []).find((t) => t.id === 'led1');
    expect(led).toBeTruthy();
    expect(String(led.summary || '')).toMatch(/illuminated: true|brightness: ([1-9]|0\.\d*[1-9])|brightness: [1-9]/);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny EEPROM byte readback (512B backend, no pins involved)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include <Arduino.h>\n#include <avr/eeprom.h>\nvoid setup(){Serial.begin(9600);Serial.println("TINY_EE_READY");eeprom_write_byte((uint8_t*)0x10,0xAB);eeprom_write_byte((uint8_t*)0x11,0xCD);uint8_t a=eeprom_read_byte((uint8_t*)0x10);uint8_t b=eeprom_read_byte((uint8_t*)0x11);Serial.print("TINY_EE_RB:");Serial.print(a,HEX);Serial.print(b,HEX);Serial.println();}\nvoid loop(){}\n',
      needle: 'TINY_EE_RB:',
    });
    const m = /TINY_EE_RB:([0-9A-F]+)/.exec(verdict.serial || '');
    expect(m && m[1]).toBe('ABCD');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny SoftSerial TX decodes on PB2 (honest binary)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: '#include <SoftwareSerial.h>\nSoftwareSerial ss(11,10);\nvoid setup(){ss.begin(9600);ss.println("TINY_SS_HELLO");}\nvoid loop(){ss.println("TINY_SS_TICK");delay(1000);}\n',
      needle: 'TINY_SS_HELLO', forMs: 15000,
    });
    expect(verdict.serial || '').toContain('TINY_SS_HELLO');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny SPI-stand-in MAX7219 draw (Uno-class SPI model, P-routed pins)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'mx1', type: 'openhw-max7219', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:P3`, to: 'mx1:DIN' },
        { from: `${B}:P0`, to: 'mx1:CLK' },
        { from: `${B}:P2`, to: 'mx1:CS' },
        { from: `${B}:5V`, to: 'mx1:VCC' },
        { from: `${B}:GND`, to: 'mx1:GND' },
      ],
      code: '#include <SPI.h>\nvoid wr(uint8_t r,uint8_t d){digitalWrite(10,LOW);SPI.transfer(r);SPI.transfer(d);digitalWrite(10,HIGH);}\nvoid setup(){Serial.begin(9600);Serial.println("TINY_SPI_READY");pinMode(10,OUTPUT);digitalWrite(10,HIGH);SPI.begin();SPI.beginTransaction(SPISettings(8000000,MSBFIRST,SPI_MODE0));wr(0x0C,0x01);wr(0x0A,0x08);wr(0x0B,0x07);wr(0x01,0x7E);wr(0x02,0x30);Serial.println("TINY_SPI_DRAWN");}\nvoid loop(){Serial.println("TINY_SPI_TICK");delay(1000);}\n',
      needle: 'TINY_SPI_DRAWN', telemetry: ['mx1'],
    });
    const mx = (verdict.telemetry || []).find((t) => t.id === 'mx1');
    expect(mx).toBeTruthy();
    const custom = mx.details?.custom || mx.details?.metrics?.custom || {};
    expect(custom.shutdown).toBe(false);
    expect(custom.matrix?.[0]).toBe(0x7E);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny I2C-stand-in OLED draw (Uno-class TWI model, virtual A4/A5)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'oled1', type: 'openhw-ssd1306-oled', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:A4`, to: 'oled1:SDA' },
        { from: `${B}:A5`, to: 'oled1:SCL' },
        { from: `${B}:5V`, to: 'oled1:VCC' },
        { from: `${B}:GND`, to: 'oled1:GND' },
      ],
      code: '#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 d(128,64,&Wire,-1);\nvoid setup(){Serial.begin(9600);Serial.println("TINY_OLED_READY");Wire.begin();d.begin(SSD1306_SWITCHCAPVCC,0x3C);d.clearDisplay();d.setTextSize(2);d.setTextColor(SSD1306_WHITE);d.setCursor(0,0);d.println("HiTiny");d.display();Serial.println("TINY_OLED_DRAWN");}\nvoid loop(){Serial.println("TINY_OLED_TICK");delay(1000);}\n',
      needle: 'TINY_OLED_DRAWN', telemetry: ['oled1'],
    });
    const oled = (verdict.telemetry || []).find((t) => t.id === 'oled1');
    expect(oled).toBeTruthy();
    const ocustom = oled.details?.custom || oled.details?.metrics?.custom || {};
    expect(Number(ocustom.vramFillPercentage ?? NaN)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny ADC-stand-in reads virtual A0 (no P-route; native needs FQBN)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'pot1', type: 'openhw-potentiometer', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:A0`, to: 'pot1:SIG' },
        { from: `${B}:5V`, to: 'pot1:2' },
        { from: `${B}:GND`, to: 'pot1:1' },
      ],
      code: 'void setup(){Serial.begin(9600);Serial.println("TINY_ADC_READY");}\nvoid loop(){int v=analogRead(A0);Serial.print("TINY_ADC_VAL:");Serial.println(v);delay(500);}\n',
      needle: 'TINY_ADC_VAL:',
    });
    const vals = [...(verdict.serial || '').matchAll(/TINY_ADC_VAL:(\d+)/g)].map((m) => Number(m[1]));
    expect(vals.length).toBeGreaterThan(0);
    for (const v of vals) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1023); }
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny DHT22 on P2 (bit-bang, P-routed)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'dht1', type: 'openhw-dht22', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:P2`, to: 'dht1:DATA' },
        { from: `${B}:5V`, to: 'dht1:VCC' },
        { from: `${B}:GND`, to: 'dht1:GND' },
      ],
      code: '#include <DHT.h>\n#define DHTPIN 2\n#define DHTTYPE DHT22\nDHT dht(DHTPIN,DHTTYPE);\nvoid setup(){Serial.begin(9600);Serial.println("TINY_DHT_READY");dht.begin();}\nvoid loop(){float h=dht.readHumidity();float t=dht.readTemperature();Serial.print("TINY_DHT_T:");Serial.print(t);Serial.print(" DHT_H:");Serial.println(h);delay(2000);}\n',
      needle: 'TINY_DHT_T:',
    });
    expect(verdict.serial || '').toContain('TINY_DHT_T:');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny IR envelope loopback P3->P2', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'ir1', type: 'openhw-ir-receiver', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:P3`, to: `${B}:P2` },
        { from: `${B}:5V`, to: 'ir1:VCC' },
        { from: `${B}:GND`, to: 'ir1:GND' },
        { from: 'ir1:OUT', to: `${B}:P4` },
      ],
      code: 'const int TX=3,RX=2;\nbool bit(bool l){digitalWrite(TX,l?HIGH:LOW);delayMicroseconds(500);bool e=digitalRead(RX)==HIGH;delayMicroseconds(500);return e;}\nbool byte(uint8_t t,uint8_t&r){if(bit(false)!=false)return false;uint8_t v=0;for(uint8_t i=0;i<8;i++)if(bit((t>>i)&1))v|=(1<<i);if(bit(true)!=true)return false;r=v;return true;}\nvoid setup(){Serial.begin(9600);pinMode(TX,OUTPUT);digitalWrite(TX,HIGH);pinMode(RX,INPUT);Serial.println("TINY_IR_READY");}\nvoid loop(){uint8_t a=0,c=0;if(byte(0x00,a)&&byte(0x16,c)&&a==0x00&&c==0x16)Serial.println("TINY_IR_DECODED ADDR=0x00 CMD=0x16");else Serial.println("TINY_IR_TIMEOUT");delay(2000);}\n',
      needle: 'TINY_IR_DECODED', telemetry: ['ir1'],
    });
    expect(verdict.serial || '').toContain('TINY_IR_DECODED ADDR=0x00 CMD=0x16');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny bit-banged I2S frames on P1/P2/P3', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'dac1', type: 'openhw-max98357', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:P1`, to: 'dac1:LRC' },
        { from: `${B}:P2`, to: 'dac1:BCLK' },
        { from: `${B}:P3`, to: 'dac1:DIN' },
        { from: `${B}:5V`, to: 'dac1:VIN' },
        { from: `${B}:GND`, to: 'dac1:GND' },
      ],
      code: 'const int LRC=1,BCLK=2,DIN=3;\nvoid wbit(uint8_t b){digitalWrite(DIN,b);digitalWrite(BCLK,HIGH);digitalWrite(BCLK,LOW);}\nvoid frame(uint16_t s){for(int i=15;i>=0;i--)wbit((s>>i)&1);}\nvoid setup(){Serial.begin(9600);Serial.println("TINY_I2S_READY");pinMode(LRC,OUTPUT);pinMode(BCLK,OUTPUT);pinMode(DIN,OUTPUT);digitalWrite(LRC,LOW);for(int f=0;f<40;f++){digitalWrite(LRC,LOW);frame(0x4000);digitalWrite(LRC,HIGH);frame(0xC000);}Serial.println("TINY_I2S_SENT");}\nvoid loop(){Serial.println("TINY_I2S_TICK");delay(1000);}\n',
      needle: 'TINY_I2S_SENT', telemetry: ['dac1'],
    });
    const st = (verdict.liveOop || {}).dac1 || {};
    expect(Number(st.totalFrameCount || 0)).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny Timer0-gated pulse count (timers cell, no ICP claim)', async ({ page }) => {
    const verdict = await runCell(page, {
      wires: [{ from: `${B}:P3`, to: `${B}:P2` }],
      code: 'void setup(){Serial.begin(9600);pinMode(3,OUTPUT);pinMode(2,INPUT);Serial.println("TINY_TMR_READY");}\nvoid loop(){uint16_t c=0;unsigned long t0=millis();while(millis()-t0<1000){digitalWrite(3,HIGH);delayMicroseconds(900);digitalWrite(3,LOW);delayMicroseconds(900);if(digitalRead(2)==HIGH)c++;}Serial.print("TINY_TMR_CNT:");Serial.println(c);delay(500);}\n',
      needle: 'TINY_TMR_CNT:',
    });
    const vals = [...(verdict.serial || '').matchAll(/TINY_TMR_CNT:(\d+)/g)].map((m) => Number(m[1]));
    expect(vals.length).toBeGreaterThan(0);
    expect(vals[vals.length - 1]).toBeGreaterThan(0);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Tiny clock identity (F_CPU + millis gate)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: 'void setup(){Serial.begin(9600);Serial.print("TINY_FCPU:");Serial.println(F_CPU);Serial.println("TINY_CLK_READY");}\nvoid loop(){unsigned long t0=millis();delay(1000);unsigned long dt=millis()-t0;Serial.print("TINY_DTMS:");Serial.println(dt);delay(500);}\n',
      needle: 'TINY_DTMS:',
    });
    expect(verdict.serial || '').toMatch(/TINY_FCPU:\d+/);
    const vals = [...(verdict.serial || '').matchAll(/TINY_DTMS:(\d+)/g)].map((m) => Number(m[1]));
    expect(vals.length).toBeGreaterThan(0);
    for (const v of vals.slice(0, 3)) { expect(v).toBeGreaterThan(900); expect(v).toBeLessThan(1150); }
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
