// RP2350 RV32 (Hazard3 / RISC-V) capability probe — headless.
//
//   arduino-cli compile --fqbn rp2040:rp2040:rpipico2:arch=riscv \
//     --build-path <build> --output-dir <out> patches/probe-pico2-rv32.ino
//   node patches/probe-pico2-rv32.mjs
//   ENGINE=/path/to/patched/picoemu.wasm.js node patches/probe-pico2-rv32.mjs
//
// What it observes (all of it the GUEST's own view + the engine's
// host-side state — never a host "OK"):
//
//   RVPROBE:OUT15   digitalRead(15) after digitalWrite(15,HIGH)
//                   (the guest's IN latch view of a pin it drives)
//   RVPROBE:SPI     the byte the guest read back from SPI0
//   RVPROBE:I2C     Wire.endTransmission() error code
//   + the engine's GPIO OUT latch and the SPI mirror (MOSI bytes +
//     the CS assert/deassert events the engine's SPI device saw).
//
// Measured on the repo engine bytes (2026-10-22):
//   RV32:  OUT15:0   OUT latch 0x0        <- gpio_put(HIGH) is lost
//           SPI:FF    mirror 1 MOSI byte, CS events (0)
//   M33:   OUT15:0   OUT latch 0x28000    <- the ARM GPIO coprocessor works
//   M0+:   OUT15:1   OUT latch 0x28000
//
// The RV32 difference is the RP2350 interleaved SIO GPIO map (see
// patches/pico-rp2350-sio-gpio-map.patch): the RISC-V core has no GPIO
// coprocessor, so the guest falls back to the SIO registers and every
// write lands on the wrong register.
#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>

void setup() {
  Serial1.begin(115200);
  Serial1.println("RVPROBE:BEGIN");

  // --- GPIO out: write then read back the guest-visible level ---
  pinMode(15, OUTPUT);
  digitalWrite(15, HIGH);
  delay(20);
  Serial1.print("RVPROBE:OUT15:"); Serial1.println(digitalRead(15));

  // --- SPI0: MOSI GP19 / SCK GP18 / CS GP17 ---
  pinMode(17, OUTPUT);
  digitalWrite(17, HIGH);
  SPI.begin();
  SPI.beginTransaction(SPISettings(8000000, MSBFIRST, SPI_MODE0));
  digitalWrite(17, LOW);
  uint8_t r = SPI.transfer(0x5A);
  digitalWrite(17, HIGH);
  SPI.endTransaction();
  Serial1.print("RVPROBE:SPI:"); Serial1.println(r, HEX);

  // --- I2C0 (Wire) ---
  Wire.begin();
  Wire.beginTransmission(0x68);
  Wire.write(0x00);
  uint8_t werr = Wire.endTransmission();
  Serial1.print("RVPROBE:I2C:"); Serial1.println(werr, DEC);

  Serial1.println("RVPROBE:END");
}

void loop() { Serial1.println("TICK"); delay(200); }
