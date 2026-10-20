# HANDOVER — lane/pico-cov (Pico family peripheral coverage)

## 1. Mission + status

Close the Pico family's open peripheral columns (matrix.md) with **real live cells** for
`openhw-pico` (M0+) and `openhw-pico-2` (M33): USB-DEV, 1-Wire, I2S, GPIO-in, EEPROM, SD,
IR, Camera, PIO, DMA. Engine-side gaps are delivered as **patch files**, never as edits in
the read-only engine repos.

**STATUS: IN PROGRESS** — 6 columns green (PIO, DMA, EEPROM ×2 boards, USB-DEV ×2 boards),
4 columns recorded NONE with the engine-side reason (GPIO-in, 1-Wire, IR, Camera=ABSENT),
SD + I2S still open. matrix.md NOT yet updated; commits pending (work in tree).

## 2. Repro commands

```bash
# dev server (own port 5184; watchdog keeps it alive)
cd /home/danish1075/Documents/simulator/sim-pico-cov
cp vite.config.js vite.agent.config.js; cp playwright.config.js playwright.agent.config.js
#   vite.agent.config.js  -> server.port 5184, strictPort
#   playwright.agent.config.js -> baseURL http://localhost:5184, webServer: undefined
(setsid nohup npx vite --config vite.agent.config.js --host 127.0.0.1 > /tmp/vite-picocov.log 2>&1 &)
# watchdog (shared box kills the dev server): /tmp/picocov-vite-watchdog.sh (checks :5184 every 8s)

TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest \
  npx playwright test --config=playwright.agent.config.js tests/e2e/<spec>.spec.js --workers=1 --reporter=line
```
`.env` copied from the main tree (VITE_API_BASE_URL=http://localhost:5000/api) — without it
`/api/compile` fails (vite proxies /api to :5001, backend is on :5000).
node_modules is a SYMLINK to the main tree — never npm install/ci.

## 3. Files created / changed in this lane

| path | what |
|---|---|
| `src/pages/simulationpage/utils/genericBoardCompile.js` | **BUG FIX**: Pico `Serial.`→`Serial1.` rewrite was missing the `g` flag (only the FIRST occurrence was rewritten → every later print stayed on USB CDC and was silently dropped by the guest). Also: board attr `usbCdc` now skips the rewrite (real CDC) and is part of the compile cache key. |
| `src/worker/runners/pico-runner.ts` | USB-CDC mode (board attr `usbCdc`): host-injected bytes go to the CDC OUT endpoint (`_picoemu_write_usb`); new `pollPicoUsb()` reads `_picoemu_usb_state32()` and publishes the enumeration state to an `openhw-usb-device` sink. |
| `src/pages/simulationpage/SimulatorPage.jsx` | e2e-only `OpenHWE2E.serialInput(text, boardId)` → posts the worker's `SERIAL_INPUT` (host→guest bytes). |
| `tests/e2e/pico2-pio-dma.spec.js` | NEW: M33 PIO (WS2812/NeoPixel) + M33 DMA parity cells. |
| `tests/e2e/pico-usb.spec.js` | NEW: USB-DEV CDC loopback cells (M0+ + M33). |
| `tests/e2e/probe-*.spec.js` | NEW: throwaway probes (serial capture, EEPROM bisect, compile body) — delete before merge. |
| `vite.agent.config.js`, `playwright.agent.config.js` | lane-local copies (untracked, gitignored?). |

## 4. Cells — green / red + serial evidence

GREEN (live, this lane):
- **M33 PIO (WS2812/NeoPixel)** — `pico2-pio-dma.spec.js`: `PICO2_PIO_SHOWN`; neopixel
  `activePixels:3 totalPixels:3`, liveOop pixels `[16711680, 65280, 255]` = R,G,B.
- **M33 DMA** — `PICO2_DMA_CMP:PASS CK:80` (64B mem-to-mem byte-exact).
- **M0+ EEPROM** — `PICO_EE_RB:ABCD` / `PICO_NVS_RB:1234` (flash-emul readback).
- **M33 EEPROM** — `PICO2_EE_RB:ABCD` / `PICO2_NVS_RB:1234`.
- **M0+ USB-DEV** — `USBCDC_ECHO:P` ×3; usb-device sink `enumState:"active" rxCount:3`.
- **M33 USB-DEV** — `USBCDC_ECHO:P`; usb-device sink `enumState:"active" rxCount:1`.
- (also green now, pre-existing cells that the rewrite fix unblocked) M0+/M33 Clocks,
  M0+ TRNG, M0+ WDT.

RED (engine-side, see §5): GPIO-in (M0+ & M33), 1-Wire/DHT22 (M0+ & M33), IR (M0+ & M33),
EXTI (M0+ & M33), M33 SHA-256, M33 WDT, WFI sleep (M0+ & M33).

## 5. Findings (root causes + evidence + engine-owner asks)

1. **Frontend bug (FIXED here)**: Pico `Serial.`→`Serial1.` rewrite lacked the `g` flag
   (`genericBoardCompile.js:82`). Evidence: captured the real /api/compile body —
   `"void setup(){Serial1.begin(9600);Serial.print(\"PICO_FCPU:\");Serial.println(F_CPU);…}"`.
   arduino-pico's `SerialUSB::write` drops data while the CDC is not connected, so every
   Pico sketch lost its first output line, and the M33 EEPROM cell produced NO serial at
   all. After the fix the probe prints `AB\r\nLINE2\r\n…` (was `B\r\nLINE2\r\n…`).
2. **Engine gap F2 (unchanged, blocks 3 columns on BOTH boards)**: no runner→IN-latch
   inject export. `_picoemu_set_gpio` writes the OUT latch only; the guest-visible IN latch
   stays reset-default HIGH → GPIO-in reads stuck-at-1, DHT22 reads 0.00, IR loopback never
   decodes, EXTI counts 0. Evidence: M33 DHT `PICO2_DHT_T:0.00 DHT_H:0.00`; M0+ DHT
   `inf/inf`; IR `PICO_IR_TIMEOUT`; EXTI `PICO_EXT_CNT:0`; GPIO-in always `1`.
   Ask: export one input-inject (e.g. `_picoemu_set_gpio_input` → `gpio_set_input_pin`).
   The engine already HAS `gpio_set_input_pin` (fires IRQs) and `gpio_inject_level`.
3. **Camera = ABSENT (silicon)**: RP2040/RP2350 have no DCMI peripheral — no cell possible.
4. **M33 SHA-256 = engine CSR-map bug (F1)**: engine devtools.h maps WDATA_RDY=bit0 /
   SUM_VLD=bit1 / START=bit31, silicon is START=bit0 / WDATA_RDY=bit1 / SUM_VLD=bit2 →
   `sha256_wait_valid_blocking()` never returns. Evidence: `PICO2_SHA_STARTRC:0` +
   `PICO2_SHA_WRITTEN` and no DIGEST. Digest engine itself is proven real (headless).
5. **M33 WDT = engine ROM-patch bug (F5)**: watchdog reboot → `reset_runtime_peripherals()`
   → `rom_init()` restores the RP2040-format ROM without re-applying
   `rom_patch_rp2350_arm()` → the guest dies on unpatched ROM. Evidence: one
   `PICO2_WDT_ARMED` then silence (M0+ reboots 121×).
6. **USB-DEV WORKS with arduino-pico** (good news for the owner): the engine's host-sim
   enumerates arduino-pico's TinyUSB CDC (enum reaches `active`); the native CLI stalls at
   `SET_INTERFACE` (enum=14 ctrl=5) but the WASM build (what the app uses) completes.

## 7. What is left + hard rules

TODO: SD column (engine has `sdcard.c` + `_picoemu_sdcard_load` — runner must call it),
I2S column (engine has NO I2S peripheral; PIO-based I2S needs a TX-observe tap),
matrix.md update (FULL only where proven; NONE + reason otherwise), engine patch file
for the IN-latch export, final commit on lane/pico-cov.

HARD RULES: never edit ANY file while a cell runs (vite full-reload kills the page);
`--workers=1`; re-run a failing cell once serially before calling it red; the pico-emu /
esp32-emu engine repos are READ-ONLY — deliver patches as files in this lane + the diff in
the report; never touch the main worktree or other `sim-*` lanes; never push `md`.

## 8. Pointers

Global handover: `/home/danish1075/Documents/simulator/HANDOVER.md` and
`OpenHW-studio-frontend/HANDOVER.md` (on `md`). This file supplements them.
