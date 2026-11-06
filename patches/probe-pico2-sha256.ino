// RP2350 (M33) SHA-256 probe — runtime proof for
// patches/pico-m33-sha256-csr-map.patch.
//
// Uses the canonical pico-sdk SHA-256 flow
//   pico_sha256_start_blocking(&st, SHA256_BIG_ENDIAN, false)
//   pico_sha256_update_blocking(&st, "abc", 3)
//   pico_sha256_finish(&st, &r)
// and prints the digest.
//
// FIPS 180-4 SHA-256("abc") =
//   BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD
//
// On the repo engine bytes the SDK's sha256_wait_valid_blocking() polls
// SUM_VLD (silicon bit 2) while the engine's CSR map puts SUM_VLD on bit 1
// and START on bit 31 → the wait never ends and NO digest is printed.
#include <Arduino.h>
#include "pico/sha256.h"

static void hx(uint8_t b) { if (b < 16) Serial1.print("0"); Serial1.print(b, HEX); }

void setup() {
  // Serial1 = UART0 (GP0/GP1). The USB-CDC path (Serial) drops bytes when
  // the guest writes faster than the engine picks the CDC IN packet up,
  // so the UART path is the reliable one for a headless probe.
  Serial1.begin(115200);
  Serial1.println("PICO2_SHA_READY");
  pico_sha256_state_t st;
  int rc = pico_sha256_start_blocking(&st, SHA256_BIG_ENDIAN, false);
  Serial1.print("PICO2_SHA_STARTRC:");
  Serial1.println(rc);
  const uint8_t msg[3] = { 'a', 'b', 'c' };
  pico_sha256_update_blocking(&st, msg, 3);
  Serial1.println("PICO2_SHA_WRITTEN");
  sha256_result_t r;
  pico_sha256_finish(&st, &r);
  Serial1.print("PICO2_SHA_DIGEST:");
  for (int i = 0; i < 32; i++) hx(r.bytes[i]);
  Serial1.println();
  // The eight SUM words as the GUEST reads them (before the SDK's bswap).
  for (int i = 0; i < 8; i++) {
    Serial1.print("PICO2_SHA_W");
    Serial1.print(i);
    Serial1.print(":");
    Serial1.println(r.words[i], HEX);
  }
}

void loop() {
  Serial1.println("PICO2_SHA_TICK");
  delay(1000);
}
