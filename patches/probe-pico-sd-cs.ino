// SD-card SPI bring-up probe (RP2040 / Pico).
//
// Purpose: prove (or disprove) at RUNTIME that the engine's SD model can
// answer the guest. The guest drives SPI0 by hand (MSB-first) with CS on
// GP5 and prints the four card responses:
//
//   R0  <- CMD0  (GO_IDLE_STATE)
//   R7  <- CMD8  (SEND_IF_COND, v2 voltage check)
//   R1  <- ACMD41 (SD_SEND_OP_COND, after CMD55)
//   OCR <- CMD58 (READ_OCR)
//
// The engine model (src/sdcard.c) answers only while `sd->cs_active` is
// set; that flag is raised by spi_device_cs(), which the ARM path never
// calls. If the CS edge never reaches the model, every byte reads 0xFF.
#include <Arduino.h>
#include <SPI.h>

#define PIN_CS 5

static uint8_t xfer(uint8_t v) {
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  uint8_t r = SPI.transfer(v);
  SPI.endTransaction();
  return r;
}

static void csLow()  { digitalWrite(PIN_CS, LOW);  }
static void csHigh() { digitalWrite(PIN_CS, HIGH); }

static uint8_t cmd(uint8_t op, uint8_t a0, uint8_t a1, uint8_t a2, uint8_t a3,
                    uint8_t crc, uint8_t *r1, uint8_t *extra, int nextra) {
  csLow();
  xfer(op);
  xfer(a0); xfer(a1); xfer(a2); xfer(a3);
  xfer(crc);
  if (r1) *r1 = xfer(0xFF);
  if (extra && nextra > 0) {
    for (int i = 0; i < nextra; i++) extra[i] = xfer(0xFF);
  }
  csHigh();
  return 0;
}

void setup() {
  Serial1.begin(115200);
  pinMode(PIN_CS, OUTPUT);
  digitalWrite(PIN_CS, HIGH);
  SPI.begin();
  Serial1.println("SDPROBE:BEGIN");
  delay(50);

  // 80+ clocks with CS high (card power-up)
  csHigh();
  for (int i = 0; i < 20; i++) xfer(0xFF);

  uint8_t r0 = 0xFF, r7[4] = {0xFF, 0xFF, 0xFF, 0xFF}, r1 = 0xFF, r58[4] = {0xFF, 0xFF, 0xFF, 0xFF};

  // CMD0: R0
  cmd(0x40, 0x00, 0x00, 0x00, 0x00, 0x95, &r0, nullptr, 0);
  Serial1.print("SDPROBE:R0:"); Serial1.println(r0, HEX);

  // CMD8: R7 (4 bytes)
  cmd(0x48, 0x00, 0x00, 0x01, 0xAA, 0x87, &r7[0], &r7[1], 3);
  Serial1.print("SDPROBE:R8:");
  for (int i = 0; i < 4; i++) { if (i) Serial1.print(":"); Serial1.print(r7[i], HEX); }
  Serial1.println();

  // CMD55 then ACMD41: R1
  cmd(0x77, 0x00, 0x00, 0x00, 0x00, 0xFF, nullptr, nullptr, 0);
  cmd(0x69, 0x40, 0x00, 0x00, 0x00, 0xFF, &r1, nullptr, 0);
  Serial1.print("SDPROBE:R41:"); Serial1.println(r1, HEX);

  // CMD58: OCR (4 bytes)
  cmd(0x7A, 0x00, 0x00, 0x00, 0x00, 0xFF, &r58[0], &r58[1], 3);
  Serial1.print("SDPROBE:R58:");
  for (int i = 0; i < 4; i++) { if (i) Serial1.print(":"); Serial1.print(r58[i], HEX); }
  Serial1.println();

  Serial1.println("SDPROBE:END");
  delay(50);
}

void loop() {
  delay(1000);
}
