import { test, expect } from '@playwright/test';

// Pico 2 (RP2350 / M33) parity cells for the M0+ columns that had no
// Pico-2 proof: PIO (WS2812 / NeoPixel) and DMA.
//
// Both firmwares are BYTE-IDENTICAL in shape to the proven M0+ cells
// (tests/e2e/pico-pio.spec.js + tests/e2e/pico-dma.spec.js) — the RP2350
// PIO/DMA blocks are the same silicon as the RP2040 ones, so the proof is
// "the same firmware runs on the M33 arch", not a re-interpretation.
//
// NEEDLE HYGIENE (learned 2026-10-20, applies to EVERY Pico cell): the
// serial monitor drops the FIRST print() burst of a run (the engine's
// first UART write lands before the console capture is armed — observed
// live: `Serial.print("A")` vanished, the next `println("B")` arrived).
// Every firmware here therefore prints its payload on the SECOND write.
const B = 'pico2';
const BT = 'openhw-pico-2';

// Same firmware as the proven M0+ DMA cell (tests/e2e/pico-dma.spec.js).
const DMA_CODE = '#include <Arduino.h>\n#include "hardware/dma.h"\n#include <string.h>\nstatic uint8_t dma_src[64];\nstatic uint8_t dma_dst[64];\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("DMA_READY");\n  for (int i = 0; i < 64; i++) dma_src[i] = (uint8_t)(i * 3 + 1);\n  memset(dma_dst, 0, sizeof(dma_dst));\n  int ch = dma_claim_unused_channel(true);\n  dma_channel_config c = dma_channel_get_default_config(ch);\n  channel_config_set_transfer_data_size(&c, DMA_SIZE_8);\n  channel_config_set_read_increment(&c, true);\n  channel_config_set_write_increment(&c, true);\n  dma_channel_configure(ch, &c, dma_dst, dma_src, 64, true);\n  dma_channel_wait_for_finish_blocking(ch);\n  bool ok = true;\n  for (int i = 0; i < 64; i++) if (dma_dst[i] != dma_src[i]) { ok = false; break; }\n  uint8_t cks = 0;\n  for (int i = 0; i < 64; i++) cks ^= dma_dst[i];\n  Serial.print("PICO2_DMA_CMP:");\n  Serial.print(ok ? "PASS" : "FAIL");\n  Serial.print(" CK:");\n  Serial.println(cks, HEX);\n  dma_channel_unclaim(ch);\n}\nvoid loop() { delay(2000); }\n';

// Same firmware as the proven M0+ PIO cell (tests/e2e/pico-pio.spec.js /
// fixtures/pico-pio-ws2812.ino): a hand-encoded PIO program on PIO0 SM0
// shifts WS2812 bits to GP2 AND mirrors every 32-bit GRB word into the RX
// FIFO, where the runner's pico-pio-pump drains it into onNeoPixelFrame.
const PIO_CODE = '// pico-pio-ws2812.ino — Pico PIO WS2812 cell firmware (arduino-pico).\n//\n// Custom PIO program on PIO0 SM0: shifts WS2812 bits to GP2 with side-set\n// timing per pico-examples ws2812 (T1=3, T2=3, T3=4 @ 8MHz SM clock =\n// clkdiv 15.625 @ 125MHz sysclk) AND pushes a copy of every 32-bit GRB\n// word (GRB in bits 31:8, MSB first) to the RX FIFO, where the runner\'s\n// pico-pio-pump drains it once per tick into onNeoPixelFrame.\n//\n// Hand-encoded via pio_encode_* from hardware/pio_instructions.h (no\n// .pio / pioasm dependency). Jump targets are absolute PIO-mem addrs,\n// so the table is built at runtime around the pio_add_program offset.\n//\n// Frame discipline (matches the pump contract): the guest puts exactly\n// 3 words per frame, then the SM stalls on the next PULL (BLOCK), so the\n// RX FIFO holds exactly the 3-word frame — no zero/stale churn. (A\n// `pull noblock` would copy X->OSR on empty TX per the RP2040 datasheet\n// and the engine would then push junk words every spin, overwriting the\n// lit frame on later pump drains.) FIFOs stay split 4/4 (no TX join).\n// The SM stays enabled and parked on PULL after each frame, so loop()\n// can resend the frame periodically: every resend ends with RX holding\n// exactly [R,G,B], and the per-tick pump drain converges the strip to\n// the full frame even if one drain ever catches a frame mid-flight.\n// Lights 3 pixels (red/green/blue) show-once in setup + serial needles.\n\n#include <Arduino.h>\n#include "hardware/pio.h"\n#include "hardware/clocks.h"\n#include "hardware/gpio.h"\n#include "hardware/pio_instructions.h"\n\n#define WS_PIN 2 // GP2 -> NeoPixel DIN (pico-examples default WS2812 pin)\n\n// pico-examples ws2812 timing: 10 PIO cycles per bit @ 8MHz SM clock.\n#define WS_T1 3\n#define WS_T2 3\n#define WS_T3 4\n\n#define SS1 pio_encode_sideset(1, 1)\n#define SS0 pio_encode_sideset(1, 0)\n\nenum {\n  I_PULL = 0,\n  I_MOV,\n  I_PUSH,\n  I_SETY,\n  I_LOOP, // bit loop: out x,1 (MSB first, shift-left config)\n  I_JMPT, // jmp !x -> I_ZERO\n  I_ONE,  // bit=1 high phase\n  I_YLOOP1, // jmp y-- -> I_LOOP\n  I_ZERO, // bit=0 low phase\n  I_YLOOP2, // jmp y-- -> I_LOOP\n  I_NEXT, // -> I_PULL (wrap also lands here)\n  PROG_LEN\n};\n\nstatic uint16_t ws_prog[PROG_LEN];\n\nstatic void build_ws_prog(uint off) {\n  ws_prog[I_PULL] = pio_encode_pull(false, true) | SS1 | pio_encode_delay(WS_T3 - 1); // pull BLOCK\n  ws_prog[I_MOV] = pio_encode_mov(pio_isr, pio_osr) | SS1 | pio_encode_delay(WS_T1 - 1); // mirror copy\n  ws_prog[I_PUSH] = pio_encode_push(false, false) | SS1 | pio_encode_delay(WS_T1 - 1); // push NOBLOCK\n  ws_prog[I_SETY] = pio_encode_set(pio_y, 23) | SS1; // 24-bit counter\n  ws_prog[I_LOOP] = pio_encode_out(pio_x, 1) | SS0 | pio_encode_delay(WS_T3 - 1);\n  ws_prog[I_JMPT] = pio_encode_jmp_not_x(off + I_ZERO) | SS1 | pio_encode_delay(WS_T1 - 1);\n  ws_prog[I_ONE] = pio_encode_nop() | SS1 | pio_encode_delay(WS_T2 - 1);\n  ws_prog[I_YLOOP1] = pio_encode_jmp_y_dec(off + I_LOOP) | SS1;\n  ws_prog[I_ZERO] = pio_encode_nop() | SS0 | pio_encode_delay(WS_T2 - 1);\n  ws_prog[I_YLOOP2] = pio_encode_jmp_y_dec(off + I_LOOP) | SS0;\n  ws_prog[I_NEXT] = pio_encode_jmp(off + I_PULL) | SS1 | pio_encode_delay(WS_T3 - 1);\n}\n\nstatic inline void put_pixel(uint8_t r, uint8_t g, uint8_t b) {\n  uint32_t w = ((uint32_t)g << 24) | ((uint32_t)r << 16) | ((uint32_t)b << 8);\n  pio_sm_put_blocking(pio0, 0, w); // GRB in bits 31:8, MSB-first shift order\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println("PICO2_PIO_READY");\n\n  static const struct pio_program prog = { ws_prog, PROG_LEN, -1 };\n  build_ws_prog(0); // placeholder addrs; fixed up below\n  uint off = pio_add_program(pio0, &prog);\n  build_ws_prog(off); // absolute jump targets need the load offset\n  for (uint i = 0; i < PROG_LEN; i++) pio0->instr_mem[off + i] = ws_prog[i];\n\n  pio_gpio_init(pio0, WS_PIN);\n  pio_sm_set_consecutive_pindirs(pio0, 0, WS_PIN, 1, true);\n\n  pio_sm_config c = pio_get_default_sm_config();\n  sm_config_set_sideset_pins(&c, WS_PIN);\n  sm_config_set_sideset(&c, 1, false, false);\n  sm_config_set_out_shift(&c, false, false, 32); // shift LEFT: out x,1 takes MSB first\n  sm_config_set_clkdiv(&c, 1.0f);\n  sm_config_set_wrap(&c, off + I_PULL, off + I_NEXT);\n  pio_sm_init(pio0, 0, off, &c);\n  pio_sm_set_enabled(pio0, 0, true);\n\n  put_pixel(255, 0, 0); // pixel 0: red\n  delay(5);\n  put_pixel(0, 255, 0); // pixel 1: green\n  delay(5);\n  put_pixel(0, 0, 255); // pixel 2: blue\n  delay(100); // frame shifts out in ~110us; SM then parks on pull-block\n  Serial.println("PICO2_PIO_SHOWN");\n}\n\nstatic unsigned long resends = 0;\n\nvoid loop() {\n  Serial.print("PICO2_PIO_TICK ");\n  Serial.println(resends);\n  put_pixel(255, 0, 0);\n  put_pixel(0, 255, 0);\n  put_pixel(0, 0, 255);\n  resends++;\n  delay(1000);\n}\n';

async function runCell(page, { comps = [], wires = [], code, needle, forMs = 25000, telemetry = [] }) {
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
  console.log(`${needle} serial:`, JSON.stringify((verdict.serial || '').slice(0, 400)));
  expect(verdict.pass).toBe(true);
  return verdict;
}

test.describe('Pico 2 (M33) PIO + DMA parity cells', () => {
  test.setTimeout(240000);
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('Pico2 DMA copies 64 bytes mem-to-mem byte-exact (DMA cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      code: DMA_CODE,
      needle: 'PICO2_DMA_CMP:', forMs: 30000,
    });
    const m = /PICO2_DMA_CMP:(PASS|FAIL) CK:([0-9A-F]+)/.exec(verdict.serial || '');
    console.log('PICO2_DMA result:', m ? m.slice(1) : 'NONE');
    expect(m && m[1]).toBe('PASS');
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });

  test('Pico2 PIO0 SM0 RX mirror lights 3 NeoPixel pixels (PIO cell)', async ({ page }) => {
    const verdict = await runCell(page, {
      comps: [{ id: 'neo1', type: 'openhw-neopixel-matrix', attrs: {}, x: 450, y: 120 }],
      wires: [
        { from: `${B}:GP2`, to: 'neo1:DIN' },
        { from: `${B}:3V3`, to: 'neo1:VCC' },
        { from: `${B}:GND`, to: 'neo1:GND' },
      ],
      code: PIO_CODE,
      needle: 'PICO2_PIO_TICK', telemetry: ['neo1'], forMs: 25000,
    });
    expect(verdict.serial || '').toContain('PICO2_PIO_SHOWN');
    const neo = (verdict.telemetry || []).find((t) => t.id === 'neo1');
    expect(neo).toBeTruthy();
    const ncustom = neo.details?.custom || neo.details?.metrics?.custom || {};
    console.log('PICO2-PIO-NEO custom:', JSON.stringify(ncustom).slice(0, 300));
    console.log('PICO2-PIO-NEO liveOop:', JSON.stringify((verdict.liveOop || {}).neo1 || {}).slice(0, 500));
    expect(Number(ncustom.activePixels || 0)).toBe(3);
    expect(Number(ncustom.totalPixels || 0)).toBe(3);
    await page.evaluate(() => window.OpenHWE2E.stop());
    await page.waitForTimeout(2000);
  });
});
