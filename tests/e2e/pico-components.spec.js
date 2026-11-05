import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Pico 1 / Pico 2 component compatibility, one component per cell.
// Every cell builds a real circuit in the browser, compiles firmware for the
// selected board, runs it, and reads the HOST COMPONENT MODEL's live state
// (window.OpenHWTelemetry / liveOop) — not just the guest's serial. A cell is
// green only when the component model reacted.
//
// Families via PICO_COMP_FAMILIES (comma list) so the sweep runs in chunks:
//   outputs, displays, i2c, inputs, spi, storage
const SHOT_DIR = '/tmp/opencode/pico-comp';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const BOARDS = [
  { key: 'pico', type: 'openhw-pico', sda: 'GP4', scl: 'GP5', sck: 'GP18', mosi: 'GP19', miso: 'GP16' },
  { key: 'pico2', type: 'openhw-pico-2', sda: 'GP4', scl: 'GP5', sck: 'GP18', mosi: 'GP19', miso: 'GP16' },
];

const GP = (n) => `GP${n}`;

const LED_CODE = 'void setup(){Serial.begin(9600);Serial.println("LED_RDY");pinMode(16,OUTPUT);digitalWrite(16,HIGH);}\nvoid loop(){Serial.println("LED_TICK");delay(1000);}\n';
const RGB_CODE = 'void setup(){Serial.begin(9600);Serial.println("RGB_RDY");pinMode(16,OUTPUT);pinMode(17,OUTPUT);pinMode(18,OUTPUT);digitalWrite(16,HIGH);digitalWrite(17,HIGH);digitalWrite(18,HIGH);}\nvoid loop(){Serial.println("RGB_TICK");delay(1000);}\n';
const SEG_CODE = 'void setup(){Serial.begin(9600);Serial.println("SEG_RDY");int p[]={2,3,4,5,6,7,8};for(int i=0;i<7;i++){pinMode(p[i],OUTPUT);digitalWrite(p[i],LOW);}digitalWrite(3,HIGH);digitalWrite(4,HIGH);}\nvoid loop(){Serial.println("SEG_TICK");delay(1000);}\n';
const MOTOR_CODE = 'void setup(){Serial.begin(9600);Serial.println("MOTOR_RDY");pinMode(16,OUTPUT);digitalWrite(16,HIGH);}\nvoid loop(){Serial.println("MOTOR_TICK");delay(1000);}\n';
// Relay modules are ACTIVE LOW by default: IN LOW energises the coil.
const RELAY_CODE = 'void setup(){Serial.begin(9600);Serial.println("RELAY_RDY");pinMode(16,OUTPUT);digitalWrite(16,LOW);}\nvoid loop(){Serial.println("RELAY_TICK");delay(1000);}\n';
// Servo via HARDWARE PWM (pico-sdk), not the Servo library: arduino-pico's
// Servo is PIO-based (servo.pio), and the engine steps PIO only per guest
// instruction, so a sketch sitting in delay() never advances the state
// machine (see matrix.md "PIO timing"). 50Hz / 1472us = 90 degrees, which is
// exactly what the component model wants. Integer clock math only.
const SERVO_PWM_CODE = `#include <hardware/pwm.h>
#include <hardware/clocks.h>
void setup(){
  Serial.begin(9600);
  Serial.println("SERVO_RDY");
  gpio_set_function(16, GPIO_FUNC_PWM);
  uint slice = pwm_gpio_to_slice_num(16);
  uint chan = pwm_gpio_to_channel(16);
  uint32_t clk = clock_get_hz(clk_sys);
  uint32_t div = clk / (50u * 50000u);
  if (div < 1) div = 1;
  pwm_config cfg = pwm_get_default_config();
  pwm_config_set_clkdiv_int(&cfg, div);
  pwm_config_set_wrap(&cfg, 49999);
  pwm_init(slice, &cfg, false);
  pwm_set_chan_level(slice, chan, 3680);
  pwm_set_enabled(slice, true);
  Serial.println("SERVO_SET");
}
void loop(){ Serial.println("SERVO_TICK"); delay(1000); }
`;
// arduino-pico analogWrite is 8-bit by default: 128 = 50% duty (512 would
// saturate to 100%, which a buzzer correctly reads as DC, not a tone).
const BUZZER_CODE = 'void setup(){Serial.begin(9600);Serial.println("BUZ_RDY");analogWriteFreq(2000);analogWrite(16,128);Serial.println("BUZ_SET");}\nvoid loop(){Serial.println("BUZ_TICK");delay(1000);}\n';
// Pico 2 only: the M33 FPU is not emulated (m33_cpu.h: "FPU optional, not
// yet implemented"), so EVERY runtime float op returns 0 and analogWrite's
// float divider math writes DIV=0/TOP=0xFEFF. Same 2kHz/50% tone, set with
// integer PWM registers.
const BUZZER_PWM_CODE = `#include <hardware/pwm.h>
#include <hardware/clocks.h>
void setup(){
  Serial.begin(9600);
  Serial.println("BUZ_RDY");
  gpio_set_function(16, GPIO_FUNC_PWM);
  uint slice = pwm_gpio_to_slice_num(16);
  uint chan = pwm_gpio_to_channel(16);
  uint32_t clk = clock_get_hz(clk_sys);
  uint32_t div = clk / (2000u * 500u);
  if (div < 1) div = 1;
  pwm_config cfg = pwm_get_default_config();
  pwm_config_set_clkdiv_int(&cfg, div);
  pwm_config_set_wrap(&cfg, 499);
  pwm_init(slice, &cfg, false);
  pwm_set_chan_level(slice, chan, 250);
  pwm_set_enabled(slice, true);
  Serial.println("BUZ_SET");
}
void loop(){ Serial.println("BUZ_TICK"); delay(1000); }
`;
const STEPPER_CODE = 'int pins[4]={16,17,18,19};int seq[4][4]={{1,0,1,0},{0,1,1,0},{0,1,0,1},{1,0,0,1}};\nvoid setup(){Serial.begin(9600);Serial.println("STEP_RDY");for(int i=0;i<4;i++)pinMode(pins[i],OUTPUT);}\nvoid loop(){for(int s=0;s<4;s++){for(int i=0;i<4;i++)digitalWrite(pins[i],seq[s][i]);delay(20);}Serial.println("STEP_TICK");}\n';

const st = (v, id) => (v.liveOop || {})[id] || {};
const tel = (v, id) => {
  const t = (v.telemetry || []).find((x) => x.id === id);
  return t?.details?.state || t?.details?.custom || {};
};

const CASES = [
  {
    family: 'outputs', name: 'led', type: 'openhw-led',
    wires: (b) => [{ from: `${b}:${GP(16)}`, to: 'c1:A' }, { from: `${b}:GND`, to: 'c1:K' }],
    code: LED_CODE, needle: 'LED_RDY', runMs: 15000,
    check: (v) => {
      const s = st(v, 'c1');
      expect(s.illuminated === true || Number(s.brightness) > 100).toBe(true);
    },
  },
  {
    family: 'outputs', name: 'rgb-led', type: 'openhw-rgb-led',
    wires: (b) => [
      { from: `${b}:${GP(16)}`, to: 'c1:R' }, { from: `${b}:${GP(17)}`, to: 'c1:G' },
      { from: `${b}:${GP(18)}`, to: 'c1:B' }, { from: `${b}:GND`, to: 'c1:COM' },
    ],
    code: RGB_CODE, needle: 'RGB_RDY', runMs: 15000,
    check: (v) => {
      const s = st(v, 'c1');
      const sum = Number(s.r || 0) + Number(s.g || 0) + Number(s.b || 0);
      expect(sum).toBeGreaterThan(0);
    },
  },
  {
    family: 'outputs', name: '7segment', type: 'openhw-7segment',
    wires: (b) => [
      { from: `${b}:GND`, to: 'c1:COM.1' }, { from: `${b}:GND`, to: 'c1:COM.2' },
      ...[2, 3, 4, 5, 6, 7, 8].map((n, i) => ({ from: `${b}:${GP(n)}`, to: `c1:${'ABCDEFG'[i]}` })),
    ],
    code: SEG_CODE, needle: 'SEG_RDY', runMs: 15000,
    check: (v) => {
      const s = st(v, 'c1');
      const d = (s.digitSegments || [])[0] || {};
      expect(d.B === true && d.C === true).toBe(true);
    },
  },
  {
    family: 'outputs', name: 'motor', type: 'openhw-motor',
    wires: (b) => [{ from: `${b}:${GP(16)}`, to: 'c1:1' }, { from: `${b}:GND`, to: 'c1:2' }],
    code: MOTOR_CODE, needle: 'MOTOR_RDY', runMs: 20000,
    check: (v) => expect(Number(st(v, 'c1').speed || 0)).toBeGreaterThan(0.1),
  },
  {
    family: 'outputs', name: 'relay', type: 'openhw-relay-module',
    wires: (b) => [
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
      { from: `${b}:${GP(16)}`, to: 'c1:IN' },
    ],
    code: RELAY_CODE, needle: 'RELAY_RDY', runMs: 15000,
    check: (v) => expect(st(v, 'c1').energised).toBe(true),
  },
  {
    family: 'outputs', name: 'servo', type: 'openhw-servo',
    wires: (b) => [
      { from: `${b}:3V3`, to: 'c1:V+' }, { from: `${b}:GND`, to: 'c1:GND' },
      { from: `${b}:${GP(16)}`, to: 'c1:PWM' },
    ],
    code: SERVO_PWM_CODE, needle: 'SERVO_SET', runMs: 25000,
    check: (v) => {
      const s = st(v, 'c1');
      const ang = Number(s.angle);
      expect(Number.isFinite(ang)).toBe(true);
      expect(Math.abs(ang - 90)).toBeLessThan(15);
    },
  },
  {
    family: 'outputs', name: 'buzzer', type: 'openhw-buzzer',
    wires: (b) => [{ from: `${b}:${GP(16)}`, to: 'c1:SIG' }, { from: `${b}:GND`, to: 'c1:GND' }],
    code: (boardKey) => (boardKey === 'pico2' ? BUZZER_PWM_CODE : BUZZER_CODE),
    needle: 'BUZ_SET', runMs: 25000,
    check: (v) => {
      const s = st(v, 'c1');
      expect(s.isBuzzing).toBe(true);
      expect(Math.abs(Number(s.frequency) - 2000)).toBeLessThan(100);
    },
  },
  {
    family: 'outputs', name: 'stepper', type: 'openhw-stepper-motor',
    wires: (b) => [
      { from: `${b}:${GP(16)}`, to: 'c1:A+' }, { from: `${b}:${GP(17)}`, to: 'c1:A-' },
      { from: `${b}:${GP(18)}`, to: 'c1:B+' }, { from: `${b}:${GP(19)}`, to: 'c1:B-' },
    ],
    code: STEPPER_CODE, needle: 'STEP_TICK', runMs: 20000,
    check: (v) => expect(Math.abs(Number(st(v, 'c1').angle || 0))).toBeGreaterThan(0.5),
  },
];

const wanted = String(process.env.PICO_COMP_FAMILIES || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
// PICO_COMP_ONLY=buzzer,servo narrows within the selected families (dev loop).
const only = String(process.env.PICO_COMP_ONLY || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const selected = CASES.filter((c) => (!wanted.length || wanted.includes(c.family))
  && (!only.length || only.includes(c.name)));

// Default mode (one worker): every cell still runs after a failure, so one
// broken component never hides the rest of the sweep.

for (const board of BOARDS) {
  for (const c of selected) {
    test(`${board.key} ${c.name}`, async ({ page }) => {
      test.setTimeout(300000);
      await page.route('**/api/**', async (route) => {
        const url = route.request().url();
        if (url.includes('/compile')) return route.continue();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      });
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);

      const setup = await page.evaluate(({ comps, wires, code }) => window.OpenHWE2E.setupCircuit({
        components: comps, wires, code,
      }), {
        comps: [
          { id: 'b1', type: board.type, attrs: {}, x: 100, y: 100 },
          { id: 'c1', type: c.type, attrs: {}, x: 480, y: 120 },
        ],
        wires: c.wires('b1'),
        code: typeof c.code === 'function' ? c.code(board.key) : c.code,
      });
      expect(setup.ok).toBe(true);

      const verdict = await page.evaluate(({ forMs, needle }) => window.OpenHWE2E.run({
        forMs, selectTelemetry: ['c1'], serialNeedle: needle, telemetryMode: 'detail',
      }), { forMs: c.runMs, needle: c.needle });
      expect(verdict.ok).toBe(true);
      console.log(`PICOCOMP ${board.key}/${c.name} pass=${verdict.pass} reasons=${JSON.stringify(verdict.reasons || [])} lines=${verdict.serialLines}`);
      console.log(`PICOCOMP ${board.key}/${c.name} state=${JSON.stringify(st(verdict, 'c1')).slice(0, 300)}`);
      expect(verdict.pass).toBe(true);
      c.check(verdict);

      try {
        await page.screenshot({ path: path.join(SHOT_DIR, `${board.key}-${c.name}.png`), fullPage: false });
      } catch { /* screenshot is proof-of-run, never a gate */ }
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(1500);
    });
  }
}
