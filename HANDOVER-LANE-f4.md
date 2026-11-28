# HANDOVER — lane/f4-cov (STM32F4 F407 disco coverage)

**Mission:** close the `openhw-stm32f4` (F407 Discovery) protocol columns in `matrix.md`
with real live cells — re-point the F429-proven LTDC/DCMI/QSPI/FSMC/SAI cells at F407,
add the missing DMA/GPIO-in/RTC/CAN/I2S/1-Wire cells, settle MicroPython, and deliver
engine-side gaps as patch files (the F4 engine repo is READ-ONLY).
**Status: DONE** — 12 columns addressed: **10 GREEN**, 1 engine-side NO-GO (patch
delivered), 1 NONE. No `src/` file was touched (no runner change needed) → the
production build is unaffected. Nothing left to *run* here; §6 lists the open items.

## 2. Repro (this lane)

```bash
W=/home/danish1075/Documents/simulator/sim-f4-cov; cd $W   # node_modules = SYMLINK, never npm install
(setsid nohup npx vite --config vite.agent.config.js --host 127.0.0.1 > /tmp/vite-f4cov.log 2>&1 &)
(setsid nohup /tmp/f4cov-vite-watchdog.sh > /tmp/f4cov-watchdog.log 2>&1 &)   # box is memory-pressured
TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest \
  npx playwright test --config=playwright.agent.config.js tests/e2e/<spec>.spec.js --workers=1
# F407-only filter for the parametrized cells:  -g "openhw-stm32f4\)"
```
Port **5185** (own dep-optimizer cache `.vite-cache-f4cov` — the default
`node_modules/.vite` is SHARED with :5173 and would ping-pong "reloading" kills).
**The lane's vite server and its watchdog were STOPPED at hand-over** (the box was
contended) — start them again with the two commands above; the cache dir is warm, so the
first page load will not trigger a re-optimize reload.
**F4 runs below wall speed:** display/audio cells use `forMs 120000..150000`, 240–300 s
timeouts, ~2.5–3 min wall each; DMA/CAN/GPIO/RTC ~50 s each. Pace/clock cells assert
**guest-time** facts (`tickMHz` divider, `delay(2000)` quanta) — never wall counts.

## 3. Files changed (branch `lane/f4-cov`; lane-local, untracked: `vite.agent.config.js`,
`playwright.agent.config.js`, `.tmp-vitest/`, `.vite-cache-f4cov/`)

| path | what |
|---|---|
| `tests/e2e/stm32f4-{ltdc,dcmi,qspi,fsmc,sai}.spec.js` | F429 → **F429+F407** in one cell (same register maps, no code change) |
| `tests/e2e/stm32f4-dma.spec.js` | **CELL BUG FIX**: polled `DMA2_LISR` bit 5 (reserved) → bit 4 (TCIF0); LISR hex added to the needle |
| `tests/e2e/stm32f4-i2s.spec.js` | **CELL BUG FIX**: wrote `SPI_I2SCFGR` bit 10 (CKPOL) → bit 0 (**I2SMOD**) + I2SE/I2SCFG/MCKDIV |
| `tests/e2e/stm32f4-1wire.spec.js` | header: precise engine gap + patch pointer (cell stays red — engine-side) |
| `patches/f4-systick-val-downcounter.patch` | **engine patch** (SysTick->VAL down-counter); `git apply --check` passes on the live engine tree |
| `patches/README-f4-systick-val.md` | gap write-up + measured evidence + acceptance |
| `matrix.md` / `vendor/emulator-hook-specs/stm32f4-emu.md` | F4 rows + new engine ask + F407 coverage section + acceptance list |

## 4. Cells — green/red + exact serial evidence

| column | result | evidence (serial) |
|---|---|---|
| DMA | GREEN (5/5 chips) | `F407DMA_LISR:18` `F407DMA_SUM:65656` `F407DMA_BAD:0` `F407DMA_OK` |
| GPIO-in | GREEN | `PB0=1 PB1=0` |
| RTC | GREEN | `RTC_NOW:12:0:0` (×2 stamps) |
| CAN-2.0 | GREEN | `CAN_LOOP TX:1 RX:1 ID:123 DLC:8 D0:3020100 D1:7060504` |
| I2S | GREEN (5/5 chips) | `I2S_SUM:16120` `I2S_TX_OK` + runner `SAI_CAP:16:16120` |
| LTDC | GREEN (F429+F407) | `LTDC_SUM:FC7F1F9E` `LTDC_OK`; sink `fbW 64 fbH 32 litPixels 2047` |
| DCMI | GREEN (F429+F407) | `DCMI_SUM:178` `DCMI_OK` + `DCMI_SRC:PASS 4x4`; sink 4×4, 16 lit |
| QSPI | GREEN (F429+F407) | `QSPI_W0:8010000` `QSPI_OK` + `QSPI_MMAP:PASS 256`; sink 32×16, 511 lit |
| FSMC | GREEN (F429+F407) | `FSMC_ID:9341` `FSMC_BANK4_OK` + `FSMC_PX:64`; sink 8×8, 64 lit |
| SAI | GREEN (F429+F407) | `SAI_SUM:16120` `SAI_TX_OK` + runner `SAI_CAP:16:16120` |
| 1-Wire (DHT22) | **RED — engine-side** | `DHT_READ DHT_T:nan DHT_H:nan` (F407) |
| MicroPython | **NONE** | no cell (§5.5) |

## 5. Findings (root causes + evidence)

1. **DMA "engine gap" = CELL bug.** F4 DMA2 `LISR` stream 0 = bits 0..4 → **TCIF0 = bit 4**
   (bit 5 reserved); the cell polled `0x20` → every chip timed out. The model is right
   (`status |= 1<<4`, stream i shifted 6·i). Measured after a completed M2M copy:
   **LISR = 0x18** (HTIF0|TCIF0), NDTR 0, copy byte-exact (sum 65656). Fixed in the cell
   → DMA green on all five chips.
2. **I2S "engine gap" = CELL bug.** On F4 the I2S registers live in the SPIx block:
   `SPI_I2SCFGR` bit 10 = **CKPOL**, **I2SMOD = bit 0** (RM0090 §27.3.3). With I2SMOD
   clear the SPI model stayed plain-SPI → `SPI2_DR` never reached the shared PCM FIFO →
   the runner's `SAI_CAP` marker never fired (guest already printed `I2S_SUM:16120`).
   The engine's own firmware (`firmware/i2s_sai_test/main.c:140`) already used
   `SPI2_I2SCFGR = 1`. Fixed in the cell → I2S green on all five chips.
3. **1-Wire = genuine ENGINE gap: `SysTick->VAL` is not a down-counter.** The model latches
   a toggle (LOAD on even reads, CVR=0 on odd reads) and the STM32duino
   `getCurrentMicros()` derives `micros()`'s sub-ms part from exactly that register →
   `micros()` is 1 ms-quantised. Measured on the deployed bytes (F407, LOAD=167999):
   `VAL x8 = 0,167999,0,167999,0,167999,0,167999`; `micros()-micros()=0`; `micros()`
   over `delayMicroseconds(500)=0` → 26 µs/70 µs DHT22 slots undecodable → NaN on every
   F4 chip. **Ask:** `VAL = LOAD − (instruction_count − last_systick_trigger)`, clamped,
   0 while `CSR.EN` clear (patch delivered; `millis()`/pace unchanged). Host-side 1-Wire
   delivery is already fine (WAKE/ACK/bit stream driven).
4. **No F407-specific fix needed** for LTDC/DCMI/QSPI/FSMC/SAI: register maps identical
   on F407 and F429 (LTDC1 `0x40016800`, DCMI `0x50050000`, QUADSPI `0xA0001000` + mmap
   `0x90000000`, FSMC `0xA0000000`, SAI1 `0x40015800`); the only board delta is the
   Arduino core's `Serial` (Disco F407 = USART2, F429 = USART1) — the runner's
   per-board `uartAddr` handles it.
5. **MicroPython on F4 = NONE.** `stm32f4-emu` boots Arduino/STM32duino images only (no
   MicroPython runtime/REPL), no F4 image in `public/firmware/` (ESP32/RP2040/RP2350
   only), F4 boards registered `firmware: ['arduino-sketch']` (only Pico/ESP32 have
   `micropython-script`). Closing it = upstream STM32F4DISC image + runner REPL inject.
6. **HASH patch dependency: NONE for this lane** — no cell touches HASH, so
   `patches/f4-hash-*.patch` (`patches/README-f4-hash.md`) is **not** a dependency. If a
   successor adds a HASH cell, that README still applies (digest from the alias bank,
   never `HR4` of the main bank).

## 6. Left (unproven — do NOT call these proven) / must-not-do

* **Left:** `f407ve`/`f401`/`f411` **LTDC/DCMI/QSPI/FSMC/SAI** cells (specs now cover
  F429+F407 only; those matrix cells still say NONE). **1-Wire** stays red until the
  owner applies the SysTick patch and rebuilds the wasm (glue+wasm must version-match),
  then re-run `stm32f4-1wire.spec.js` (5 chips) and flip the column to FULL.
  **MicroPython** needs an image + runner REPL inject. `matrix.md`'s **F429 SAI** column
  may be tightened to `FULL (data path only)` with the same evidence as F407's.
* **Do NOT** edit any file while a cell runs (vite full-reloads and kills the cell);
  `--workers=1`; re-run a red cell serially once before calling it red.
* **Do NOT** edit/build/commit/checkout anything in the F4 engine repo
  (`/home/danish1075/Documents/stm32 F4`) — another agent is rebuilding it. Engine
  changes go into `patches/` in THIS repo as patch files only.
* **Do NOT** `npm install`/`npm ci` (node_modules is a symlink); do not touch the main
  worktree or other `sim-*` lanes; do not restart backend :5000 / gateway :5030 /
  host :8092 / main vite :5173. **Do NOT** push `md`.

## 7. Pointers

Global handover: `/home/danish1075/Documents/simulator/HANDOVER.md` (and
`OpenHW-studio-frontend/HANDOVER.md` on `md`). This file supplements it with the
F4/F407 lane detail.
