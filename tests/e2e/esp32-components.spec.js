import { test, expect } from '@playwright/test';

// ESP32 component matrix — leftovers not covered by the one-off esp32-*.spec.js
// files. One component per cell; verdict = host component model state.
// Env filters: ESP32_COMP_FAMILIES=gpio,i2c,spi,analog
//              ESP32_COMP_ONLY=rgb-led,mpu6050,...
//              ESP32_COMP_BOARD=devkit|cam
const BOARDS = [
  { key: 'esp1', type: 'openhw-esp32', i2c: [21, 22], spi: [18, 23, 5] },
  { key: 'cam1', type: 'openhw-esp32-cam', i2c: [13, 14], spi: [14, 13, 15] },
];
const G = (n) => `GPIO${n}`;
const st = (v, id) => (v.liveOop || {})[id] || {};
const custom = (v, id) => {
  const t = (v.telemetry || []).find((x) => x.id === id);
  return t?.details?.custom || t?.details?.metrics?.custom || {};
};

const i2cRead = (addr, reg, count, needle) => `#include <Wire.h>
void setup(){ Serial.begin(115200); Wire.begin(21,22); Serial.println("${needle}"); }
void loop(){
  Wire.beginTransmission(${addr}); Wire.write(${reg}); Wire.endTransmission(false);
  Wire.requestFrom(${addr}, ${count});
  for(int i=0;i<${count} && Wire.available();i++){ if(i) Serial.print(','); Serial.print(Wire.read()); }
  Serial.println(); delay(400);
}`;

const CASES = [
  {
    family: 'gpio', name: 'rgb-led', type: 'openhw-rgb-led',
    wires: (b) => [
      { from: `${b.key}:${G(16)}`, to: 'c1:R' },
      { from: `${b.key}:${G(17)}`, to: 'c1:G' },
      { from: `${b.key}:${G(18)}`, to: 'c1:B' },
      { from: `${b.key}:GND`, to: 'c1:COM' },
    ],
    code: 'void setup(){Serial.begin(115200);for(int p=16;p<=18;p++){pinMode(p,OUTPUT);digitalWrite(p,HIGH);}Serial.println("RGB_RDY");}\nvoid loop(){delay(500);}',
    needle: 'RGB_RDY', runMs: 30000,
    check: (v) => expect(Number(st(v, 'c1').r || 0) + Number(st(v, 'c1').g || 0) + Number(st(v, 'c1').b || 0)).toBeGreaterThan(0),
  },
  {
    family: 'gpio', name: 'relay', type: 'openhw-relay-module',
    wires: (b) => [
      { from: `${b.key}:3V3`, to: 'c1:VCC' }, { from: `${b.key}:GND`, to: 'c1:GND' },
      { from: `${b.key}:${G(16)}`, to: 'c1:IN' },
    ],
    code: 'void setup(){Serial.begin(115200);pinMode(16,OUTPUT);digitalWrite(16,LOW);Serial.println("RLY_RDY");}\nvoid loop(){delay(500);}',
    needle: 'RLY_RDY', runMs: 30000,
    check: (v) => expect(st(v, 'c1').energised).toBe(true),
  },
  {
    family: 'gpio', name: 'stepper', type: 'openhw-stepper-motor',
    wires: (b) => [16, 17, 18, 19].flatMap((n, i) => [
      { from: `${b.key}:${G(n)}`, to: `c1:${['A+', 'A-', 'B+', 'B-'][i]}` },
    ]),
    code: 'int p[4]={16,17,18,19};int sq[4][4]={{1,0,1,0},{0,1,1,0},{0,1,0,1},{1,0,0,1}};\nvoid setup(){Serial.begin(115200);for(int i=0;i<4;i++)pinMode(p[i],OUTPUT);Serial.println("STP_RDY");}\nvoid loop(){for(int s=0;s<4;s++){for(int i=0;i<4;i++)digitalWrite(p[i],sq[s][i]);delay(20);}}',
    needle: 'STP_RDY', runMs: 35000,
    check: (v) => expect(Math.abs(Number(st(v, 'c1').angle || 0))).toBeGreaterThan(1),
  },
  {
    family: 'spi', name: '74hc595', type: 'openhw-74hc595',
    wires: (b) => [
      { from: `${b.key}:${G(b.spi[1])}`, to: 'c1:ser' },
      { from: `${b.key}:${G(b.spi[0])}`, to: 'c1:srclk' },
      { from: `${b.key}:${G(b.spi[2])}`, to: 'c1:rclk' },
      { from: `${b.key}:GND`, to: 'c1:oe' },
      { from: `${b.key}:3V3`, to: 'c1:vcc' }, { from: `${b.key}:GND`, to: 'c1:gnd' },
    ],
    code: (b) => `#include <SPI.h>
void setup(){ Serial.begin(115200); pinMode(${b.spi[2]}, OUTPUT); SPI.begin(${b.spi[0]}, 19, ${b.spi[1]}, ${b.spi[2]}); Serial.println("SR_RDY"); }
void loop(){ digitalWrite(${b.spi[2]}, LOW); SPI.transfer(0x81); digitalWrite(${b.spi[2]}, HIGH); delay(500); }`,
    needle: 'SR_RDY', runMs: 35000,
    check: (v) => expect(Number(st(v, 'c1').storageReg)).toBe(0x81),
  },
  {
    family: 'i2c', name: 'mpu6050', type: 'openhw-mpu6050',
    wires: (b) => [
      { from: `${b.key}:${G(b.i2c[0])}`, to: 'c1:SDA' },
      { from: `${b.key}:${G(b.i2c[1])}`, to: 'c1:SCL' },
      { from: `${b.key}:3V3`, to: 'c1:VIN' }, { from: `${b.key}:GND`, to: 'c1:GND' },
    ],
    code: (b) => b.i2c[0] === 21 ? i2cRead(0x68, 0x3b, 6, 'MPU_RDY') : i2cRead(0x68, 0x3b, 6, 'MPU_RDY').replace('Wire.begin(21,22)', 'Wire.begin(13,14)'),
    needle: 'MPU_RDY', runMs: 40000,
    check: (v) => expect(v.serial).toContain(','),
  },
  {
    family: 'i2c', name: 'adxl345', type: 'openhw-adxl345',
    wires: (b) => [
      { from: `${b.key}:${G(b.i2c[0])}`, to: 'c1:SDA' },
      { from: `${b.key}:${G(b.i2c[1])}`, to: 'c1:SCL' },
      { from: `${b.key}:3V3`, to: 'c1:VCC' }, { from: `${b.key}:GND`, to: 'c1:GND' },
    ],
    code: (b) => (b.i2c[0] === 21 ? i2cRead(0x53, 0x00, 1, 'ADX_RDY') : i2cRead(0x53, 0x00, 1, 'ADX_RDY').replace('Wire.begin(21,22)', 'Wire.begin(13,14)')),
    needle: 'ADX_RDY', runMs: 40000,
    check: (v) => { expect(st(v, 'c1').powered).toBe(true); expect(Number(st(v, 'c1').accelZ)).toBeCloseTo(1, 1); },
  },
  {
    family: 'analog', name: 'ldr-module', type: 'openhw-ldr-module',
    wires: (b) => [
      { from: `${b.key}:${G(34)}`, to: 'c1:AO' },
      { from: `${b.key}:3V3`, to: 'c1:VCC' }, { from: `${b.key}:GND`, to: 'c1:GND' },
    ],
    code: 'void setup(){Serial.begin(115200);analogReadResolution(12);Serial.println("LDR_RDY");}\nvoid loop(){Serial.println(analogRead(34));delay(400);}',
    needle: 'LDR_RDY', runMs: 35000,
    check: (v) => expect(v.serial).toContain('\n'),
  },
  {
    family: 'analog', name: 'soil-moisture', type: 'openhw-soil-moisture-sensor',
    wires: (b) => [
      { from: `${b.key}:${G(34)}`, to: 'c1:SIG' },
      { from: `${b.key}:3V3`, to: 'c1:VCC' }, { from: `${b.key}:GND`, to: 'c1:GND' },
    ],
    code: 'void setup(){Serial.begin(115200);analogReadResolution(12);Serial.println("SOI_RDY");}\nvoid loop(){Serial.println(analogRead(34));delay(400);}',
    needle: 'SOI_RDY', runMs: 35000,
    check: (v) => expect(Number(st(v, 'c1').moisture)).toBe(50),
  },
  {
    family: 'i2c', name: 'ds1307-rtc', type: 'openhw-ds1307-rtc',
    attrs: { datetime: '2024-01-01T12:34:56' },
    wires: (b) => [
      { from: `${b.key}:${G(b.i2c[0])}`, to: 'c1:SDA' },
      { from: `${b.key}:${G(b.i2c[1])}`, to: 'c1:SCL' },
      { from: `${b.key}:3V3`, to: 'c1:VCC' }, { from: `${b.key}:GND`, to: 'c1:GND' },
    ],
    code: (b) => (b.i2c[0] === 21 ? i2cRead(0x68, 0x00, 7, 'RTC_RDY') : i2cRead(0x68, 0x00, 7, 'RTC_RDY').replace('Wire.begin(21,22)', 'Wire.begin(13,14)')),
    needle: 'RTC_RDY', runMs: 40000,
    check: (v) => expect(st(v, 'c1').powered).toBe(true),
  },
  {
    family: 'i2c', name: 'pca9685', type: 'openhw-pca9685',
    attrs: { i2cAddress: '0x40' },
    wires: (b) => [
      { from: `${b.key}:${G(b.i2c[0])}`, to: 'c1:SDA' },
      { from: `${b.key}:${G(b.i2c[1])}`, to: 'c1:SCL' },
      { from: `${b.key}:3V3`, to: 'c1:VCC' }, { from: `${b.key}:GND`, to: 'c1:GND' },
    ],
    code: (b) => `#include <Wire.h>
void setup(){ Serial.begin(115200); Wire.begin(${b.i2c[0]},${b.i2c[1]}); Serial.println("PCA_RDY"); }
void loop(){
 Wire.beginTransmission(0x40); Wire.write(0x00); Wire.write(0x00); Wire.endTransmission();
 Wire.beginTransmission(0x40); Wire.write(0x06); Wire.write(0x00); Wire.write(0x00); Wire.write(0x00); Wire.write(0x08); Wire.endTransmission();
 delay(500);
}`,
    needle: 'PCA_RDY', runMs: 40000,
    check: (v) => expect(Number(custom(v, 'c1').dutyCycles?.['0'] || 0)).toBeGreaterThan(5),
  },
  {
    family: 'analog', name: 'slide-potentiometer', type: 'openhw-slide-potentiometer',
    attrs: { value: 25 },
    wires: (b) => [
      { from: `${b.key}:${G(34)}`, to: 'c1:SIG' },
      { from: `${b.key}:3V3`, to: 'c1:VCC' }, { from: `${b.key}:GND`, to: 'c1:GND' },
    ],
    code: 'void setup(){Serial.begin(115200);analogReadResolution(12);Serial.println("SPR_RDY");}\nvoid loop(){Serial.println(analogRead(34));delay(400);}',
    needle: 'SPR_RDY', runMs: 35000,
    check: (v) => expect(Number(st(v, 'c1').value)).toBe(25),
  },
  {
    family: 'analog', name: 'ntc-thermistor', type: 'openhw-ntc-thermistor',
    wires: (b) => [
      { from: `${b.key}:${G(34)}`, to: 'c1:A0' },
      { from: `${b.key}:${G(16)}`, to: 'c1:D0' },
      { from: `${b.key}:3V3`, to: 'c1:VCC' }, { from: `${b.key}:GND`, to: 'c1:GND' },
    ],
    code: 'void setup(){Serial.begin(115200);analogReadResolution(12);pinMode(16,OUTPUT);digitalWrite(16,HIGH);Serial.println("NTC_RDY");}\nvoid loop(){Serial.println(analogRead(34));delay(400);}',
    needle: 'NTC_RDY', runMs: 35000,
    check: (v) => expect(Number(st(v, 'c1').temperature)).toBe(25),
  },
  {
    family: 'analog', name: 'photodiode', type: 'openhw-photodiode',
    attrs: { light: 50 },
    wires: (b) => [
      { from: `${b.key}:${G(34)}`, to: 'c1:A' },
      { from: `${b.key}:${G(16)}`, to: 'c1:C' },
    ],
    code: 'void setup(){Serial.begin(115200);analogReadResolution(12);pinMode(16,OUTPUT);digitalWrite(16,HIGH);Serial.println("PHD_RDY");}\nvoid loop(){Serial.println(analogRead(34));delay(400);}',
    needle: 'PHD_RDY', runMs: 35000,
    check: (v) => expect(Number(st(v, 'c1').light)).toBe(50),
  },
  {
    family: 'gpio', name: 'a4988', type: 'openhw-a4988',
    wires: (b) => [
      { from: `${b.key}:${G(16)}`, to: 'c1:STEP' },
      { from: `${b.key}:${G(17)}`, to: 'c1:DIR' },
      { from: `${b.key}:3V3`, to: 'c1:VDD' }, { from: `${b.key}:GND`, to: 'c1:GND_LOGIC' },
    ],
    code: 'void setup(){Serial.begin(115200);pinMode(16,OUTPUT);pinMode(17,OUTPUT);digitalWrite(17,HIGH);Serial.println("A49_RDY");}\nvoid loop(){digitalWrite(16,HIGH);delay(2);digitalWrite(16,LOW);delay(20);}',
    needle: 'A49_RDY', runMs: 35000,
    check: (v) => expect(v.serial).toContain('A49_RDY'),
  },
  {
    family: 'gpio', name: 'motor-driver', type: 'openhw-motor-driver',
    wires: (b) => [
      { from: `${b.key}:${G(16)}`, to: 'c1:ENA' },
      { from: `${b.key}:${G(17)}`, to: 'c1:IN1' },
      { from: `${b.key}:${G(18)}`, to: 'c1:IN2' },
      { from: `${b.key}:GND`, to: 'c1:GND' },
      { from: `${b.key}:3V3`, to: 'c1:12V' },
    ],
    code: 'void setup(){Serial.begin(115200);for(int p=16;p<=18;p++){pinMode(p,OUTPUT);digitalWrite(p,HIGH);}digitalWrite(18,LOW);Serial.println("MDR_RDY");}\nvoid loop(){delay(500);}',
    needle: 'MDR_RDY', runMs: 30000,
    check: (v) => expect(st(v, 'c1').active).toBe(true),
  },
  // ── blocked leftovers: every remaining peripheral type accounted for ──
  {
    family: 'spi', name: 'mfrc522', type: 'openhw-mfrc522', blockedOn: ['esp1', 'cam1'],
    blockedReason: 'SPI MISO readback is not wired in esp32-runner (exchange() return dropped)',
  },
  {
    family: 'spi', name: 'nrf24l01', type: 'openhw-nrf24l01', blockedOn: ['esp1', 'cam1'],
    blockedReason: 'SPI MISO readback is not wired in esp32-runner',
  },
  {
    family: 'spi', name: 'cc1101', type: 'openhw-cc1101', blockedOn: ['esp1', 'cam1'],
    blockedReason: 'SPI MISO readback is not wired in esp32-runner',
  },
  {
    family: 'gpio', name: 'hc-sr04', type: 'openhw-hc-sr04', blockedOn: ['esp1', 'cam1'],
    blockedReason: 'ESP32 GPIO edges carry no timestamps; microsecond echo width unmeasurable',
  },
  {
    family: 'gpio', name: 'neopixel-matrix', type: 'openhw-neopixel-matrix', blockedOn: ['esp1', 'cam1'],
    blockedReason: 'engine RMT TX ends after one symbol (wrong capture RAM base)',
  },
  {
    family: 'gpio', name: 'neopixel-ring', type: 'openhw-neopixel-ring', blockedOn: ['esp1', 'cam1'],
    blockedReason: 'engine RMT TX ends after one symbol (wrong capture RAM base)',
  },
  {
    family: 'i2s', name: 'inmp441', type: 'openhw-inmp441', blockedOn: ['esp1', 'cam1'],
    blockedReason: 'engine exposes I2S TX only; no microphone RX injection',
  },
  {
    family: 'i2s', name: 'sph0645', type: 'openhw-sph0645', blockedOn: ['esp1', 'cam1'],
    blockedReason: 'engine exposes I2S TX only; no microphone RX injection',
  },
  {
    family: 'displays', name: 'ltdc-display', type: 'openhw-ltdc-display', blockedOn: ['esp1', 'cam1'],
    blockedReason: 'STM32F4-only LTDC RGB parallel frame lane; ESP32 has none',
  },
  {
    family: 'gpio', name: 'ks2e-relay', type: 'openhw-ks2e-m-dc5', blockedOn: ['esp1', 'cam1'],
    blockedReason: 'bare relay coil needs a modeled 5 V rail; DevKit exposes only 3V3/VIN',
  },
];

const families = String(process.env.ESP32_COMP_FAMILIES || '').split(',').map((s) => s.trim()).filter(Boolean);
const only = String(process.env.ESP32_COMP_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const boards = BOARDS.filter((b) => !process.env.ESP32_COMP_BOARD || process.env.ESP32_COMP_BOARD === b.key);
const cases = CASES.filter((c) => (!families.length || families.includes(c.family)) && (!only.length || only.includes(c.name)));

for (const board of boards) {
  for (const c of cases) {
    test(`${board.key} ${c.name}`, async ({ page }) => {
      test.setTimeout(300000);
      if (c.blockedOn?.includes(board.key)) {
        console.log(`ESP32COMP ${board.key}/${c.name} BLOCKED: ${c.blockedReason}`);
        test.skip(true, c.blockedReason);
        return;
      }
      await page.route('**/api/**', async (route) => {
        if (route.request().url().includes('/compile')) return route.continue();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      });
      await page.addInitScript(() => window.localStorage.setItem('openhw-tour-completed', 'true'));
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.OpenHWE2E, null, { timeout: 90000 });

      const setup = await page.evaluate(({ comps, wires, code }) => window.OpenHWE2E.setupCircuit({ components: comps, wires, code }), {
        comps: [
          { id: board.key, type: board.type, attrs: {}, x: 100, y: 100 },
          { id: 'c1', type: c.type, attrs: c.attrs || {}, x: 480, y: 120 },
        ],
        wires: c.wires(board),
        code: typeof c.code === 'function' ? c.code(board) : c.code,
      });
      expect(setup.ok).toBe(true);
      const verdict = await page.evaluate(({ needle, forMs }) => window.OpenHWE2E.run({
        forMs, serialNeedle: needle, telemetryMode: 'detail', selectTelemetry: ['c1'],
      }), { needle: c.needle, forMs: c.runMs });
      console.log(`ESP32COMP ${board.key}/${c.name} pass=${verdict.pass} reasons=${JSON.stringify(verdict.reasons || [])} serial=${JSON.stringify(String(verdict.serial || '').slice(0, 160))} state=${JSON.stringify(st(verdict, 'c1')).slice(0, 240)}`);
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      c.check(verdict, board);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(1000);
    });
  }
}
