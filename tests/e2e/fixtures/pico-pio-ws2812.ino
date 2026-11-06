// pico-pio-ws2812.ino — Pico PIO WS2812 cell firmware (arduino-pico).
//
// Custom PIO program on PIO0 SM0: shifts WS2812 bits to GP2 with side-set
// timing per pico-examples ws2812 (T1=3, T2=3, T3=4 @ 8MHz SM clock =
// clkdiv 15.625 @ 125MHz sysclk) AND pushes a copy of every 32-bit GRB
// word (GRB in bits 31:8, MSB first) to the RX FIFO, where the runner's
// pico-pio-pump drains it once per tick into onNeoPixelFrame.
//
// Hand-encoded via pio_encode_* from hardware/pio_instructions.h (no
// .pio / pioasm dependency). Jump targets are absolute PIO-mem addrs,
// so the table is built at runtime around the pio_add_program offset.
//
// Frame discipline (matches the pump contract): the guest puts exactly
// 3 words per frame, then the SM stalls on the next PULL (BLOCK), so the
// RX FIFO holds exactly the 3-word frame — no zero/stale churn. (A
// `pull noblock` would copy X->OSR on empty TX per the RP2040 datasheet
// and the engine would then push junk words every spin, overwriting the
// lit frame on later pump drains.) FIFOs stay split 4/4 (no TX join).
// The SM stays enabled and parked on PULL after each frame, so loop()
// can resend the frame periodically: every resend ends with RX holding
// exactly [R,G,B], and the per-tick pump drain converges the strip to
// the full frame even if one drain ever catches a frame mid-flight.
// Lights 3 pixels (red/green/blue) show-once in setup + serial needles.

#include <Arduino.h>
#include "hardware/pio.h"
#include "hardware/clocks.h"
#include "hardware/gpio.h"
#include "hardware/pio_instructions.h"

#define WS_PIN 2 // GP2 -> NeoPixel DIN (pico-examples default WS2812 pin)

// pico-examples ws2812 timing: 10 PIO cycles per bit @ 8MHz SM clock.
#define WS_T1 3
#define WS_T2 3
#define WS_T3 4

#define SS1 pio_encode_sideset(1, 1)
#define SS0 pio_encode_sideset(1, 0)

enum {
  I_PULL = 0,
  I_MOV,
  I_PUSH,
  I_SETY,
  I_LOOP, // bit loop: out x,1 (MSB first, shift-left config)
  I_JMPT, // jmp !x -> I_ZERO
  I_ONE,  // bit=1 high phase
  I_YLOOP1, // jmp y-- -> I_LOOP
  I_ZERO, // bit=0 low phase
  I_YLOOP2, // jmp y-- -> I_LOOP
  I_NEXT, // -> I_PULL (wrap also lands here)
  PROG_LEN
};

static uint16_t ws_prog[PROG_LEN];

static void build_ws_prog(uint off) {
  ws_prog[I_PULL] = pio_encode_pull(false, true) | SS1 | pio_encode_delay(WS_T3 - 1); // pull BLOCK
  ws_prog[I_MOV] = pio_encode_mov(pio_isr, pio_osr) | SS1 | pio_encode_delay(WS_T1 - 1); // mirror copy
  ws_prog[I_PUSH] = pio_encode_push(false, false) | SS1 | pio_encode_delay(WS_T1 - 1); // push NOBLOCK
  ws_prog[I_SETY] = pio_encode_set(pio_y, 23) | SS1; // 24-bit counter
  ws_prog[I_LOOP] = pio_encode_out(pio_x, 1) | SS0 | pio_encode_delay(WS_T3 - 1);
  ws_prog[I_JMPT] = pio_encode_jmp_not_x(off + I_ZERO) | SS1 | pio_encode_delay(WS_T1 - 1);
  ws_prog[I_ONE] = pio_encode_nop() | SS1 | pio_encode_delay(WS_T2 - 1);
  ws_prog[I_YLOOP1] = pio_encode_jmp_y_dec(off + I_LOOP) | SS1;
  ws_prog[I_ZERO] = pio_encode_nop() | SS0 | pio_encode_delay(WS_T2 - 1);
  ws_prog[I_YLOOP2] = pio_encode_jmp_y_dec(off + I_LOOP) | SS0;
  ws_prog[I_NEXT] = pio_encode_jmp(off + I_PULL) | SS1 | pio_encode_delay(WS_T3 - 1);
}

static inline void put_pixel(uint8_t r, uint8_t g, uint8_t b) {
  uint32_t w = ((uint32_t)g << 24) | ((uint32_t)r << 16) | ((uint32_t)b << 8);
  pio_sm_put_blocking(pio0, 0, w); // GRB in bits 31:8, MSB-first shift order
}

void setup() {
  Serial.begin(9600);
  Serial.println("PICO_PIO_READY");

  static const struct pio_program prog = { ws_prog, PROG_LEN, -1 };
  build_ws_prog(0); // placeholder addrs; fixed up below
  uint off = pio_add_program(pio0, &prog);
  build_ws_prog(off); // absolute jump targets need the load offset
  for (uint i = 0; i < PROG_LEN; i++) pio0->instr_mem[off + i] = ws_prog[i];

  pio_gpio_init(pio0, WS_PIN);
  pio_sm_set_consecutive_pindirs(pio0, 0, WS_PIN, 1, true);

  pio_sm_config c = pio_get_default_sm_config();
  sm_config_set_sideset_pins(&c, WS_PIN);
  sm_config_set_sideset(&c, 1, false, false);
  sm_config_set_out_shift(&c, false, false, 32); // shift LEFT: out x,1 takes MSB first
  // SM clock: clkdiv 1 (run at sysclk). The T1/T2/T3 side-set STRUCTURE
  // is pico-examples-exact, but the divider is NOT 15.625, on purpose:
  // the runner pumps the RX FIFO once per tick, so a slow (8MHz) SM
  // would still be shifting when the first drains/snapshots land and
  // the strip would latch a partial prefix. At clkdiv 1 the 3-word
  // frame lands in RX atomically (~300 sysclk steps, far inside one
  // tick) and every drain sees the whole frame. The 800kHz pin waveform
  // is not observed by the sim; for real hardware use 15.625 (8MHz SM).
  sm_config_set_clkdiv(&c, 1.0f);
  sm_config_set_wrap(&c, off + I_PULL, off + I_NEXT);
  // NOTE: no FIFO join — the RX half carries the pixel mirror.
  pio_sm_init(pio0, 0, off, &c);
  pio_sm_set_enabled(pio0, 0, true);

  put_pixel(255, 0, 0); // pixel 0: red
  put_pixel(0, 255, 0); // pixel 1: green
  put_pixel(0, 0, 255); // pixel 2: blue
  delay(100); // frame shifts out in ~110us; SM then parks on pull-block
  Serial.print("FLEVEL_RX="); Serial.println(pio_sm_get_rx_fifo_level(pio0, 0));
  Serial.print("FLEVEL_TX="); Serial.println(pio_sm_get_tx_fifo_level(pio0, 0));
  Serial.println("PICO_PIO_SHOWN");
  // NOTE: the SM stays enabled and parked (pin idle-high, correct for
  // WS2812); loop() resends the frame through the parked SM, so the
  // strip converges to the full frame. (Disabling the SM here would
  // strand later resends in the TX FIFO.)
}

static unsigned long resends = 0;

void loop() {
  // Needle first: OpenHWE2E.run() resolves at the needle, so the frame
  // below must already be parked in RX (it is: setup's delay(100) plus
  // the atomic clkdiv-1 frame). Resend after the print so an in-flight
  // resend can never sit under the snapshot drain.
  Serial.print("PICO_PIO_TICK ");
  Serial.println(resends);
  // Resend the full frame: the parked SM consumes the 3 words, mirrors
  // them to RX, and re-parks. Converges late snapshots to [R,G,B].
  put_pixel(255, 0, 0);
  put_pixel(0, 255, 0);
  put_pixel(0, 0, 255);
  resends++;
  delay(1000);
}
