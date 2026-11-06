# HANDOVER — lane/pico-cov (Pico family peripheral coverage)

## 1. Mission + status

Close the Pico family's open peripheral columns (matrix.md) with **real live cells** for
`openhw-pico` (M0+) and `openhw-pico-2` (M33): USB-DEV, 1-Wire, I2S, GPIO-in, EEPROM, SD,
IR, Camera, PIO, DMA. Engine-side gaps are delivered as **patch files**, never as edits in
the read-only engine repos.

**STATUS: IN PROGRESS (paused by the integrator — CI/engine-aliasing priority).**
Done + green: PIO, DMA, EEPROM (both boards), USB-DEV (both boards) — 6 column-cells.
Recorded as engine-blocked (NONE, with the reason + owner ask): GPIO-in, 1-Wire, IR
(both boards), Camera (ABSENT — no DCMI silicon), M33 SHA-256, M33 WDT, EXTI, WFI.
**Not started: SD (engine-side gap identified, not yet proven at runtime), I2S.**
`matrix.md` is NOT yet updated in this lane — the successor should do it from §4/§5
(the honest cell values are already decided there).

## 2. Repro commands

```bash
cd /home/danish1075/Documents/simulator/sim-pico-cov
# dev server on its own port 5184 (never touch :5173 / other lanes)
cp vite.config.js vite.agent.config.js          # then: server.port 5184 + strictPort: true
cp playwright.config.js playwright.agent.config.js  # then: baseURL http://localhost:5184,
                                                     #       webServer: undefined (the server is
                                                     #       started detached, never by playwright)
cp .env .env                                    # from the main tree — VITE_API_BASE_URL=http://localhost:5000/api
                                                 # WITHOUT it /api/compile fails (vite proxies /api -> :5001,
                                                 # the backend listens on :5000)
(setsid nohup npx vite --config vite.agent.config.js --host 127.0.0.1 > /tmp/vite-picocov.log 2>&1 &)
# the shared box kills the dev server: /tmp/picocov-vite-watchdog.sh re-launches it (checks :5184 every 8s)

TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest \
  npx playwright test --config=playwright.agent.config.js tests/e2e/<spec>.spec.js --workers=1 --reporter=line

# diagnostic probes (NOT part of the main suite — separate config):
TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest \
  npx playwright test --config=playwright.probe.config.js --workers=1
```
node_modules is a SYMLINK to the main tree — never npm install/ci.
`tickMHz` note: the Pico W/ETH cells need board attr `tickMHz:'125'` (at the 200 MHz M0
default the guest outruns the wall DHCP timers and `begin()` never returns). WiFi needs no
attr. The M33 arch default is 150 MHz, M0 is 200 MHz.

## 3. Files created / changed in this lane

| path | what |
|---|---|
| `src/pages/simulationpage/utils/genericBoardCompile.js` | **BUG FIX**: the Pico `Serial.`→`Serial1.` rewrite was missing the `g` flag — only the FIRST occurrence was rewritten, so every LATER print stayed on arduino-pico's USB CDC and the guest silently dropped it. Also: board attr `usbCdc` now SKIPS the rewrite (keeps the real CDC) and is part of the compile cache key. |
| `src/worker/runners/pico-runner.ts` | USB-CDC mode (board attr `usbCdc`): host-injected bytes go to the CDC OUT endpoint (`_picoemu_write_usb`); new `pollPicoUsb()` reads `_picoemu_usb_state32()` and publishes the enumeration state to an `openhw-usb-device` sink. |
| `src/pages/simulationpage/SimulatorPage.jsx` | e2e-only `OpenHWE2E.serialInput(text, boardId)` → posts the worker's `SERIAL_INPUT` (host→guest bytes). |
| `tests/e2e/pico2-pio-dma.spec.js` | NEW: M33 PIO (WS2812/NeoPixel) + M33 DMA parity cells (firmware byte-identical to the proven M0+ cells). |
| `tests/e2e/pico-usb.spec.js` | NEW: USB-DEV CDC loopback cells (M0+ + M33). |
| `tests/e2e/probes/*.probe.js` + `playwright.probe.config.js` | NEW: diagnostic probes (serial capture, EEPROM bisect, compile body). `*.probe.js` is outside the default testMatch, so the main suite stays clean. |
| `HANDOVER-LANE.md` | this file. |

`vite.agent.config.js` / `playwright.agent.config.js` are lane-local copies, excluded via
`.git/info/exclude` (not committed — re-copy them, they drift).

## 4. Cells — green / red + exact serial evidence

GREEN (live, proven in this lane):
- **M33 PIO (WS2812/NeoPixel)** — `pico2-pio-dma.spec.js`: `PICO2_PIO_SHOWN`; neopixel
  telemetry `activePixels:3 totalPixels:3`, liveOop `pixels:[16711680, 65280, 255]` = R,G,B.
- **M33 DMA** — `PICO2_DMA_CMP:PASS CK:80` (64 B mem-to-mem, byte-exact).
- **M0+ EEPROM** — `PICO_EE_RB:ABCD` + `PICO_NVS_RB:1234` (flash-emul readback).
- **M33 EEPROM** — `PICO2_EE_RB:ABCD` + `PICO2_NVS_RB:1234`.
- **M0+ USB-DEV** — `USBCDC_ECHO:P` ×3; `openhw-usb-device` sink `enumState:"active" rxCount:3`.
- **M33 USB-DEV** — `USBCDC_ECHO:P`; sink `enumState:"active" rxCount:1`.
- Unblocked by the rewrite fix (also green now): M0+/M33 Clocks cells, M0+ TRNG, M0+ WDT.

RED (engine-side — see §5): GPIO-in (M0+ & M33), 1-Wire/DHT22 (M0+ & M33), IR (M0+ & M33),
EXTI (M0+ & M33), M33 SHA-256, M33 WDT, WFI sleep (M0+ & M33).
RED (silicone): Camera — RP2040/RP2350 have **no DCMI** → ABSENT, no cell possible.

## 5. Findings (root causes + evidence + engine-owner asks)

1. **Frontend bug (FIXED here — biggest finding of the lane)**: Pico `Serial.`→`Serial1.`
   rewrite lacked the `g` flag (`genericBoardCompile.js:82`). Evidence: captured the real
   /api/compile body — `"void setup(){Serial1.begin(9600);Serial.print(\"PICO_FCPU:\");Serial.println(F_CPU);…}"`.
   arduino-pico's `SerialUSB::write` drops data while the CDC is not connected, so EVERY
   Pico sketch lost its first output line, and the M33 EEPROM cell produced NO serial at
   all (all its payload prints sat on the CDC). After the fix the probe prints
   `AB\r\nLINE2\r\n…` (was `B\r\nLINE2\r\n…`). This one line unblocked 6+ cells.
2. **Engine gap F2 (blocks 3 columns on BOTH boards)**: no runner→IN-latch inject export.
   `_picoemu_set_gpio` writes the OUT latch only; the guest-visible IN latch stays
   reset-default HIGH → GPIO-in reads stuck-at-1, DHT22 reads 0.00/inf, the IR loopback
   never decodes, EXTI counts 0. Evidence: M33 DHT `PICO2_DHT_T:0.00 DHT_H:0.00`; M0+ DHT
   `inf/inf`; IR `PICO_IR_TIMEOUT`; EXTI `PICO_EXT_CNT:0`; GPIO-in always `1`.
   Ask: export one input-inject (e.g. `_picoemu_set_gpio_input` → `gpio_set_input_pin`).
   The engine already HAS `gpio_set_input_pin` (fires IRQs) and `gpio_inject_level`.
   Cells must stay RED until it lands (do NOT weaken them to HIGH-only).
3. **SD: engine-side gap identified by CODE READING — not yet proven at runtime.**
   `spi_device_cs()` is called ONLY from the RV32 path (`src/rp2350_rv/rv_membus.c:451`).
   The ARM path (M0+/M33) never notifies an attached SPI device of CS assert/deassert, so
   the SD card model's `cs_active` stays 0 and `sdcard_spi_xfer()` returns 0xFF forever
   (`src/sdcard.c:379`); the engine's own unit tests set `sd.cs_active = 1` by hand
   (`tests/test_suite.c:4596`), which confirms the ARM path never drives it.
   The stale comment in `src/spi.c:112-116` already assumes such a watch exists
   ("the board watches GPIO17/20 via the CS/RST edge path … Harmless for ARM: the gpio.c
   watch dedups via edge memory") — but `src/gpio.c` has no SPI/CS watch.
   Ask: call `spi_device_cs(spi_num, level)` from the ARM SIO GPIO write path (the guest's
   CS pin), or make the SD model tolerate a missing CS edge.
   NEXT STEP for the successor: the probe firmware is already compiled —
   `/tmp/opencode/sdprobe.ino` + `/tmp/opencode/sdprobe.uf2` (raw-SPI SD bring-up, prints
   `R0:`/`R8:`/`R41:`/`R58:`), and `/tmp/opencode/wasm-sd.mjs` boots it in the engine WASM
   with `_picoemu_sdcard_load(<fat16.img>, len, 0)`. Run it once; if every response is 0xFF
   the gap is proven at runtime and the SD column is recorded NONE (engine-side).
4. **M33 SHA-256 = engine CSR-map bug (F1)**: engine `devtools.h` maps WDATA_RDY=bit0 /
   SUM_VLD=bit1 / START=bit31; silicon is START=bit0 / WDATA_RDY=bit1 / SUM_VLD=bit2 →
   `sha256_wait_valid_blocking()` never returns. Evidence: `PICO2_SHA_STARTRC:0` +
   `PICO2_SHA_WRITTEN`, no DIGEST. The digest engine itself is proven real (headless:
   direct CSR yields the FIPS vector). Ask: fix the CSR bit positions + honour the BSWAP
   write.
5. **M33 WDT = engine ROM-patch bug (F5)**: watchdog reboot → `reset_runtime_peripherals()`
   → `rom_init()` restores the RP2040-format ROM without re-applying
   `rom_patch_rp2350_arm()` → the guest dies on the unpatched ROM. Evidence: one
   `PICO2_WDT_ARMED` then silence (M0+ reboots 121×). Ask: re-apply the patch in
   `picoemu_watchdog_reboot`.
6. **USB-DEV WORKS with arduino-pico** (good news for the owner): the engine's host-sim
   enumerates arduino-pico's TinyUSB CDC to `active` in the WASM build the app uses; the
   native CLI stalls at `SET_INTERFACE` (`enum=14 ctrl=5`), so the native path is the odd
   one out. `_picoemu_write_usb` / `_picoemu_usb_active` / `_picoemu_usb_state32` all work.
7. **I2S**: the engine has NO I2S peripheral (no I2S in `src/`), and the PIO-based path
   would need a PIO-TX observe tap (`_picoemu_pio_tx_push` exists but is an INJECTION
   path, not an observation of the BCLK/LRC/DIN edges). Not attempted.

## 6. What is left + hard rules for the successor

TODO (in priority order):
1. **SD column** — runtime-proof the §5.3 gap, then record NONE (engine-side) with the
   reason, or (if the engine owner lands the CS watch) add the cell: runner must fetch
   `/firmware/sd/fat16.img` and call `_picoemu_sdcard_load(ptr, len, spiNum)`.
2. **matrix.md update** — Pico rows: PIO/DMA/EEPROM/USB-DEV → FULL (M0+ and M33 with the
   evidence in §4); GPIO-in/1-Wire/IR/SD → NONE with the engine-side reason; Camera →
   ABSENT (no DCMI); keep the existing ABSENT DAC/CAN-2.0/CAN-FD/RTC rows. List the new
   spec names (pico2-pio-dma, pico-usb) next to the Pico spec list.
3. **Engine patch file** — the IN-latch export ask (§5.2) and the SD CS ask (§5.3) as
   patch files in this lane (`patches/` dir) + the diff in the report. The engine repos
   are READ-ONLY: never edit them in place, never build in them, never commit there.
4. Optional: I2S (engine has no I2S peripheral — needs an engine model first).

HARD RULES: never edit ANY file while a cell runs (vite full-reload kills the page);
`--workers=1`; re-run a failing cell once serially before calling it red (the box is
shared and pace-fragile); never touch the main worktree or other `sim-*` lanes; never push
`md`; the pico-emu / esp32-emu engine folders are read-only (deliver patches, never edit
in place); `npm run build` must stay green and `public/version.json` noise must be
reverted after builds.

## 7. Pointers

Global handover: `/home/danish1075/Documents/simulator/HANDOVER.md` and
`OpenHW-studio-frontend/HANDOVER.md` (on `md`). This file supplements them.
Engine contract: `OpenHW-studio-frontend/vendor/emulator-hook-specs/pico-emu.md`.
