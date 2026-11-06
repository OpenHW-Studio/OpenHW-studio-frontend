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
// Photoresistor module output: the model's p2 voltage is a 0-5 V
// analog value derived from its lux attr (500 lx -> 2.44 V).
const PHOTO_CODE = `void setup(){ Serial.begin(9600); Serial.println("PR_RDY"); analogReadResolution(12); }
void loop(){ Serial.print("PR:"); Serial.println(analogRead(26)); delay(200); }
`;

// NTC module: 25 C puts OUT at half of its 5 V span (2.5 V).
const NTC_MOD_CODE = `void setup(){ Serial.begin(9600); Serial.println("NTC_RDY"); analogReadResolution(12); }
void loop(){ Serial.print("NTC:"); Serial.println(analogRead(26)); delay(200); }
`;

// NPN low-side switch: base GPIO high pulls the collector to ~0.2 V,
// base low lets the model's pull-up sit at 5 V.
const NPN_CODE = `void setup(){
  Serial.begin(9600);
  Serial.println("NPN_RDY");
  pinMode(16, OUTPUT);
  pinMode(17, INPUT);
}
void loop(){
  digitalWrite(16, HIGH);
  delay(300);
  Serial.print("NPN:"); Serial.println(digitalRead(17));
  digitalWrite(16, LOW);
  delay(300);
  Serial.print("NPN:"); Serial.println(digitalRead(17));
  Serial.println("NPN_CYCLE");
  delay(400);
}
`;

// HX711: 24 clocks shift the sample MSB-first; the guest samples DT
// after each clock has been visible to the model for a full tick.
const HX711_CODE = `const int PIN_DT = 16;
const int PIN_SCK = 17;
void setup(){
  Serial.begin(9600);
  Serial.println("HX_RDY");
  pinMode(PIN_DT, INPUT);
  pinMode(PIN_SCK, OUTPUT);
  digitalWrite(PIN_SCK, LOW);
  delay(500);
  unsigned long v = 0;
  for (int i = 0; i < 24; i++) {
    digitalWrite(PIN_SCK, HIGH);
    delay(40);
    v = (v << 1) | (digitalRead(PIN_DT) ? 1 : 0);
    digitalWrite(PIN_SCK, LOW);
    delay(40);
  }
  digitalWrite(PIN_SCK, HIGH);
  delay(40);
  digitalWrite(PIN_SCK, LOW);
  delay(40);
  Serial.print("HX:"); Serial.println(v);
  Serial.println("HX_DONE");
}
void loop(){ Serial.println("HX_TICK"); delay(1000); }
`;

const STEPPER_CODE = 'int pins[4]={16,17,18,19};int seq[4][4]={{1,0,1,0},{0,1,1,0},{0,1,0,1},{1,0,0,1}};\nvoid setup(){Serial.begin(9600);Serial.println("STEP_RDY");for(int i=0;i<4;i++)pinMode(pins[i],OUTPUT);}\nvoid loop(){for(int s=0;s<4;s++){for(int i=0;i<4;i++)digitalWrite(pins[i],seq[s][i]);delay(20);}Serial.println("STEP_TICK");}\n';

// ── displays ────────────────────────────────────────────────────────────
// I2C0 on GP4/GP5 (arduino-pico: Wire.setSDA/setSCL before Wire.begin).
const OLED_CODE = `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 d(128, 64, &Wire, -1);
void setup(){
  Serial.begin(9600);
  Serial.println("OLED_RDY");
  Wire.setSDA(4); Wire.setSCL(5);
  d.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  d.clearDisplay();
  d.setTextSize(2); d.setTextColor(SSD1306_WHITE);
  d.setCursor(0, 0); d.println("OpenHW"); d.display();
  Serial.println("OLED_DRAWN");
}
void loop(){
  d.clearDisplay(); d.setCursor(0, 0); d.println(millis()); d.display();
  Serial.println("OLED_TICK"); delay(300);
}
`;
const LCD2004_CODE = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 20, 4);
void setup(){
  Serial.begin(9600);
  Serial.println("LCD_RDY");
  Wire.setSDA(4); Wire.setSCL(5);
  lcd.init(); lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("OpenHW");
  lcd.setCursor(0, 1); lcd.print("Pico");
  Serial.println("LCD_SET");
}
void loop(){ Serial.println("LCD_TICK"); delay(1000); }
`;

const LCD1602_CODE = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
void setup(){
  Serial.begin(9600);
  Serial.println("LC2_RDY");
  Wire.setSDA(4); Wire.setSCL(5);
  lcd.init(); lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("OpenHW");
  lcd.setCursor(0, 1); lcd.print("Pico");
  Serial.println("LC2_SET");
}
void loop(){ Serial.println("LC2_TICK"); delay(1000); }
`;

// Parallel HD44780 (4-bit): RS GP15, E GP16, D4-D7 GP17-20.
const LCD2004P_CODE = `#include <LiquidCrystal.h>
LiquidCrystal lcd(15, 16, 17, 18, 19, 20);
void setup(){
  Serial.begin(9600);
  Serial.println("LC4_RDY");
  lcd.begin(20, 4);
  lcd.setCursor(0, 0); lcd.print("OpenHW");
  lcd.setCursor(0, 1); lcd.print("Pico");
  Serial.println("LC4_SET");
}
void loop(){ Serial.println("LC4_TICK"); delay(1000); }
`;
const LCD1602P_CODE = `#include <LiquidCrystal.h>
LiquidCrystal lcd(15, 16, 17, 18, 19, 20);
void setup(){
  Serial.begin(9600);
  Serial.println("LC2_RDY");
  lcd.begin(16, 2);
  lcd.setCursor(0, 0); lcd.print("OpenHW");
  lcd.setCursor(0, 1); lcd.print("Pico");
  Serial.println("LC2_SET");
}
void loop(){ Serial.println("LC2_TICK"); delay(1000); }
`;

// ── i2c sensors ─────────────────────────────────────────────────────────
// Raw Wire on purpose: these prove the DEVICE MODEL answers a real bus
// transaction, independent of any vendor library's register quirks.
const MPU6050_CODE = `#include <Wire.h>
void setup(){
  Serial.begin(9600);
  Serial.println("MPU_RDY");
  Wire.setSDA(4); Wire.setSCL(5); Wire.begin();
  Wire.beginTransmission(0x68); Wire.write(0x6B); Wire.write(0); Wire.endTransmission();
  delay(100);
}
void loop(){
  Wire.beginTransmission(0x68); Wire.write(0x3B); Wire.endTransmission(false);
  Wire.requestFrom(0x68, 14);
  int ax = Wire.read() << 8 | Wire.read();
  int ay = Wire.read() << 8 | Wire.read();
  int az = Wire.read() << 8 | Wire.read();
  Serial.print("MPU_ACC:"); Serial.print(ax); Serial.print(",");
  Serial.print(ay); Serial.print(","); Serial.println(az);
  delay(500);
}
`;
const BMP180_CODE = `#include <Wire.h>
void setup(){
  Serial.begin(9600);
  Serial.println("BMP_RDY");
  Wire.setSDA(4); Wire.setSCL(5); Wire.begin();
  Wire.beginTransmission(0x77); Wire.write(0xD0); Wire.endTransmission(false);
  Wire.requestFrom(0x77, 2);
  int id = Wire.read(); Wire.read();
  Serial.print("BMP_ID:"); Serial.println(id, HEX);
}
void loop(){
  Wire.beginTransmission(0x77); Wire.write(0xF4); Wire.write(0x2E); Wire.endTransmission();
  delay(50);
  Wire.beginTransmission(0x77); Wire.write(0xF6); Wire.endTransmission(false);
  Wire.requestFrom(0x77, 2);
  int ut = Wire.read() << 8 | Wire.read();
  Serial.print("BMP_UT:"); Serial.println(ut);
  delay(1000);
}
`;

// ── inputs ──────────────────────────────────────────────────────────────
const POT_CODE = `void setup(){
  Serial.begin(9600);
  Serial.println("POT_RDY");
  analogReadResolution(12);
}
void loop(){ Serial.print("POT:"); Serial.println(analogRead(26)); delay(500); }
`;
// Pressed from boot via attrs (the switch model closes, ~1k to GND) — the
// guest-side read is the proof that the component's state reaches the pin.
const BUTTON_CODE = `void setup(){
  Serial.begin(9600);
  Serial.println("BTN_RDY");
  pinMode(16, INPUT_PULLUP);
}
void loop(){ Serial.print("BTN:"); Serial.println(digitalRead(16)); delay(200); }
`;

// Analog sensor modules (each drives its own analog output pin; GP26
// reads it through the runner's per-tick ADC inject).
const LDR_CODE = `void setup(){ Serial.begin(9600); Serial.println("LDR_RDY"); analogReadResolution(12); }
void loop(){ Serial.print("LDR:"); Serial.println(analogRead(26)); delay(500); }
`;
const SOIL_CODE = `void setup(){ Serial.begin(9600); Serial.println("SOIL_RDY"); analogReadResolution(12); }
void loop(){ Serial.print("SOIL:"); Serial.println(analogRead(26)); delay(500); }
`;
const NTC_CODE = `void setup(){ Serial.begin(9600); Serial.println("NTC_RDY"); analogReadResolution(12); }
void loop(){ Serial.print("NTC:"); Serial.println(analogRead(26)); delay(500); }
`;
const SLIDEPOT_CODE = `void setup(){ Serial.begin(9600); Serial.println("SPOT_RDY"); analogReadResolution(12); }
void loop(){ Serial.print("SPOT:"); Serial.println(analogRead(26)); delay(500); }
`;
const JOY_CODE = `void setup(){ Serial.begin(9600); Serial.println("JOY_RDY"); analogReadResolution(12); }
void loop(){ Serial.print("JOY:"); Serial.print(analogRead(26)); Serial.print(","); Serial.println(analogRead(27)); delay(500); }
`;
const SLIDESW_CODE = `void setup(){ Serial.begin(9600); Serial.println("SSW_RDY"); pinMode(16, INPUT); }
void loop(){ Serial.print("SSW:"); Serial.println(digitalRead(16)); delay(200); }
`;
const HCSR04_CODE = `void setup(){ Serial.begin(9600); Serial.println("SR_RDY"); pinMode(15, OUTPUT); pinMode(16, INPUT); }
void loop(){
  digitalWrite(15, LOW); delayMicroseconds(2);
  digitalWrite(15, HIGH); delayMicroseconds(10);
  digitalWrite(15, LOW);
  unsigned long d = pulseIn(16, HIGH, 30000);
  Serial.print("SR:"); Serial.println(d);
  delay(1000);
}
`;
// 4x4 matrix scan: rows GP2-5 driven one at a time, columns GP6-9 read.
// The keypad model's contact is a 1k conductance, so a pressed key pulls
// exactly one column high on exactly one row.
const KEYPAD_CODE = `const int rows[4] = {2, 3, 4, 5};
const int cols[4] = {6, 7, 8, 9};
void setup(){
  Serial.begin(9600);
  Serial.println("KP_RDY");
  for (int i = 0; i < 4; i++) {
    pinMode(rows[i], OUTPUT); digitalWrite(rows[i], LOW);
    pinMode(cols[i], INPUT);
  }
}
void loop(){
  for (int r = 0; r < 4; r++) {
    digitalWrite(rows[r], HIGH);
    delay(60);
    for (int c = 0; c < 4; c++) {
      if (digitalRead(cols[c])) {
        Serial.print("KP:"); Serial.print(r); Serial.print(","); Serial.println(c);
      }
    }
    digitalWrite(rows[r], LOW);
    delay(60);
  }
}
`;

// ── spi ─────────────────────────────────────────────────────────────────
const MAX7219_CODE = `#include <SPI.h>
void wr(uint8_t r, uint8_t d){
  digitalWrite(17, LOW); SPI.transfer(r); SPI.transfer(d); digitalWrite(17, HIGH);
}
void setup(){
  Serial.begin(9600);
  Serial.println("MX_RDY");
  SPI.begin();
  SPI.beginTransaction(SPISettings(8000000, MSBFIRST, SPI_MODE0));
  pinMode(17, OUTPUT);
  wr(0x0C, 0x01);  // shutdown -> normal
  wr(0x0A, 0x08);  // intensity
  wr(0x0B, 0x07);  // scan all 8 digits
  wr(0x01, 0x7E);  // digit 0: segments B..G
  wr(0x02, 0x30);
  Serial.println("MX_DRAWN");
}
void loop(){ Serial.println("MX_TICK"); delay(1000); }
`;

// PCD8544 over SPI0 (SCK GP18 / MOSI GP19 / SCE GP17 / DC GP16 / RST GP15).
// Every command is followed by a short delay so the bus drain lands it while
// DC is still LOW (the mirror drains per tick, so a tight cmd+data burst
// would be attributed to the final DC level).
const N5110_CODE = `#include <SPI.h>
#define SCE 17
#define DC 16
#define RST 15
// DC is sampled at the runner's tick boundary (the SPI mirror drains per
// tick), so every mode change is followed by a delay long enough for a
// pump: otherwise a whole cmd+data burst is attributed to one DC level.
void cmd(uint8_t c){ digitalWrite(SCE, LOW); SPI.transfer(c); digitalWrite(SCE, HIGH); }
void dat(uint8_t d){ digitalWrite(SCE, LOW); SPI.transfer(d); digitalWrite(SCE, HIGH); }
void setup(){
  Serial.begin(9600);
  Serial.println("N5110_RDY");
  pinMode(SCE, OUTPUT); pinMode(DC, OUTPUT); pinMode(RST, OUTPUT);
  digitalWrite(SCE, HIGH); digitalWrite(RST, HIGH); delay(20);
  digitalWrite(RST, LOW); delay(20); digitalWrite(RST, HIGH); delay(20);
  SPI.begin();
  SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));
  digitalWrite(DC, LOW); delay(100);
  cmd(0x21); cmd(0xC0); cmd(0x06); cmd(0x13); cmd(0x20); cmd(0x0C);
  delay(100);
  digitalWrite(DC, HIGH); delay(100);
  for (int i = 0; i < 504; i++) dat(0xFF);
  delay(100);
  Serial.println("N5110_DRAWN");
}
void loop(){ Serial.println("N5110_TICK"); delay(1000); }
`;

// 74HC595 shift register: ser GP19 / srclk GP18 / rclk GP17, srclr GP15
// held high, oe grounded. One byte shifted, latched on CS rising.
const SR595_CODE = `#include <SPI.h>
void setup(){
  Serial.begin(9600);
  Serial.println("SR595_RDY");
  pinMode(17, OUTPUT); pinMode(15, OUTPUT);
  digitalWrite(15, HIGH);
  digitalWrite(17, LOW);
  SPI.begin();
  SPI.beginTransaction(SPISettings(8000000, MSBFIRST, SPI_MODE0));
  SPI.transfer(0x81);
  digitalWrite(17, HIGH);
  Serial.println("SR595_LATCHED");
}
void loop(){ Serial.println("SR595_TICK"); delay(1000); }
`;

// NLSF595: the latch keeps the last <=3 bytes of one CS window; the low
// three bits drive B/G/R. 0x000004 lights R1 only.
const NLS595_CODE = `#include <SPI.h>
void setup(){
  Serial.begin(9600);
  Serial.println("NLS_RDY");
  pinMode(17, OUTPUT);
  digitalWrite(17, HIGH);
  SPI.begin();
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  digitalWrite(17, LOW);
  SPI.transfer(0x00);
  SPI.transfer(0x00);
  SPI.transfer(0x04);
  digitalWrite(17, HIGH);
  Serial.println("NLS_SET");
}
void loop(){ Serial.println("NLS_TICK"); delay(1000); }
`;

// L293D: the MCU drives enable (normal speed-control wiring), IN1 high
// and IN2 low must drive OUT1 to the enable level and OUT2 to ground.
const L293D_CODE = `void setup(){
  Serial.begin(9600);
  Serial.println("L293_RDY");
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(18, OUTPUT);
  digitalWrite(16, HIGH); digitalWrite(17, LOW); digitalWrite(18, HIGH);
  Serial.println("L293_SET");
}
void loop(){ Serial.println("L293_TICK"); delay(500); }
`;

// L298N-style driver: ENA and IN1 driven high, IN2 low.
const MOTORDRV_CODE = `void setup(){
  Serial.begin(9600);
  Serial.println("MD_RDY");
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(18, OUTPUT);
  digitalWrite(16, HIGH); digitalWrite(17, HIGH); digitalWrite(18, LOW);
  Serial.println("MD_SET");
}
void loop(){ Serial.println("MD_TICK"); delay(500); }
`;

// A4988: ENABLE low, SLEEP/RESET high, DIR high, three STEP pulses ->
// full-step phase 3 (1A and 2B high, 1B and 2A low).
const A4988_CODE = `void setup(){
  Serial.begin(9600);
  Serial.println("A4988_RDY");
  pinMode(16, OUTPUT); pinMode(17, OUTPUT);
  pinMode(18, OUTPUT); pinMode(19, OUTPUT);
  digitalWrite(16, LOW); digitalWrite(17, HIGH);
  digitalWrite(18, HIGH); digitalWrite(19, HIGH);
  delay(120);
  for (int i = 0; i < 3; i++) {
    digitalWrite(16, HIGH); delay(80);
    digitalWrite(16, LOW); delay(80);
  }
  Serial.println("A4988_STEPPED");
}
void loop(){ Serial.println("A4988_TICK"); delay(1000); }
`;

// 74HC165: d7 tied high, d0-d6 low; pulse PL low to load, then read the
// byte out MSB-first on Q7 with 8 clock pulses.
const HC165_CODE = `const int PIN_Q7 = 16;
const int PIN_PL = 17;
const int PIN_CP = 18;
void setup(){
  Serial.begin(9600);
  Serial.println("HC_RDY");
  pinMode(PIN_Q7, INPUT);
  pinMode(PIN_PL, OUTPUT);
  pinMode(PIN_CP, OUTPUT);
  pinMode(26, OUTPUT); digitalWrite(26, HIGH);
  digitalWrite(PIN_CP, LOW);
  digitalWrite(PIN_PL, HIGH);
  delay(60);
  digitalWrite(PIN_PL, LOW);
  delay(60);
  digitalWrite(PIN_PL, HIGH);
  delay(60);
  int v = 0;
  for (int i = 0; i < 8; i++) {
    v = (v << 1) | (digitalRead(PIN_Q7) ? 1 : 0);
    digitalWrite(PIN_CP, HIGH);
    delay(60);
    digitalWrite(PIN_CP, LOW);
    delay(60);
  }
  Serial.print("HC:"); Serial.println(v);
  Serial.println("HC_DONE");
}
void loop(){ Serial.println("HC_TICK"); delay(1000); }
`;

// ILI9341 over SPI0, raw command/data framing. A 16x16 RAMWR window is
// enough to prove the model's pixel path without overrunning the mirror
// ring (a full 240x320 frame is 153600 bytes). Each DC phase is separated
// by a delay so the tick-boundary pump settles it before the bytes drain.
const ILI9341_CODE = `#include <SPI.h>
#define CS 17
#define DC 16
void cmd(uint8_t c){ digitalWrite(CS, LOW); SPI.transfer(c); digitalWrite(CS, HIGH); }
void setup(){
  Serial.begin(9600);
  Serial.println("ILI_RDY");
  pinMode(CS, OUTPUT); pinMode(DC, OUTPUT);
  digitalWrite(CS, HIGH); digitalWrite(DC, HIGH);
  SPI.begin();
  SPI.beginTransaction(SPISettings(8000000, MSBFIRST, SPI_MODE0));
  digitalWrite(DC, LOW); delay(120);
  cmd(0x2A);
  digitalWrite(DC, HIGH); delay(120);
  digitalWrite(CS, LOW); SPI.transfer(0x00); SPI.transfer(0x00); SPI.transfer(0x00); SPI.transfer(0x0F); digitalWrite(CS, HIGH);
  digitalWrite(DC, LOW); delay(120);
  cmd(0x2B);
  digitalWrite(DC, HIGH); delay(120);
  digitalWrite(CS, LOW); SPI.transfer(0x00); SPI.transfer(0x00); SPI.transfer(0x00); SPI.transfer(0x0F); digitalWrite(CS, HIGH);
  digitalWrite(DC, LOW); delay(120);
  cmd(0x2C);
  digitalWrite(DC, HIGH); delay(120);
  digitalWrite(CS, LOW);
  for (int i = 0; i < 256; i++) { SPI.transfer(0xF8); SPI.transfer(0x00); }
  digitalWrite(CS, HIGH);
  delay(120);
  Serial.println("ILI_DRAWN");
}
void loop(){ Serial.println("ILI_TICK"); delay(1000); }
`;

// PCA9685: write-only I2C PWM driver — the exact class of device the
// Pico I2C write path CAN serve today (no master reads involved).
const PCA9685_CODE = `#include <Wire.h>
void reg(uint8_t r, uint8_t v){
  Wire.beginTransmission(0x40); Wire.write(r); Wire.write(v); Wire.endTransmission();
}
void chan(uint8_t ch, uint16_t off){
  uint8_t b = 0x06 + 4 * ch;
  Wire.beginTransmission(0x40);
  Wire.write(b); Wire.write(0x00); Wire.write(0x00);
  Wire.write(off & 0xFF); Wire.write((off >> 8) & 0x0F);
  Wire.endTransmission();
}
void setup(){
  Serial.begin(9600);
  Serial.println("PCA_RDY");
  Wire.setSDA(4); Wire.setSCL(5); Wire.begin();
  reg(0x00, 0x00);   // MODE1: normal
  reg(0xFE, 121);    // PRESCALE: ~50 Hz
  chan(0, 2048);     // 50 %
  chan(1, 4095);     // full on
  Serial.println("PCA_SET");
}
void loop(){ Serial.println("PCA_TICK"); delay(1000); }
`;

const st = (v, id) => (v.liveOop || {})[id] || {};
const tel = (v, id) => {
  const t = (v.telemetry || []).find((x) => x.id === id);
  return t?.details?.state || t?.details?.custom || {};
};
// Custom (human-named) telemetry only — details.state is the raw mirror.
const custom = (v, id) => {
  const t = (v.telemetry || []).find((x) => x.id === id);
  return t?.details?.custom || t?.details?.metrics?.custom || {};
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
  {
    // Outer gimbal coils on A1/B1; the inner pair is left floating, so a
    // clean sweep must turn only the outer angle.
    family: 'outputs', name: 'biaxial-stepper', type: 'openhw-biaxial-stepper',
    wires: (b) => [
      { from: `${b}:GP16`, to: 'c1:A1+' }, { from: `${b}:GP17`, to: 'c1:A1-' },
      { from: `${b}:GP18`, to: 'c1:B1+' }, { from: `${b}:GP19`, to: 'c1:B1-' },
    ],
    code: STEPPER_CODE, needle: 'STEP_TICK', runMs: 20000,
    check: (v) => {
      const s = st(v, 'c1');
      expect(Math.abs(Number(s.outerAngle || 0))).toBeGreaterThan(0.5);
      expect(Number(s.innerAngle || 0)).toBe(0);
      expect(Number(custom(v, 'c1').outerStepCount || 0)).toBeGreaterThan(0);
    },
  },
  {
    // Same tone path as the buzzer: the speaker's onPWM -> onPWMSignal
    // synthesizes its audio chunk from the measured PWM channel.
    family: 'outputs', name: '5w-speaker', type: 'openhw-5w-speaker',
    wires: (b) => [{ from: `${b}:GP16`, to: 'c1:IN+' }, { from: `${b}:GND`, to: 'c1:IN-' }],
    code: (boardKey) => (boardKey === 'pico2' ? BUZZER_PWM_CODE : BUZZER_CODE),
    needle: 'BUZ_SET', runMs: 12000,
    check: (v) => {
      const c = custom(v, 'c1');
      expect(c.isPlaying).toBe('Yes');
      expect(Math.abs(Number(st(v, 'c1').frequency) - 2000)).toBeLessThan(100);
    },
  },
  {
    // Half-bridge 1 only: EN tied high, IN1/IN2 driven, OUT1/OUT2 read.
    family: 'outputs', name: 'l293d', type: 'openhw-l293d',
    wires: (b) => [
      { from: `${b}:GP16`, to: 'c1:IN1' }, { from: `${b}:GP17`, to: 'c1:IN2' },
      { from: `${b}:GP18`, to: 'c1:EN1,2' },
      { from: `${b}:3V3`, to: 'c1:VCC1' }, { from: `${b}:5V`, to: 'c1:VCC2' },
      { from: `${b}:GND`, to: 'c1:GND1' }, { from: `${b}:GND`, to: 'c1:GND2' },
    ],
    code: L293D_CODE, needle: 'L293_SET', runMs: 15000,
    check: (v) => {
      const av = st(v, 'c1').analogVoltages || {};
      expect(Number(av.OUT1)).toBeGreaterThan(2.5);
      expect(Number(av.OUT2)).toBeLessThan(0.5);
    },
  },
  {
    // L298N-style dual bridge: ENA + IN1 high, IN2 low -> OUT1 on, OUT2 off.
    family: 'outputs', name: 'motor-driver', type: 'openhw-motor-driver',
    wires: (b) => [
      { from: `${b}:GP16`, to: 'c1:ENA' }, { from: `${b}:GP17`, to: 'c1:IN1' },
      { from: `${b}:GP18`, to: 'c1:IN2' }, { from: `${b}:GND`, to: 'c1:GND' },
      { from: `${b}:5V`, to: 'c1:12V' },
    ],
    code: MOTORDRV_CODE, needle: 'MD_SET', runMs: 15000,
    check: (v) => {
      const av = st(v, 'c1').analogVoltages || {};
      expect(Number(av.OUT1)).toBeGreaterThan(2.5);
      expect(Number(av.OUT2)).toBeLessThan(0.5);
      expect(st(v, 'c1').active).toBe(true);
    },
  },
  {
    // Full-step indexer: three STEP edges with DIR high end on phase 3.
    family: 'outputs', name: 'a4988', type: 'openhw-a4988',
    wires: (b) => [
      { from: `${b}:GP16`, to: 'c1:STEP' }, { from: `${b}:GP17`, to: 'c1:DIR' },
      { from: `${b}:GP18`, to: 'c1:SLEEP' }, { from: `${b}:GP19`, to: 'c1:RESET' },
      { from: `${b}:GND`, to: 'c1:ENABLE' },
      { from: `${b}:3V3`, to: 'c1:VDD' }, { from: `${b}:5V`, to: 'c1:VMOT' },
      { from: `${b}:GND`, to: 'c1:GND_LOGIC' },
    ],
    code: A4988_CODE, needle: 'A4988_STEPPED', runMs: 18000,
    check: (v) => {
      const av = st(v, 'c1').analogVoltages || {};
      expect(Number(av['1A'])).toBeGreaterThan(2.5);
      expect(Number(av['1B'])).toBeLessThan(0.5);
      expect(Number(av['2A'])).toBeLessThan(0.5);
      expect(Number(av['2B'])).toBeGreaterThan(2.5);
      expect(st(v, 'c1').active).toBe(true);
    },
  },
  {
    family: 'outputs', name: 'npn-transistor', type: 'openhw-npn-transistor',
    wires: (b) => [
      { from: `${b}:GP16`, to: 'c1:B' }, { from: `${b}:GP17`, to: 'c1:C' },
      { from: `${b}:GND`, to: 'c1:E' },
    ],
    code: NPN_CODE, needle: 'NPN_CYCLE', runMs: 18000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/NPN:(\d)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(4);
      expect(vals).toContain(1);
      expect(vals).toContain(0);
    },
  },
  {
    family: 'displays', name: 'oled', type: 'openhw-ssd1306-oled',
    wires: (b) => [
      { from: `${b}:GP4`, to: 'c1:SDA' }, { from: `${b}:GP5`, to: 'c1:SCL' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: OLED_CODE, needle: 'OLED_DRAWN', runMs: 22000,
    check: (v) => {
      // vramFillPercentage is the model's own pixel count; updateCount
      // proves the controller accepted draw commands even if the sample
      // lands on an empty frame.
      const fill = Number(custom(v, 'c1').vramFillPercentage
        ?? st(v, 'c1').vramFillPercentage ?? NaN);
      const updates = Number(st(v, 'c1').updateCount || 0);
      expect(Number.isFinite(fill) && fill > 0 ? true : updates > 0).toBe(true);
    },
  },
  {
    family: 'displays', name: 'lcd2004', type: 'openhw-lcd2004-i2c',
    wires: (b) => [
      { from: `${b}:GP4`, to: 'c1:SDA' }, { from: `${b}:GP5`, to: 'c1:SCL' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: LCD2004_CODE, needle: 'LCD_SET', runMs: 22000,
    check: (v) => {
      const lines = (st(v, 'c1').lines || []).join(' ');
      expect(lines).toContain('OpenHW');
      expect(lines).toContain('Pico');
    },
  },
  {
    // Same PCF8574 backpack path as the LCD2004, 16x2 geometry.
    family: 'displays', name: 'lcd1602-i2c', type: 'openhw-lcd1602-i2c',
    wires: (b) => [
      { from: `${b}:GP4`, to: 'c1:SDA' }, { from: `${b}:GP5`, to: 'c1:SCL' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: LCD1602_CODE, needle: 'LC2_SET', runMs: 22000,
    check: (v) => {
      const lines = (st(v, 'c1').lines || []).join(' ');
      expect(lines).toContain('OpenHW');
      expect(lines).toContain('Pico');
    },
  },
  {
    family: 'displays', name: 'lcd2004-parallel', type: 'openhw-lcd2004',
    blocked: 'runner strobe gap (see matrix (k)): the HD44780 latches on '
      + 'the E falling edge, but the parallel 4-bit write (RS + nibble + E '
      + 'high + E low) completes inside one runner tick (~16ms) and GPIO '
      + 'levels are sampled once per tick, so the model never sees E high. '
      + 'The I2C backpack variants are proven green; this needs per-edge '
      + 'GPIO dispatch like the SPI/I2C mirrors.',
    wires: (b) => [
      { from: `${b}:GP15`, to: 'c1:RS' }, { from: `${b}:GP16`, to: 'c1:E' },
      { from: `${b}:GP17`, to: 'c1:D4' }, { from: `${b}:GP18`, to: 'c1:D5' },
      { from: `${b}:GP19`, to: 'c1:D6' }, { from: `${b}:GP20`, to: 'c1:D7' },
      { from: `${b}:3V3`, to: 'c1:VDD' }, { from: `${b}:GND`, to: 'c1:VSS' },
      { from: `${b}:GND`, to: 'c1:V0' }, { from: `${b}:3V3`, to: 'c1:A' },
      { from: `${b}:GND`, to: 'c1:K' },
    ],
    code: LCD2004P_CODE, needle: 'LC4_SET', runMs: 22000,
    check: (v) => {
      const lines = (st(v, 'c1').lines || []).join(' ');
      expect(lines).toContain('OpenHW');
      expect(lines).toContain('Pico');
    },
  },
  {
    family: 'displays', name: 'lcd1602-parallel', type: 'openhw-lcd1602',
    blocked: 'runner strobe gap (see matrix (k)): the HD44780 latches on '
      + 'the E falling edge, but the parallel 4-bit write (RS + nibble + E '
      + 'high + E low) completes inside one runner tick (~16ms) and GPIO '
      + 'levels are sampled once per tick, so the model never sees E high. '
      + 'The I2C backpack variants are proven green; this needs per-edge '
      + 'GPIO dispatch like the SPI/I2C mirrors.',
    wires: (b) => [
      { from: `${b}:GP15`, to: 'c1:RS' }, { from: `${b}:GP16`, to: 'c1:E' },
      { from: `${b}:GP17`, to: 'c1:D4' }, { from: `${b}:GP18`, to: 'c1:D5' },
      { from: `${b}:GP19`, to: 'c1:D6' }, { from: `${b}:GP20`, to: 'c1:D7' },
      { from: `${b}:3V3`, to: 'c1:VDD' }, { from: `${b}:GND`, to: 'c1:VSS' },
      { from: `${b}:GND`, to: 'c1:V0' }, { from: `${b}:3V3`, to: 'c1:A' },
      { from: `${b}:GND`, to: 'c1:K' },
    ],
    code: LCD1602P_CODE, needle: 'LC2_SET', runMs: 22000,
    check: (v) => {
      const lines = (st(v, 'c1').lines || []).join(' ');
      expect(lines).toContain('OpenHW');
      expect(lines).toContain('Pico');
    },
  },
  {
    family: 'i2c', name: 'mpu6050', type: 'openhw-mpu6050',
    blocked: 'engine gap: the pico I2C mirror answers every master read with '
      + '0xFF (sdd_jsmirror.c jsmirror_i2c_read) and exposes no read-inject '
      + 'export, so device models can never answer the guest. Writes are '
      + 'proven by the oled/lcd2004 cells; promote this cell when the engine '
      + 'adds an I2C read queue.',
    wires: (b) => [
      { from: `${b}:GP4`, to: 'c1:SDA' }, { from: `${b}:GP5`, to: 'c1:SCL' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: MPU6050_CODE, needle: 'MPU_ACC:', runMs: 22000,
    check: (v) => {
      const acc = [...String(v.serial || '').matchAll(/MPU_ACC:(-?\d+),(-?\d+),(-?\d+)/g)]
        .map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
      expect(acc.length).toBeGreaterThan(3);
      // Static defaults: ax=ay=0, az=1g (16384 LSB). The first samples can
      // be lagged transaction openers; the tail must hold gravity.
      const [ax, ay, az] = acc[acc.length - 1];
      expect(Math.abs(ax)).toBeLessThan(2000);
      expect(Math.abs(ay)).toBeLessThan(2000);
      expect(Math.abs(az - 16384)).toBeLessThan(2000);
      expect(Number(st(v, 'c1').az)).toBeCloseTo(1, 1);
    },
  },
  {
    family: 'i2c', name: 'bmp180', type: 'openhw-bmp180',
    blocked: 'engine gap: no I2C read-inject (see mpu6050 above); the '
      + 'calibration/UT readback needs master reads.',
    wires: (b) => [
      { from: `${b}:GP4`, to: 'c1:SDA' }, { from: `${b}:GP5`, to: 'c1:SCL' },
      { from: `${b}:3V3`, to: 'c1:VIN' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: BMP180_CODE, needle: 'BMP_UT:', runMs: 22000,
    check: (v) => {
      const s = String(v.serial || '');
      expect(s).toContain('BMP_ID:55');
      const uts = [...s.matchAll(/BMP_UT:(\d+)/g)].map((m) => Number(m[1]));
      expect(uts.length).toBeGreaterThan(2);
      // UT = temp*160+32760: 25C -> 36760. The barometric readback only
      // reaches this range when the calibration + write/read path works.
      for (const ut of uts.slice(-3)) expect(ut > 30000 && ut < 42000).toBe(true);
      expect(Number(st(v, 'c1').temperature)).toBeCloseTo(25, 0);
      expect(Number(st(v, 'c1').pressure)).toBeGreaterThan(30000);
    },
  },
  {
    family: 'inputs', name: 'potentiometer', type: 'openhw-potentiometer',
    wires: (b) => [
      { from: `${b}:GP26`, to: 'c1:SIG' },
      { from: `${b}:3V3`, to: 'c1:1' }, { from: `${b}:GND`, to: 'c1:2' },
    ],
    code: POT_CODE, needle: 'POT:', runMs: 22000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/POT:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(3);
      // 50% wiper on a 3V3 rail -> 12-bit mid-scale.
      for (const x of vals.slice(-3)) expect(Math.abs(x - 2048)).toBeLessThan(500);
      expect(Number(st(v, 'c1').value)).toBeCloseTo(50, 0);
    },
  },
  {
    family: 'inputs', name: 'pushbutton', type: 'openhw-pushbutton',
    attrs: { pressed: true },
    wires: (b) => [
      { from: `${b}:GP16`, to: 'c1:1l' }, { from: `${b}:GND`, to: 'c1:2l' },
    ],
    code: BUTTON_CODE, needle: 'BTN:', runMs: 22000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/BTN:(\d)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(3);
      // Closed switch (~1k to GND) must read LOW at the guest pin.
      for (const x of vals.slice(-3)) expect(x).toBe(0);
      expect(st(v, 'c1').pressed).toBe(true);
    },
  },
  {
    // Same MNA switch as the pushbutton (1A/2A 1k when pressed).
    family: 'inputs', name: '6mm-pushbutton', type: 'openhw-pushbutton-6mm',
    attrs: { pressed: true },
    wires: (b) => [
      { from: `${b}:GP16`, to: 'c1:1A' }, { from: `${b}:GND`, to: 'c1:2A' },
    ],
    code: BUTTON_CODE, needle: 'BTN:', runMs: 22000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/BTN:(\d)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(3);
      for (const x of vals.slice(-3)) expect(x).toBe(0);
      expect(st(v, 'c1').pressed).toBe(true);
    },
  },
  {
    // Parallel-in/serial-out: the model latches d0-d7 when PL falls and
    // shifts on CP rising; the guest clocks the loaded byte out on Q7.
    family: 'inputs', name: '74hc165', type: 'openhw-74hc165',
    wires: (b) => [
      { from: `${b}:3V3`, to: 'c1:vcc' }, { from: `${b}:GND`, to: 'c1:gnd' },
      { from: `${b}:GND`, to: 'c1:ce' },
      { from: `${b}:GP26`, to: 'c1:d7' },
      { from: `${b}:GND`, to: 'c1:d0' }, { from: `${b}:GND`, to: 'c1:d1' },
      { from: `${b}:GND`, to: 'c1:d2' }, { from: `${b}:GND`, to: 'c1:d3' },
      { from: `${b}:GND`, to: 'c1:d4' }, { from: `${b}:GND`, to: 'c1:d5' },
      { from: `${b}:GND`, to: 'c1:d6' },
      { from: `${b}:GP17`, to: 'c1:pl' }, { from: `${b}:GP18`, to: 'c1:cp' },
      { from: `${b}:GP16`, to: 'c1:q7' },
    ],
    code: HC165_CODE, needle: 'HC_DONE', runMs: 22000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/HC:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(0);
      expect(vals[vals.length - 1]).toBe(128);
    },
  },
  {
    family: 'inputs', name: 'ldr-module', type: 'openhw-ldr-module',
    wires: (b) => [
      { from: `${b}:GP26`, to: 'c1:AO' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: LDR_CODE, needle: 'LDR:', runMs: 22000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/LDR:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(3);
      // default light=100 -> AO = 3.3*(100.1/1023) ~= 0.32V -> ~401 codes.
      for (const x of vals.slice(-2)) expect(Math.abs(x - 401)).toBeLessThan(120);
      expect(Number(st(v, 'c1').light)).toBe(100);
      expect(Number(custom(v, 'c1').analogOutV)).toBeGreaterThan(0.2);
    },
  },
  {
    family: 'inputs', name: 'soil-moisture', type: 'openhw-soil-moisture-sensor',
    wires: (b) => [
      { from: `${b}:GP26`, to: 'c1:SIG' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: SOIL_CODE, needle: 'SOIL:', runMs: 22000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/SOIL:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(3);
      // moisture 50% -> SIG = 1.65V -> mid-scale.
      for (const x of vals.slice(-2)) expect(Math.abs(x - 2048)).toBeLessThan(350);
      expect(Number(st(v, 'c1').moisture)).toBe(50);
    },
  },
  {
    family: 'inputs', name: 'ntc-thermistor', type: 'openhw-ntc-thermistor',
    wires: (b) => [
      { from: `${b}:GP26`, to: 'c1:A0' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: NTC_CODE, needle: 'NTC:', runMs: 22000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/NTC:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(3);
      for (const x of vals.slice(-3)) expect(Math.abs(x - 2048)).toBeLessThan(120);
    },
  },
  {
    // Bare photoresistor model: output voltage is its own lux curve.
    family: 'inputs', name: 'photoresistor', type: 'openhw-photoresistor',
    attrs: { lux: 500 },
    wires: (b) => [
      { from: `${b}:GP26`, to: 'c1:p2' }, { from: `${b}:GND`, to: 'c1:p1' },
    ],
    code: PHOTO_CODE, needle: 'PR_RDY', runMs: 18000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/PR:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(3);
      const last = vals[vals.length - 1];
      expect(last).toBeGreaterThan(2900);
      expect(last).toBeLessThan(3150);
      expect(String(custom(v, 'c1').lux)).toBe('500 lx');
    },
  },
  {
    // Module-form NTC: 25 C -> half span = 2.5 V on OUT.
    family: 'inputs', name: 'ntc-temperature-sensor', type: 'openhw-ntc-temperature-sensor',
    attrs: { temperature: 25 },
    wires: (b) => [
      { from: `${b}:GP26`, to: 'c1:OUT' }, { from: `${b}:3V3`, to: 'c1:VCC' },
      { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: NTC_MOD_CODE, needle: 'NTC_RDY', runMs: 18000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/NTC:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(3);
      const last = vals[vals.length - 1];
      expect(last).toBeGreaterThan(2950);
      expect(last).toBeLessThan(3250);
      expect(String(custom(v, 'c1').temperature)).toBe('25.0 °C');
    },
  },
  {
    // 2.5 kg on the 5 kg cell -> raw 1050 (0x00041A), MSB-first.
    family: 'inputs', name: 'hx711-5kg', type: 'openhw-hx711_5',
    attrs: { load: 2.5 },
    wires: (b) => [
      { from: `${b}:GP16`, to: 'c1:DT' }, { from: `${b}:GP17`, to: 'c1:SCK' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: HX711_CODE, needle: 'HX_DONE', runMs: 26000,
    check: (v) => {
      const c = custom(v, 'c1');
      expect(Number(c.loadKg)).toBeCloseTo(2.5, 1);
      expect(Number(c.rawValue)).toBe(1050);
      const vals = [...String(v.serial || '').matchAll(/HX:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(0);
      expect(vals[vals.length - 1]).toBe(1050);
    },
  },
  {
    // The app routes the 50 kg type through the same HX711 logic; the
    // proportional scale still lands 2.5 kg on raw 1050.
    family: 'inputs', name: 'hx711-50kg', type: 'openhw-hx711_50',
    attrs: { load: 2.5 },
    wires: (b) => [
      { from: `${b}:GP16`, to: 'c1:DT' }, { from: `${b}:GP17`, to: 'c1:SCK' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: HX711_CODE, needle: 'HX_DONE', runMs: 26000,
    check: (v) => {
      const c = custom(v, 'c1');
      expect(Number(c.loadKg)).toBeCloseTo(2.5, 1);
      expect(Number(c.rawValue)).toBe(1050);
      const vals = [...String(v.serial || '').matchAll(/HX:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(0);
      expect(vals[vals.length - 1]).toBe(1050);
    },
  },
  {
    family: 'inputs', name: 'slide-potentiometer', type: 'openhw-slide-potentiometer',
    attrs: { value: 25 },
    wires: (b) => [
      { from: `${b}:GP26`, to: 'c1:SIG' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: SLIDEPOT_CODE, needle: 'SPOT:', runMs: 22000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/SPOT:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(3);
      // slider at 25% -> SIG = 0.825V -> ~1024 codes.
      for (const x of vals.slice(-2)) expect(Math.abs(x - 1024)).toBeLessThan(250);
      expect(Number(st(v, 'c1').value)).toBe(25);
    },
  },
  {
    family: 'inputs', name: 'analog-joystick', type: 'openhw-analog-joystick',
    attrs: { x: 0.25, y: 0.75 },
    wires: (b) => [
      { from: `${b}:GP26`, to: 'c1:HORZ' }, { from: `${b}:GP27`, to: 'c1:VERT' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: JOY_CODE, needle: 'JOY:', runMs: 22000,
    check: (v) => {
      const pts = [...String(v.serial || '').matchAll(/JOY:(\d+),(\d+)/g)]
        .map((m) => [Number(m[1]), Number(m[2])]);
      expect(pts.length).toBeGreaterThan(3);
      const [hx, vy] = pts[pts.length - 1];
      expect(Math.abs(hx - 1024)).toBeLessThan(250);
      expect(Math.abs(vy - 3071)).toBeLessThan(350);
    },
  },
  {
    family: 'inputs', name: 'slide-switch', type: 'openhw-slide-switch',
    attrs: { value: '1' },
    wires: (b) => [
      { from: `${b}:3V3`, to: 'c1:1' }, { from: `${b}:GND`, to: 'c1:3' },
      { from: `${b}:GP16`, to: 'c1:2' },
    ],
    code: SLIDESW_CODE, needle: 'SSW:', runMs: 22000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/SSW:(\d)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(3);
      // value "1" shorts 3-2, so the wiper sits on GND and reads LOW.
      for (const x of vals.slice(-3)) expect(x).toBe(0);
      expect(String(st(v, 'c1').value)).toBe('1');
    },
  },
  {
    family: 'inputs', name: 'hc-sr04', type: 'openhw-hc-sr04',
    blocked: 'runner timing gap: the model measures the echo correctly '
      + '(lastMeasurement=100cm, echoDurationUs=5800) but drives ECHO for '
      + '5.8ms, shorter than one runner tick (~16ms). Component-driven GPIO '
      + 'levels are sampled per tick, so the guest pulseIn() sees no pulse '
      + '(SR:0). Needs an edge-timed component->board pin path (same class as '
      + 'DHT/IR pulse decoding), not a component fix.',
    wires: (b) => [
      { from: `${b}:GP15`, to: 'c1:TRIG' }, { from: `${b}:GP16`, to: 'c1:ECHO' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: HCSR04_CODE, needle: 'SR:', runMs: 24000,
    check: (v) => {
      const vals = [...String(v.serial || '').matchAll(/SR:(\d+)/g)].map((m) => Number(m[1]));
      expect(vals.length).toBeGreaterThan(2);
      // default distance 100cm at 58us/cm -> ~5800us echo.
      const us = vals[vals.length - 1];
      expect(us).toBeGreaterThan(4000);
      expect(us).toBeLessThan(8000);
      expect(Number(st(v, 'c1').distance)).toBe(100);
    },
  },
  {
    // The model only connects a key from an event/state, so the cell seeds
    // the press pair directly (the UI does the same on key 5: R2,C1).
    family: 'inputs', name: 'membrane-keypad', type: 'openhw-membrane-keypad',
    attrs: { pressedKey: '5', connectedPair: ['R2', 'C1'] },
    wires: (b) => [
      { from: `${b}:GP2`, to: 'c1:R1' }, { from: `${b}:GP3`, to: 'c1:R2' },
      { from: `${b}:GP4`, to: 'c1:R3' }, { from: `${b}:GP5`, to: 'c1:R4' },
      { from: `${b}:GP6`, to: 'c1:C1' }, { from: `${b}:GP7`, to: 'c1:C2' },
      { from: `${b}:GP8`, to: 'c1:C3' }, { from: `${b}:GP9`, to: 'c1:C4' },
    ],
    code: KEYPAD_CODE, needle: 'KP:', runMs: 24000,
    check: (v) => {
      const keys = [...String(v.serial || '').matchAll(/KP:(\d),(\d)/g)].map((m) => `${m[1]}${m[2]}`);
      expect(keys.length).toBeGreaterThan(2);
      // Key 5 sits at row 2 / col 1 (R2,C1) -> scan reports 1,0.
      expect(keys).toContain('10');
      expect(String(st(v, 'c1').pressedKey)).toBe('5');
    },
  },
  {
    family: 'i2c', name: 'pca9865', type: 'openhw-pca9865',
    attrs: { i2cAddress: '0x40' },
    wires: (b) => [
      { from: `${b}:GP4`, to: 'c1:SDA' }, { from: `${b}:GP5`, to: 'c1:SCL' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: PCA9685_CODE, needle: 'PCA_SET', runMs: 22000,
    check: (v) => {
      const duty = custom(v, 'c1').dutyCycles || {};
      expect(Number(duty['0'] ?? duty[0] ?? NaN)).toBeCloseTo(50, 0);
      expect(Number(duty['1'] ?? duty[1] ?? NaN)).toBeGreaterThan(99);
    },
  },
  {
    family: 'spi', name: 'max7219', type: 'openhw-max7219',
    wires: (b) => [
      { from: `${b}:GP19`, to: 'c1:DIN' }, { from: `${b}:GP18`, to: 'c1:CLK' },
      { from: `${b}:GP17`, to: 'c1:CS' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: MAX7219_CODE, needle: 'MX_DRAWN', runMs: 22000,
    check: (v) => {
      const mx = custom(v, 'c1');
      const matrix = mx.matrix || st(v, 'c1').matrix || [];
      expect(mx.shutdown === false || st(v, 'c1').shutdown === false).toBe(true);
      expect(matrix[0]).toBe(0x7e);
      expect(matrix[1]).toBe(0x30);
    },
  },
  {
    family: 'spi', name: 'nokia5110', type: 'openhw-nokia-5110',
    wires: (b) => [
      { from: `${b}:GP19`, to: 'c1:DN' }, { from: `${b}:GP18`, to: 'c1:SCLK' },
      { from: `${b}:GP17`, to: 'c1:SCE' }, { from: `${b}:GP16`, to: 'c1:DC' },
      { from: `${b}:GP15`, to: 'c1:RST' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:3V3`, to: 'c1:LED' },
      { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: N5110_CODE, needle: 'N5110_DRAWN', runMs: 24000,
    check: (v) => {
      const mx = custom(v, 'c1');
      const fill = Number(mx.fillPercent ?? NaN);
      const fb = String(st(v, 'c1').fbStr || '');
      // 504 bytes of 0xFF -> the model's own framebuffer fills up.
      expect(Number.isFinite(fill) || fb.length === 1008).toBe(true);
      if (Number.isFinite(fill)) expect(fill).toBeGreaterThan(90);
      expect(fb).toContain('ff');
    },
  },
  {
    family: 'spi', name: '74hc595', type: 'openhw-74hc595',
    wires: (b) => [
      { from: `${b}:GP19`, to: 'c1:ser' }, { from: `${b}:GP18`, to: 'c1:srclk' },
      { from: `${b}:GP17`, to: 'c1:rclk' }, { from: `${b}:GP15`, to: 'c1:srclr' },
      { from: `${b}:GND`, to: 'c1:oe' }, { from: `${b}:3V3`, to: 'c1:vcc' },
      { from: `${b}:GND`, to: 'c1:gnd' },
    ],
    code: SR595_CODE, needle: 'SR595_LATCHED', runMs: 22000,
    check: (v) => {
      expect(Number(st(v, 'c1').shiftReg)).toBe(0x81);
      expect(Number(st(v, 'c1').storageReg)).toBe(0x81);
      // OE grounded: the latched byte drives q0..q7.
      expect(Number(st(v, 'c1').outputs)).toBe(0x81);
    },
  },
  {
    family: 'spi', name: 'nlsf595', type: 'openhw-nlsf595',
    wires: (b) => [
      { from: `${b}:GP19`, to: 'c1:MOSI' }, { from: `${b}:GP18`, to: 'c1:SCK' },
      { from: `${b}:GP17`, to: 'c1:CS' }, { from: `${b}:3V3`, to: 'c1:VCC' },
      { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: NLS595_CODE, needle: 'NLS_SET', runMs: 18000,
    check: (v) => {
      const c = custom(v, 'c1');
      expect(String(c.latchRegisterHex)).toBe('0x000004');
      expect(c.rOutput).toBe('HIGH');
      expect(c.gOutput).toBe('LOW');
      expect(c.bOutput).toBe('LOW');
      expect(Number(st(v, 'c1').analogVoltages?.R1)).toBeGreaterThan(2.5);
    },
  },
  {
    family: 'spi', name: 'ili9341', type: 'openhw-ili9341',
    wires: (b) => [
      { from: `${b}:GP19`, to: 'c1:MOSI' }, { from: `${b}:GP18`, to: 'c1:SCK' },
      { from: `${b}:GP17`, to: 'c1:CS' }, { from: `${b}:GP16`, to: 'c1:DC' },
      { from: `${b}:GP15`, to: 'c1:RESET' },
      { from: `${b}:3V3`, to: 'c1:VCC' }, { from: `${b}:GND`, to: 'c1:GND' },
    ],
    code: ILI9341_CODE, needle: 'ILI_DRAWN', runMs: 24000,
    check: (v) => {
      const mx = custom(v, 'c1');
      // 256 RGB565 pixels written through RAMWR: the model counts them
      // (writeCount is custom telemetry, not mirrored state).
      expect(Number(mx.writeCount || 0)).toBeGreaterThan(200);
    },
  },
  {
    family: 'i2c', name: 'pca9685', type: 'openhw-pca9685',
    // The model keeps its address private; the runner's generic resolver
    // needs it on the instance to attach a mirror at 0x40.
    attrs: { i2cAddress: '0x40' },
    wires: (b) => [
      { from: `${b}:GP4`, to: 'c1:SDA' }, { from: `${b}:GP5`, to: 'c1:SCL' },
      { from: `${b}:3V3`, to: 'c1:VCC_IN' }, { from: `${b}:GND`, to: 'c1:GND_IN' },
    ],
    code: PCA9685_CODE, needle: 'PCA_SET', runMs: 22000,
    check: (v) => {
      const duty = custom(v, 'c1').dutyCycles || {};
      expect(Number(duty['0'] ?? duty[0] ?? NaN)).toBeCloseTo(50, 0);
      expect(Number(duty['1'] ?? duty[1] ?? NaN)).toBeGreaterThan(99);
    },
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
      if (c.blocked) {
        console.log(`PICOCOMP ${board.key}/${c.name} BLOCKED: ${c.blocked}`);
        test.skip(true, c.blocked);
        return;
      }
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
          { id: 'c1', type: c.type, attrs: c.attrs || {}, x: 480, y: 120 },
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
      console.log(`PICOCOMP ${board.key}/${c.name} av=${JSON.stringify(st(verdict, 'c1').analogVoltages || {})} custom=${JSON.stringify(custom(verdict, 'c1')).slice(0, 300)}`);
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
