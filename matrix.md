# Board × Protocol Coverage Matrix

Living tracker of what each board family actually does — and, just as
important, what it does **not**. Every cell carries a **value AND its
reason**. The reason is either a **cell** (a spec file + the serial needle
or telemetry it asserts) or a **file:line** in the engine source. A cell with
no source is not a claim, it is a guess.

- **Last updated: 2026-10-22** — every section survey-verified, then
  **audited cell by cell** (lane/matrix-complete audit): the AVR,
  micro:bit and Retro tables were re-swept against the specs that actually
  exist in `tests/e2e/`, the connectivity extras were re-sourced, the
  "Next to prove" queue was re-ordered and owner-tagged, and the
  engine-byte status was re-measured (`npm run check:engine-bytes`).
  The 2026-10-22 audit closed the last holes: every cell now carries a
  value AND a reason (a cell + the serial needle, or a file:line), the
  two rows that were squashed onto one line (`||`) were split back into
  proper rows, the F4 system-block row was brought up to date with the
  f4-cov2 lane (CRC / RNG / CRYP / WWDG / PWR / Clocks / Debug are no
  longer NONE), and the F1 watchdog needle was corrected to the one the
  cell actually asserts.

## How to read this matrix

### Vocabulary

| value | meaning | what the cell must also carry |
|---|---|---|
| `FULL` | the feature works end to end on that board | the e2e cell + the needle/telemetry that cell asserts |
| `PARTIAL` | part of the feature works | the cell AND exactly what is missing |
| `NONE` | the silicon can do it, nothing proves it yet | **why there is no cell** (engine gap / no fixture / blocked upstream on X) |
| `ABSENT` | the silicon does not have it | the silicon fact (no DAC on the ATmega328P, no USB on the classic ESP32, …) |
| `NO-GO` | we deliberately declined it | the reason we declined |
| `RED` | a cell exists and FAILS | the failing spec + the failure signature |
| `PENDING` | reserved for a not-yet-surveyed area | — (this document currently has **zero** PENDING cells: every section is survey-verified) |

### What counts as evidence for `FULL`

1. A **named e2e cell** — `tests/e2e/<file>.spec.js` — that asserts something
   the **other side** observed.
2. The observed thing must live **outside the guest**: a byte the host
   injected and read back, an engine peripheral counter, a device model's
   pixels / levels / timings.
3. The cell must have run on the **repo-pinned engine bytes**
   (`npm run check:engine-bytes` → repo side OK). A green cell on a
   hand-copied engine byte set proves nothing about the deployed app — see
   "Engine byte status".

### A guest's own "OK" print is NOT proof

`Serial.println("OK")` proves the guest reached the print — nothing more.
The proof is what the **other side** observed. A cell that only asserts the
guest's own print is `PARTIAL`, and the missing observation is named in the
cell. (Example: the micro:bit button-A cell is FULL because the **engine**
reports the edge and the host observes the press, not because the guest says
it saw one.)

### Time facts are asserted in guest-time quanta

Timing claims are stated in **guest time** — the simulated machine's own
clock — never in wall-clock milliseconds: "the guest clock advanced by
exactly one `delay(2000)` quantum", "50 of 50 sample pairs exactly +2000
guest-ms". Wall-clock numbers describe the **host**, not the board, and they
move with host load; a cell that asserted a wall-clock floor would be a
host-speed test wearing a board's clothes (the F4 `stm32f4-clock` cell
originally did exactly that and failed on a slow host although the clock was
fine). Where a **ratio** matters (the F4 tickMHz divider) the cell states
the mechanism and deliberately makes **no** acceleration claim, because one
run cannot measure one.

### Rows that are not protocol columns

Some rows are not protocol columns but **system blocks** (CRC / RNG / HASH /
watchdog / EXTI / clocks / backup) and some are not rows at all but
**cross-family features** (the connectivity extras). Same vocabulary, same
proof standard.

## Engine byte status (measured 2026-10-20)

The bytes every board runs on live in **this repo** (committed) and in the
engine **owner's live folder** (rebuilt every few minutes while CPU work is
in flight). Dev, `npm run build`, the deployed container and the `/vendor`
runtime fallback all load the **repo-pinned** snapshot; the owner folders are
**moving targets** and can never be the deploy artifact (an alias to them
is a hard build failure in CI — the container checks out only this repo).

`npm run check:engine-bytes` re-measures this table. It is **READ ONLY**
and fails **only** when the repo side is broken (a pinned file missing, or a
repo copy that drifted away from its pinned primary). A different owner
folder is *information*, not a failure.

| engine (families) | owner folder | pinned path (repo) | pinned md5 | owner folder md5 **today** | verdict |
|---|---|---|---|---|---|
| STM32F1 | `~/Documents/stm32 emu blue pill/pkg` | `src/engines/stm32f1-emu/pkg/{stm32_bluepill_wasm.js, stm32_bluepill_wasm_bg.wasm, emulator.js, stm32f1.js}` | `43c24f16` + `d1e69c28` + `091a0746` + `f2cff22c` | `43c24f16` + **`641abe52`** + `091a0746` + `f2cff22c` | **MISMATCHED PAIR** — the owner rebuilt the wasm only; do **not** copy out of that folder |
| Pico / Pico 2 | `~/Documents/rp2350/Pico-emu/web` | `src/engines/pico-emu/{picoemu.wasm.js, picoemu.wasm.wasm}` | `c3b784f0` + `0c74dffe` | `c3b784f0` + `0c74dffe` | **SAME** — one matched pair |
| Pico OpenHW fork | — (we build it) | `public/wasm/picoemu-fork.wasm.wasm` | `863559a3` | — | **N/A** — repo-only, deliberately not the owner bytes |
| ESP32 / ESP32-CAM | `~/Documents/esp32 emu/dist/sab` | `src/engines/esp32-emu/dist/sab/{worker-proxy.js, worker-entry.js}` | `3c5c1866` + `4afe24dd` | **no `dist/` at all** | **NOT BUILT** — the owner deleted the build output; the repo snapshot is the only thing that runs |
| ESP32 engine wasm + ROM | `~/Documents/esp32 emu/src/engine/esp-xtensa` | `public/wasm/esp_engine_wasm.wasm` + `public/firmware/esp32-v3-rom.bin` | `d6d17d79` + `445981c7` | `d1c08b41` + `445981c7` | **DIFFERENT** — the repo copy carries the OpenHW patches on purpose |
| STM32F4 | `~/Documents/stm32 F4/site` | `public/vendor/board-engines/stm32f4-emu/site/**` + `public/wasm/stm32_periph_wasm_bg.wasm` | `19a96301` + `9455e31c` + `9631b8db` + `1f36d0ed` + `abd3334f` | `2574b1e2` + `578ce844` + `9f9d7338` + `1f36d0ed` + `abd3334f` (snapshot 20:40) | **DIFFERENT** — the owner is mid-rebuild: the glue, the wasm AND `emulator.js` all moved, so it is a consistent rebuild, not a mismatched pair. The owner md5 column is a **snapshot in time, not a fact**: the F4 owner rebuilt the wasm and the facade **again** within minutes of that snapshot (now `214cfc92` / `c2f06681`) — and the facade moved twice before that (`c00a11f6` → `2c12466c` → `9f9d7338`). That churn is exactly why the repo-pinned snapshot is the deploy artifact and why a refresh must take glue + wasm + facade from **one** build |
| micro:bit v2 | `~/Documents/microbit-v2/demo/pkg` | `public/vendor/board-engines/microbit/*` + `src/worker/engines/microbit/*` + `public/wasm/nrf52833_periph_wasm_bg.wasm` | `112f7ab3` + `d5a0e574` | `112f7ab3` + `d5a0e574` | **SAME** |
| Retro (8086 family) | `~/Documents/8086/pkg` | `public/vendor/board-engines/8086emu/multi_cpu_emu.js` + `public/wasm/multi_cpu_emu_bg.wasm` | `9832e032` + `fa53c0f2` | `9832e032` + `fa53c0f2` | **SAME** |
| AVR (Uno / Mega / Nano / Tiny) | — (pure-JS npm package) | `node_modules/avr8js` 0.21.0 (pinned by `package-lock.json`) | — | — | **N/A** — no owner build; the npm package *is* the engine |

The full protocol — refresh only from a **stable** owner build, always take
glue + wasm + facade from **one** build, run the check before *and* after,
re-run that engine's cells afterwards — is in `docs/engine-bytes.md`, and the
per-engine recipe lives next to the bytes
(`src/engines/<engine>/README.md`, `public/vendor/board-engines/<engine>/README.md`).

## STM32F1 (survey-verified 2026-10-09; engine bytes re-pinned 2026-10-20 — the shipped app was resolving the STALE npm `stm32f1-emu` build, which turned the SoftSerial RX loopback + I2C-RTC cells RED and was the real cause of the DHT RED; with the pinned owner engine bytes DHT22 is green on every F1 board and all other stm32* cells stay green)

**Engine bytes:** repo-pinned `src/engines/stm32f1-emu/pkg/` — glue `43c24f16` + wasm `d1e69c28` + facade `091a0746`/`f2cff22c`, all from **ONE** build (135 wasm exports). Owner folder verdict 2026-10-20: **MISMATCHED PAIR** (the owner's wasm moved to `641abe52`, the glue did not) — the pinned set is what runs; do not hand-copy from that folder. Refresh recipe: `src/engines/stm32f1-emu/README.md`.

| Board | UART | SoftSerial | I2C | SPI | ADC | PWM | DAC | DMA | GPIO-in | RTC | CAN-2.0 | CAN-FD | I2S | 1-Wire/DHT | USB-DEV | USB-HOST | ETH | SDIO | SD-SPI | MicroPython | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-stm32-bluepill | FULL (TX seen by the host — cell multi-board-uart, needle `HELLO_F1A`; the HW-UART RX loopback is unproven on every F1 board, see the family note) | FULL (TX+RX loopback — cell stm32-softserial, needle `SS_RX:` (the host's injected byte came back out of the guest's software UART); TX alone is stm32-softserial-tx → `F1SS_TX_TICK`) | FULL (OLED+LCD+MPU+BMP — cell stm32f1-i2c-sweep, needle `SWEEP_DRAWN` + the host's SSD1306 model telemetry `vramFillPercent`; the LCD2004 cell stm32-i2c → `F1_LCD_READY`, the MPU6050 cell stm32-mpu6050 → `MPU_ACC:`, the BMP180 cell stm32-bmp180 → `BMP_UT:`) | FULL (2026-10-20: the guest READS an SPI slave — SPI NOR flash JEDEC ID C8 40 16 + one data byte A5 over SPI1, 6/6 boards; the MFRC522 VersionReg reads 92 on the bluepill; cell stm32f1-spi-miso, needle `MISO_OK` (the JEDEC ID + data byte the guest read back). The F1 engine's MISO queue is only consumed when a device is attached to the bus (engine src/peripherals/spi.rs, the DR-write arm) — the runner now attaches the engine's own flash model, which is what unblocked SPI reads) | FULL (cell stm32-adc, needle `F1ADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32-pwm, needle `F1PWM_SET` + the host's LED model telemetry) | ABSENT (no DAC in the STM32F1 die — the F1 engine's chip table has no dac entry) | FULL (DMA1 M2M 16 words + TCIF1 — cell stm32f1-dma, needles `BPDMA_SUM:65656` + `BPDMA_BAD:0`) | FULL (cell stm32-gpio-in, needle `GPIOIN_READY` + the guest's own `PB0=1` / `PB1=0` levels) | FULL (cell stm32-rtc, needle `RTC_NOW:` — the host's DS1307 clock reached the guest over I2C) | FULL (bxCAN loopback — cell stm32-can, needle `CAN_LOOP` + the guest's `CAN_LOOP TX:1 RX:1 ID:123 DLC:8` frame) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | FULL (2026-10-20, pinned owner engine bytes: BP 8/8 runs, exact 24.00/50.00 (cell stm32-dht22, needle `DHT_READ`); the RED was the stale npm engine build — per-read nan intermittency itself persists, ~1 in 8 reads) | FULL (2026-10-20: USB-FS control-plane enumeration — bus reset + device/config/lang descriptors + SET_ADDRESS + SET_CONFIGURATION, host-observed; cell stm32f1-usb, needle `USB enum done` + the host sink `enumState=enumerated` / `rxCount=89` (the cell asserts rxCount >= 80). The engine USB model is ONE model for all F1 boards (engine src/peripherals/usb.rs) and the runner host machine is one code path — proven on ALL SIX F1 boards 2026-10-22 - the cell now runs per board type (6/6 green, each board's own run: sink enumState=enumerated, rxCount=89 (the cell asserts rxCount >= 80)); no CDC data phase yet) | ABSENT (every engine USB model is device-only — the guest cannot enumerate a host; see Deliberately out of scope) | ABSENT (no Ethernet MAC on the STM32F1 die) | ABSENT (no SDIO controller on the STM32F1 — the SD path is SPI, see the SD-SPI column) | PARTIAL (2026-10-20: the SD card's SPI answers DO reach the guest (R1 0x01, CMD8 01 00 00 01 AA, OCR 00 C0 FF 80 00) but they land one COMMAND late, so no SD driver can be written and the CMD17 block data is not byte-comparable. The F1 engine has NO SPI-mode SD device: ext_devices.sd_card is the SDIO backing store and the engine binds only spi_flash/lcd/touchscreen/usart_probe to the SPI bus (engine src/ext_devices/mod.rs:50-89), so the card answers through the runner's JS bridge, whose MISO is injected at the engine drain (stm32f1-runner.ts, the onTransfer arm). The F4 avoids this with the engine-native ext_devices.spi_sd (stm32f4-runner.ts:262-266). OWNER ASK: port the F4 engine's SPI-mode SD device to the F1 engine) | NONE (no F1 image: public/firmware ships micropython only for esp32 / rp2040 / rp2350 / microbit, and the F1 board families register firmware: ['arduino-sketch'] only — src/worker/boards-registry.ts:169, 179, 189, 199; the F1 runner has no MicroPython REPL-inject path, unlike esp32-runner.ts:34) | FULL (OLED+LCD+MAX7219+595 — cell stm32f1-sweep, needle `SWEEP_DRAWN` (the host's MAX7219 model showed the digits); OLED: stm32f1-i2c-sweep → `SWEEP_DRAWN` + vramFillPercent; LCD2004: stm32-i2c → `F1_LCD_READY`; 74HC595: stm32-595 → `SR_LATCHED`) |
| openhw-stm32-maple-mini | FULL (TX seen by the host — cell multi-board-uart, needle `HELLO_F1MAPLE`; the HW-UART RX loopback is unproven, see the family note) | FULL (TX+RX — cell stm32f1-maple-cb-2, needle `SS_RX:` — the host's injected byte came back out of the guest's software UART) | FULL (OLED — cell stm32f1-i2c-sweep, needle `SWEEP_DRAWN` + the host's SSD1306 model telemetry `vramFillPercent`; the DS1307 RTC rides the same bus — cell stm32f1-maple-cb-2 → `RTC_NOW:`) | FULL (2026-10-20: the guest READS an SPI slave — SPI NOR flash JEDEC ID C8 40 16 + one data byte A5 over SPI1, 6/6 boards; the MFRC522 VersionReg reads 92 on the bluepill; cell stm32f1-spi-miso, needle `MISO_OK` (the JEDEC ID + data byte the guest read back). The F1 engine's MISO queue is only consumed when a device is attached to the bus (engine src/peripherals/spi.rs, the DR-write arm) — the runner now attaches the engine's own flash model, which is what unblocked SPI reads) | FULL (cell stm32f1-maple-cb, needle `MAPLEADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32f1-maple-cb, needle `MAPLEPWM_SET` + the host's LED model telemetry) | ABSENT (no DAC in the STM32F1 die — the F1 engine's chip table has no dac entry) | FULL (TCIF1 — cell stm32f1-dma, needles `MAPLEDMA_SUM:65656` + `MAPLEDMA_BAD:0`) | FULL (cell stm32f1-maple-cb, needle `MAPLEGPIOIN_READY` + the guest's `PB0=…` / `PB1=…` levels) | FULL (cell stm32f1-maple-cb-2, needle `RTC_NOW:` — the host's DS1307 clock reached the guest over I2C) | FULL (exact loopback — cell stm32f1-maple-cb-2, needle `CAN_LOOP` + the guest's `CAN_LOOP TX:1 RX:1 ID:123 DLC:8` frame) | NO-GO (bxCAN is classic-only — there is no CAN-FD controller on the F1 silicon) | NONE (the F1 engine exposes no I2S peripheral on SPI2 — no cell exists; the same engine gap on every F1 board) | FULL (2026-10-20, pinned owner engine bytes: MP green via stm32f1-maple-cb-2, exact 24.00/50.00; per-read nan intermittency persists) | FULL (2026-10-20: USB-FS control-plane enumeration — bus reset + device/config/lang descriptors + SET_ADDRESS + SET_CONFIGURATION, host-observed; cell stm32f1-usb, needle `USB enum done` + the host sink `enumState=enumerated` / `rxCount=89` (the cell asserts rxCount >= 80). The engine USB model is ONE model for all F1 boards (engine src/peripherals/usb.rs) and the runner host machine is one code path — proven on ALL SIX F1 boards 2026-10-22 - the cell now runs per board type (6/6 green, each board's own run: sink enumState=enumerated, rxCount=89 (the cell asserts rxCount >= 80)); no CDC data phase yet) | ABSENT (every engine USB model is device-only — the guest cannot enumerate a host; see Deliberately out of scope) | ABSENT (no Ethernet MAC on the STM32F1 die) | ABSENT (no SDIO controller on the STM32F1 — the SD path is SPI, see the SD-SPI column) | PARTIAL (2026-10-20: the SD card's SPI answers DO reach the guest (R1 0x01, CMD8 01 00 00 01 AA, OCR 00 C0 FF 80 00) but they land one COMMAND late, so no SD driver can be written and the CMD17 block data is not byte-comparable. The F1 engine has NO SPI-mode SD device: ext_devices.sd_card is the SDIO backing store and the engine binds only spi_flash/lcd/touchscreen/usart_probe to the SPI bus (engine src/ext_devices/mod.rs:50-89), so the card answers through the runner's JS bridge, whose MISO is injected at the engine drain (stm32f1-runner.ts, the onTransfer arm). The F4 avoids this with the engine-native ext_devices.spi_sd (stm32f4-runner.ts:262-266). OWNER ASK: port the F4 engine's SPI-mode SD device to the F1 engine) | NONE (no F1 image: public/firmware ships micropython only for esp32 / rp2040 / rp2350 / microbit, and the F1 board families register firmware: ['arduino-sketch'] only — src/worker/boards-registry.ts:169, 179, 189, 199; the F1 runner has no MicroPython REPL-inject path, unlike esp32-runner.ts:34) | FULL (sweep OLED+MAX7219 — cell stm32f1-sweep, needle `SWEEP_DRAWN` (the host's MAX7219 model showed the digits); OLED: stm32f1-i2c-sweep → `SWEEP_DRAWN` + vramFillPercent) |
| openhw-stm32f103cb | FULL (TX seen by the host — cell stm32f1-maple-cb, needle `CBADC_VAL:` (the guest's USART1 bytes reached the host); this board has no multi-board-uart row) | FULL (TX+RX — cell stm32f1-maple-cb-2, needle `SS_RX:` — the host's injected byte came back out of the guest's software UART) | FULL (OLED — cell stm32f1-i2c-sweep, needle `SWEEP_DRAWN` + the host's SSD1306 model telemetry `vramFillPercent`; the DS1307 RTC rides the same bus — cell stm32f1-maple-cb-2 → `RTC_NOW:`) | FULL (2026-10-20: the guest READS an SPI slave — SPI NOR flash JEDEC ID C8 40 16 + one data byte A5 over SPI1, 6/6 boards; the MFRC522 VersionReg reads 92 on the bluepill; cell stm32f1-spi-miso, needle `MISO_OK` (the JEDEC ID + data byte the guest read back). The F1 engine's MISO queue is only consumed when a device is attached to the bus (engine src/peripherals/spi.rs, the DR-write arm) — the runner now attaches the engine's own flash model, which is what unblocked SPI reads) | FULL (cell stm32f1-maple-cb, needle `CBADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32f1-maple-cb, needle `CBPWM_SET` + the host's LED model telemetry) | ABSENT (no DAC in the STM32F1 die — the F1 engine's chip table has no dac entry) | FULL (TCIF1 — cell stm32f1-dma, needles `CBDMA_SUM:65656` + `CBDMA_BAD:0`) | FULL (cell stm32f1-maple-cb, needle `CBGPIOIN_READY` + the guest's `PB0=…` / `PB1=…` levels) | FULL (cell stm32f1-maple-cb-2, needle `RTC_NOW:` — the host's DS1307 clock reached the guest over I2C) | FULL (exact loopback — cell stm32f1-maple-cb-2, needle `CAN_LOOP` + the guest's `CAN_LOOP TX:1 RX:1 ID:123 DLC:8` frame) | NO-GO (bxCAN is classic-only — there is no CAN-FD controller on the F1 silicon) | NONE (the F1 engine exposes no I2S peripheral on SPI2 — no cell exists; the same engine gap on every F1 board) | FULL (2026-10-20, pinned owner engine bytes: CB green via stm32f1-maple-cb-2, exact 24.00/50.00; per-read nan intermittency persists) | FULL (2026-10-20: USB-FS control-plane enumeration — bus reset + device/config/lang descriptors + SET_ADDRESS + SET_CONFIGURATION, host-observed; cell stm32f1-usb, needle `USB enum done` + the host sink `enumState=enumerated` / `rxCount=89` (the cell asserts rxCount >= 80). The engine USB model is ONE model for all F1 boards (engine src/peripherals/usb.rs) and the runner host machine is one code path — proven on ALL SIX F1 boards 2026-10-22 - the cell now runs per board type (6/6 green, each board's own run: sink enumState=enumerated, rxCount=89 (the cell asserts rxCount >= 80)); no CDC data phase yet) | ABSENT (every engine USB model is device-only — the guest cannot enumerate a host; see Deliberately out of scope) | ABSENT (no Ethernet MAC on the STM32F1 die) | ABSENT (no SDIO controller on the STM32F1 — the SD path is SPI, see the SD-SPI column) | PARTIAL (2026-10-20: the SD card's SPI answers DO reach the guest (R1 0x01, CMD8 01 00 00 01 AA, OCR 00 C0 FF 80 00) but they land one COMMAND late, so no SD driver can be written and the CMD17 block data is not byte-comparable. The F1 engine has NO SPI-mode SD device: ext_devices.sd_card is the SDIO backing store and the engine binds only spi_flash/lcd/touchscreen/usart_probe to the SPI bus (engine src/ext_devices/mod.rs:50-89), so the card answers through the runner's JS bridge, whose MISO is injected at the engine drain (stm32f1-runner.ts, the onTransfer arm). The F4 avoids this with the engine-native ext_devices.spi_sd (stm32f4-runner.ts:262-266). OWNER ASK: port the F4 engine's SPI-mode SD device to the F1 engine) | NONE (no F1 image: public/firmware ships micropython only for esp32 / rp2040 / rp2350 / microbit, and the F1 board families register firmware: ['arduino-sketch'] only — src/worker/boards-registry.ts:169, 179, 189, 199; the F1 runner has no MicroPython REPL-inject path, unlike esp32-runner.ts:34) | FULL (cell stm32f1-sweep, needle `SWEEP_DRAWN` — the host's MAX7219 model showed the digits on this board too; OLED: stm32f1-i2c-sweep → `SWEEP_DRAWN` + vramFillPercent) |
| openhw-stm32-gd32f103c8 | FULL (TX seen by the host — cell stm32-gd32-uart, needle `HELLO_GC8`; the HW-UART RX loopback is unproven, see the family note) | FULL (TX+RX loopback — cell stm32-gd32-wave2, needle `SS_RX:` — the host's injected byte came back out of the guest's software UART) | FULL (OLED+RTC — cell stm32f1-i2c-sweep, needle `SWEEP_DRAWN` + the host's SSD1306 model telemetry `vramFillPercent`; the DS1307 RTC rides the same bus — cell stm32-gd32-wave2 → `RTC_NOW:`) | FULL (2026-10-20: the guest READS an SPI slave — SPI NOR flash JEDEC ID C8 40 16 + one data byte A5 over SPI1, 6/6 boards; the MFRC522 VersionReg reads 92 on the bluepill; cell stm32f1-spi-miso, needle `MISO_OK` (the JEDEC ID + data byte the guest read back). The F1 engine's MISO queue is only consumed when a device is attached to the bus (engine src/peripherals/spi.rs, the DR-write arm) — the runner now attaches the engine's own flash model, which is what unblocked SPI reads) | FULL (cell stm32-gd32-analog, needle `GC8ADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32-gd32-analog, needle `GC8PWM_SET` + the host's LED model telemetry) | ABSENT (no DAC in the STM32F1/GD32F1 die — the F1 engine's chip table has no dac entry) | FULL (TCIF1 — cell stm32-gd32-core, needles `GC8DMA_SUM:65656` + `GC8DMA_BAD:0`) | FULL (cell stm32-gd32-analog, needle `GC8GPIOIN_READY` + the guest's `PB0=…` / `PB1=…` levels) | FULL (SET — cell stm32-gd32-wave2, needle `RTC_NOW:` — the host's DS1307 clock reached the guest over I2C) | FULL (bxCAN loopback — cell stm32-gd32-wave2, needle `CAN_LOOP` + the guest's `CAN_LOOP TX:1 RX:1 ID:123 DLC:8` frame) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | FULL (2026-10-20, pinned owner engine bytes: gd32-wave2 DHT green, exact 24.00/50.00 (cell stm32-gd32-wave2, needle `DHT_READ`); per-read nan intermittency persists) | FULL (2026-10-20: USB-FS control-plane enumeration — bus reset + device/config/lang descriptors + SET_ADDRESS + SET_CONFIGURATION, host-observed; cell stm32f1-usb, needle `USB enum done` + the host sink `enumState=enumerated` / `rxCount=89` (the cell asserts rxCount >= 80). The engine USB model is ONE model for all F1 boards (engine src/peripherals/usb.rs) and the runner host machine is one code path — proven on ALL SIX F1 boards 2026-10-22 - the cell now runs per board type (6/6 green, each board's own run: sink enumState=enumerated, rxCount=89 (the cell asserts rxCount >= 80)); no CDC data phase yet) | ABSENT (every engine USB model is device-only — the guest cannot enumerate a host; see Deliberately out of scope) | ABSENT (no Ethernet MAC on the STM32F1/GD32F1 die) | ABSENT (no SDIO controller on the STM32F1/GD32F1 — the SD path is SPI, see the SD-SPI column) | PARTIAL (2026-10-20: the SD card's SPI answers DO reach the guest (R1 0x01, CMD8 01 00 00 01 AA, OCR 00 C0 FF 80 00) but they land one COMMAND late, so no SD driver can be written and the CMD17 block data is not byte-comparable. The F1 engine has NO SPI-mode SD device: ext_devices.sd_card is the SDIO backing store and the engine binds only spi_flash/lcd/touchscreen/usart_probe to the SPI bus (engine src/ext_devices/mod.rs:50-89), so the card answers through the runner's JS bridge, whose MISO is injected at the engine drain (stm32f1-runner.ts, the onTransfer arm). The F4 avoids this with the engine-native ext_devices.spi_sd (stm32f4-runner.ts:262-266). OWNER ASK: port the F4 engine's SPI-mode SD device to the F1 engine) | NONE (no F1 image: public/firmware ships micropython only for esp32 / rp2040 / rp2350 / microbit, and the F1 board families register firmware: ['arduino-sketch'] only — src/worker/boards-registry.ts:169, 179, 189, 199; the F1 runner has no MicroPython REPL-inject path, unlike esp32-runner.ts:34) | PARTIAL (OLED+MAX7219) |
| openhw-stm32-gd32f103cb | FULL (TX seen by the host — cell stm32-gd32-uart, needle `HELLO_GCB`, and multi-board-uart → `HELLO_F1GD32`; the HW-UART RX loopback is unproven, see the family note) | FULL (TX+RX loopback — cell stm32-gd32-wave2, needle `SS_RX:` — the host's injected byte came back out of the guest's software UART) | FULL (OLED+RTC — cell stm32f1-i2c-sweep, needle `SWEEP_DRAWN` + the host's SSD1306 model telemetry `vramFillPercent`; the DS1307 RTC rides the same bus — cell stm32-gd32-wave2 → `RTC_NOW:`) | FULL (2026-10-20: the guest READS an SPI slave — SPI NOR flash JEDEC ID C8 40 16 + one data byte A5 over SPI1, 6/6 boards; the MFRC522 VersionReg reads 92 on the bluepill; cell stm32f1-spi-miso, needle `MISO_OK` (the JEDEC ID + data byte the guest read back). The F1 engine's MISO queue is only consumed when a device is attached to the bus (engine src/peripherals/spi.rs, the DR-write arm) — the runner now attaches the engine's own flash model, which is what unblocked SPI reads) | FULL (cell stm32-gd32-analog, needle `GCBADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32-gd32-analog, needle `GCBPWM_SET` + the host's LED model telemetry) | ABSENT (no DAC in the STM32F1/GD32F1 die — the F1 engine's chip table has no dac entry) | FULL (TCIF1 — cell stm32-gd32-core, needles `GCBDMA_SUM:65656` + `GCBDMA_BAD:0`) | FULL (cell stm32-gd32-analog, needle `GCBGPIOIN_READY` + the guest's `PB0=…` / `PB1=…` levels) | FULL (SET — cell stm32-gd32-wave2, needle `RTC_NOW:` — the host's DS1307 clock reached the guest over I2C) | FULL (bxCAN loopback — cell stm32-gd32-wave2, needle `CAN_LOOP` + the guest's `CAN_LOOP TX:1 RX:1 ID:123 DLC:8` frame) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | FULL (2026-10-20, pinned owner engine bytes: gd32-wave2 DHT green, exact 24.00/50.00 (cell stm32-gd32-wave2, needle `DHT_READ`); per-read nan intermittency persists) | FULL (2026-10-20: USB-FS control-plane enumeration — bus reset + device/config/lang descriptors + SET_ADDRESS + SET_CONFIGURATION, host-observed; cell stm32f1-usb, needle `USB enum done` + the host sink `enumState=enumerated` / `rxCount=89` (the cell asserts rxCount >= 80). The engine USB model is ONE model for all F1 boards (engine src/peripherals/usb.rs) and the runner host machine is one code path — proven on ALL SIX F1 boards 2026-10-22 - the cell now runs per board type (6/6 green, each board's own run: sink enumState=enumerated, rxCount=89 (the cell asserts rxCount >= 80)); no CDC data phase yet) | ABSENT (every engine USB model is device-only — the guest cannot enumerate a host; see Deliberately out of scope) | ABSENT (no Ethernet MAC on the STM32F1/GD32F1 die) | ABSENT (no SDIO controller on the STM32F1/GD32F1 — the SD path is SPI, see the SD-SPI column) | PARTIAL (2026-10-20: the SD card's SPI answers DO reach the guest (R1 0x01, CMD8 01 00 00 01 AA, OCR 00 C0 FF 80 00) but they land one COMMAND late, so no SD driver can be written and the CMD17 block data is not byte-comparable. The F1 engine has NO SPI-mode SD device: ext_devices.sd_card is the SDIO backing store and the engine binds only spi_flash/lcd/touchscreen/usart_probe to the SPI bus (engine src/ext_devices/mod.rs:50-89), so the card answers through the runner's JS bridge, whose MISO is injected at the engine drain (stm32f1-runner.ts, the onTransfer arm). The F4 avoids this with the engine-native ext_devices.spi_sd (stm32f4-runner.ts:262-266). OWNER ASK: port the F4 engine's SPI-mode SD device to the F1 engine) | NONE (no F1 image: public/firmware ships micropython only for esp32 / rp2040 / rp2350 / microbit, and the F1 board families register firmware: ['arduino-sketch'] only — src/worker/boards-registry.ts:169, 179, 189, 199; the F1 runner has no MicroPython REPL-inject path, unlike esp32-runner.ts:34) | PARTIAL (OLED+MAX7219) |
| openhw-stm32-gd32f103rb | FULL (TX seen by the host — cell stm32-gd32-uart, needle `HELLO_GRB`; the HW-UART RX loopback is unproven, see the family note) | FULL (TX+RX loopback — cell stm32-gd32-wave2, needle `SS_RX:` — the host's injected byte came back out of the guest's software UART) | FULL (OLED+RTC — cell stm32f1-i2c-sweep, needle `SWEEP_DRAWN` + the host's SSD1306 model telemetry `vramFillPercent`; the DS1307 RTC rides the same bus — cell stm32-gd32-wave2 → `RTC_NOW:`) | FULL (2026-10-20: the guest READS an SPI slave — SPI NOR flash JEDEC ID C8 40 16 + one data byte A5 over SPI1, 6/6 boards; the MFRC522 VersionReg reads 92 on the bluepill; cell stm32f1-spi-miso, needle `MISO_OK` (the JEDEC ID + data byte the guest read back). The F1 engine's MISO queue is only consumed when a device is attached to the bus (engine src/peripherals/spi.rs, the DR-write arm) — the runner now attaches the engine's own flash model, which is what unblocked SPI reads) | FULL (cell stm32-gd32-analog, needle `GRBADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32-gd32-analog, needle `GRBPWM_SET` + the host's LED model telemetry) | ABSENT (no DAC in the STM32F1/GD32F1 die — the F1 engine's chip table has no dac entry) | FULL (TCIF1 — cell stm32-gd32-core, needles `GRBDMA_SUM:65656` + `GRBDMA_BAD:0`) | FULL (cell stm32-gd32-analog, needle `GRBGPIOIN_READY` + the guest's `PB0=…` / `PB1=…` levels) | FULL (SET — cell stm32-gd32-wave2, needle `RTC_NOW:` — the host's DS1307 clock reached the guest over I2C) | FULL (bxCAN loopback — cell stm32-gd32-wave2, needle `CAN_LOOP` + the guest's `CAN_LOOP TX:1 RX:1 ID:123 DLC:8` frame) | NO-GO (bxCAN classic-only) | NONE (SPI2/I2S-mux, no cell) | FULL (2026-10-20, pinned owner engine bytes: gd32-wave2 DHT green, exact 24.00/50.00 (cell stm32-gd32-wave2, needle `DHT_READ`); per-read nan intermittency persists) | FULL (2026-10-20: USB-FS control-plane enumeration — bus reset + device/config/lang descriptors + SET_ADDRESS + SET_CONFIGURATION, host-observed; cell stm32f1-usb, needle `USB enum done` + the host sink `enumState=enumerated` / `rxCount=89` (the cell asserts rxCount >= 80). The engine USB model is ONE model for all F1 boards (engine src/peripherals/usb.rs) and the runner host machine is one code path — proven on ALL SIX F1 boards 2026-10-22 - the cell now runs per board type (6/6 green, each board's own run: sink enumState=enumerated, rxCount=89 (the cell asserts rxCount >= 80)); no CDC data phase yet) | ABSENT (every engine USB model is device-only — the guest cannot enumerate a host; see Deliberately out of scope) | ABSENT (no Ethernet MAC on the STM32F1/GD32F1 die) | ABSENT (no SDIO controller on the STM32F1/GD32F1 — the SD path is SPI, see the SD-SPI column) | PARTIAL (2026-10-20: the SD card's SPI answers DO reach the guest (R1 0x01, CMD8 01 00 00 01 AA, OCR 00 C0 FF 80 00) but they land one COMMAND late, so no SD driver can be written and the CMD17 block data is not byte-comparable. The F1 engine has NO SPI-mode SD device: ext_devices.sd_card is the SDIO backing store and the engine binds only spi_flash/lcd/touchscreen/usart_probe to the SPI bus (engine src/ext_devices/mod.rs:50-89), so the card answers through the runner's JS bridge, whose MISO is injected at the engine drain (stm32f1-runner.ts, the onTransfer arm). The F4 avoids this with the engine-native ext_devices.spi_sd (stm32f4-runner.ts:262-266). OWNER ASK: port the F4 engine's SPI-mode SD device to the F1 engine) | NONE (no F1 image: public/firmware ships micropython only for esp32 / rp2040 / rp2350 / microbit, and the F1 board families register firmware: ['arduino-sketch'] only — src/worker/boards-registry.ts:169, 179, 189, 199; the F1 runner has no MicroPython REPL-inject path, unlike esp32-runner.ts:34) | PARTIAL (OLED+MAX7219) |

UART note: all FULL cells prove TX; HW-UART RX loopback unproven (SW-UART RX
proven on bluepill only).
Engine-bytes note (2026-10-20): under the stale npm `stm32f1-emu` build the
SoftSerial RX loopback (stm32-softserial) and the I2C RTC readback
(stm32-rtc) cells were RED — the npm wasm delivers pin events as
(port,pin,level) triples, so the runner loses the engine-domain edge stamp
and hunts coarsely. With the pinned owner engine bytes (src/engines/
stm32f1-emu — glue+wasm+facade from ONE build) both are green. See
"Infra notes" for the byte set and the resolution point.
F1 coverage lane 2026-10-20 (lane/f1-cov2): the SPI column is now FULL on
all six boards — the guest READS an SPI slave. Root cause of the old
"MISO-read gap": the F1 engine's SPI peripheral only consumes the MISO
injection queue when an ext device is attached to the bus (engine
src/peripherals/spi.rs, the DR-write arm reads the injected byte inside
the `if let Some(ref d) = device` branch and otherwise hard-codes 0xFF),
and the F1 runner attached only I2C devices — so every SPI read on the F1
clocked in 0xFF. The runner now attaches the engine's own SPI NOR-flash
model to SPI1 (board attr `spiFlash`, or automatically when the circuit
has a JS SPI slave); that model answers the JEDEC ID (0x9F) and data
reads (0x03) IN-CLOCK, and its presence also re-enables the injection
queue for the JS slave models (those land one transfer late — the
MFRC522 cell documents it). Engine bytes: the repo-pinned pair
(glue 43c24f16 + wasm d1e69c28) — the owner's live folder now holds a
mismatched pair (new wasm 641abe52 with the old glue), so every cell in
this lane ran against the repo-pinned bytes.
Specs: stm32-can, stm32-softserial(+tx), stm32-dht22, stm32-rtc, stm32-gpio-in,
stm32-i2c, stm32-spi, stm32-595, stm32-adc, stm32-pwm, stm32-mpu6050,
stm32-bmp180, stm32f1-sweep, stm32f1-i2c-sweep,
stm32f1-maple-cb (6/6), stm32f1-maple-cb-2 (8/8), stm32f1-dma (3/3),
stm32f1-crc (3/3), stm32f1-sys (9/9: IWDG/EXTI/BKP, all three boards),
stm32f1-spi-miso (7/7: MFRC522 VersionReg 92 + SPI NOR flash JEDEC
C8 40 16 / data A5, six boards),
stm32f1-pwr-clk (3/3: PVD vs the modeled supply + the RCC clock tree),
stm32f1-dbg (2/2: DBGMCU IDCODE per chip), stm32f1-usb (6/6: USB-FS
control-plane enumeration, one run per F1 board),
stm32-gd32-uart (3/3), stm32-gd32-analog (9/9),
stm32-gd32-core (15/15: DMA/CRC/WDG/EXTI/BKP),
stm32-gd32-wave2 (12/12: softserial/RTC/DHT/CAN),
stm32f1-inputs (4/4, 2026-11-03 — real DOM component interaction with the
guest as the judge: pushbutton held (`BTN:` 1→0→1), slide switch flipped
MID-RUN both ways (`SWI:` 1→0→1), 4x4 membrane keypad key '5' (`KEY:none` →
`KEY:11` → `KEY:none`, external 10k pull-ups on the columns), analog
joystick both axes leave mid-rail (`JOYX:`/`JOYY:`). Runner changes this
round (arm-runner-base.ts): inputs are now a DC netlist — a wire-only
union-find net map (pinToNet stays as-is: it bridges resistor bodies for
output fan-out, which merges every pulled-up keypad column into the rail
net) + an MNA solve over rails/resistors/contacts, written back onto the
component pins and pushed to the guest. F1/F4 `gpio_set_input` stores the
level (`readInput()` follows) but the IDR bit the firmware reads only moves
on an observed edge, so a level static from reset read 0 forever; the
runner now pre-polls BEFORE the first step and mirrors the level into IDR
via periphRead/periphWrite (OWNER ASK: latch the level on load instead).
Keypad spec bug fixed: the sketch used `'PA4'` character literals, not pin
macros.

## STM32F4 (survey-verified 2026-10-09; chip flags from engine CHIPS table)

**Engine bytes:** repo-pinned `public/vendor/board-engines/stm32f4-emu/site/` + `public/wasm/stm32_periph_wasm_bg.wasm` — glue `19a96301` + wasm `9455e31c` + facade `9631b8db`/`1f36d0ed` + loader `abd3334f` (the npm package `stm32f4-emu@1.6.1` carries byte-identical facades; its own wasm copy is stale — the app always loads `/wasm/stm32_periph_wasm_bg.wasm`). Owner folder verdict 2026-10-20: **DIFFERENT** — the glue (`2574b1e2`), the wasm (`578ce844`) and `emulator.js` (`9f9d7338`) all moved, so it is a consistent rebuild, not a mismatched pair; do **not** copy out of that folder until the owner says the build is stable. Refresh recipe: `public/vendor/board-engines/stm32f4-emu/README.md`.

| Board | UART | I2C | SPI | ADC | PWM | DAC | DMA | GPIO-in | RTC | CAN-2.0 | CAN-FD | I2S | 1-Wire | USB-DEV | USB-HOST | ETH | SDIO | SD-SPI/FS | LTDC | DCMI | QSPI | FSMC | SAI | MicroPython | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-stm32f4 (F407 disco) | FULL (cell stm32f4-sweep, needle `F4SWEEP_TICK` — the host read the guest's USART bytes on every F4 die; note multi-board-uart does NOT assert F4 serial, it is a known package gap) | FULL (OLED — cell stm32-i2c, needle `F4_OLED_READY` + the host's SSD1306 model telemetry `vramFillPercent`) | FULL (MAX7219 — cell stm32f4-spi, needle `F4SPI_DRAWN` + the host's MAX7219 model) | FULL (cell stm32f4-adc, needle `F4ADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32f4-pwm, needle `F4PWM_SET` + the host's LED model telemetry) | FULL (loopback — cell stm32f4-dac, needle `F4DAC_LOOP:` — the analog output read back on the ADC) | FULL (DMA2 M2M 16 words, TCIF0, LISR 0x18 — cell stm32f4-dma, needles `F407DMA_OK` + `F407DMA_LISR:18` + `F407DMA_SUM:65656`) | FULL (PB0=1/PB1=0 — cell stm32f4-gpio-rtc, needle `GPIOIN_READY` + the guest's own `PB0=…` / `PB1=…` levels) | FULL (DS1307 set/read over I2C1 — cell stm32f4-gpio-rtc, needle `RTC_NOW:` — the host's DS1307 clock reached the guest) | FULL (exact loopback ID 0x123, 8/8 bytes — cell stm32f4-can, needle `CAN_LOOP` + the guest's `CAN_LOOP TX:1 RX:1 ID:123 DLC:8`) | NO-GO (no controller on silicon — RM0090: classic CAN only) | FULL (I2S2 master-TX → shared PCM FIFO — cell stm32f4-i2s, needle `I2S_TX_OK` + `I2S_SUM:16120` + the runner's `SAI_CAP:16:16120`) | NO-GO (engine-side: SysTick->VAL is not a down-counter → micros() 1ms-quantized; patch delivered) | FULL (CDC echo — cell stm32f4-usb, needle `USB done` + the host sink's enumState/rxCount) | ABSENT (device-only model) | FULL (gateway DORA 2026-10-15 — cell stm32f4-eth-gateway, needle `=== DHCP SUCCESS ===`; the HTTP client is cell stm32f4-http-gateway → `hello-openhw`) | FULL (block5 exact — cell stm32f4-sdio, needle `SDIO_WRRD:PASS` — a 512-byte block write/readback against the bound card image) | FULL (raw+FS — cell stm32f4-sd, needle `SD_DONE` + the host's SD model; the FAT16 round-trip is cell stm32f4-sd-fs, needle `FS_DONE` + the guest's `hello sd world`) | FULL (scanout, exact pixels — 64x32, 2047 lit — cell stm32f4-ltdc, needle `LTDC_OK` + `LTDC_SUM:FC7F1F9E` + the host sink's litPixels:2047) | FULL (capture, DR sum exact — cell stm32f4-dcmi, needle `DCMI_OK` + `DCMI_SUM:178` + `DCMI_SRC:PASS 4x4`) | FULL (indirect+mmap agree; 256 words host-verified — cell stm32f4-qspi, needle `QSPI_OK` + `QSPI_MMAP:PASS 256`) | FULL (8080 burst, RDDID exact — cell stm32f4-fsmc, needle `FSMC read OK` + `FSMC_ID:9341`) | FULL (data path only — register stub + shared FIFO — cell stm32f4-sai, needle `SAI_TX_OK` + `SAI_SUM:16120` + the runner's `SAI_CAP:16:16120`; no full-duplex clocking yet) | NONE (engine has no MicroPython runtime; no F4 image in public/firmware; boards-registry lists only 'arduino-sketch' for the F4 boards; the F4 runner has no REPL inject path) | FULL (OLED+MAX7219 — OLED: stm32-i2c → `F4_OLED_READY` + the host's SSD1306 telemetry; MAX7219: stm32f4-spi → `F4SPI_DRAWN` + the host's MAX7219 model; no ILI9341-on-STM32 cell) |
| openhw-stm32f401 | FULL (cell stm32f4-sweep, needle `F4SWEEP_TICK` — the host read the guest's USART bytes on every F4 die) | FULL (OLED — cell stm32f4-periph-x, needle `OLEDI2C_DRAWN` + the host's SSD1306 model telemetry `vramFillPercent`) | FULL (MAX7219 — cell stm32f4-periph-x, needle `F4SPI_DRAWN` + the host's MAX7219 model) | FULL (cell stm32f4-periph-x, needle `F4ADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32f4-periph-x, needle `F4PWM_SET` + the host's LED model telemetry) | ABSENT (no such silicon — dac:false) | FULL (DMA2 stream 0 M2M, TCIF0 — cell stm32f4-dma, needles `F401DMA_OK` + `F401DMA_LISR:18` + `F401DMA_SUM:65656`) | FULL (cell stm32f4-gpio-rtc, needle `GPIOIN_READY` + the guest's own `PB0=…` / `PB1=…` levels) | FULL (cell stm32f4-gpio-rtc, needle `RTC_NOW:` — the host's DS1307 clock reached the guest) | ABSENT (can:[]) | NO-GO (no controller on silicon — RM0090: classic CAN only) | FULL (I2S2 → shared PCM FIFO — cell stm32f4-i2s, needle `I2S_TX_OK` + `I2S_SUM:16120` + the runner's `SAI_CAP:16:16120`) | NO-GO (engine-side: SysTick->VAL is a latch toggle, not a down-counter → micros() 1ms-quantised; patch delivered) | NONE (no e2e proof — the engine ships only the F407 CDC FIXEDBIN image, a per-die CDC image is needed) | ABSENT (device-only model) | ABSENT (no MAC) | FULL (cell stm32f4-store-x, needle `SDIO_WRRD:PASS` — a 512-byte block write/readback against the bound card image) | FULL (raw; FS NO-GO engine-side — cell stm32f4-store-x, needle `SD_DONE` + the host's SD model; the SdFat FS half of the same spec is the engine-side NO-GO (P_ERR init contradiction)) | ABSENT (no such silicon — engine CHIPS table ltdc:false, node_modules/stm32f4-emu/site/stm32f4.js:74) | ABSENT (no such silicon — dcmi:false, stm32f4.js:76) | ABSENT (no such silicon — qspi:false, stm32f4.js:78) | ABSENT (no such silicon — fsmc:false, stm32f4.js:77) | ABSENT (no such silicon — sai:[], stm32f4.js:75) | NONE (engine has no MicroPython runtime; no F4 image in public/firmware; boards-registry lists only 'arduino-sketch' for the F4 boards; the F4 runner has no REPL inject path) | FULL (OLED/MAX7219 — cell stm32f4-periph-x, needles `OLEDI2C_DRAWN` + `F4SPI_DRAWN` + the host's OLED/MAX7219 models) |
| openhw-stm32f411 | FULL (cell stm32f4-sweep, needle `F4SWEEP_TICK` — the host read the guest's USART bytes on every F4 die) | FULL (OLED — cell stm32f4-periph-x, needle `OLEDI2C_DRAWN` + the host's SSD1306 model telemetry `vramFillPercent`) | FULL (MAX7219 — cell stm32f4-periph-x, needle `F4SPI_DRAWN` + the host's MAX7219 model) | FULL (cell stm32f4-periph-x, needle `F4ADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32f4-periph-x, needle `F4PWM_SET` + the host's LED model telemetry) | ABSENT (no such silicon — dac:false) | FULL (DMA2 stream 0 M2M, TCIF0 — cell stm32f4-dma, needles `F411DMA_OK` + `F411DMA_LISR:18` + `F411DMA_SUM:65656`) | FULL (cell stm32f4-gpio-rtc, needle `GPIOIN_READY` + the guest's own `PB0=…` / `PB1=…` levels) | FULL (cell stm32f4-gpio-rtc, needle `RTC_NOW:` — the host's DS1307 clock reached the guest) | ABSENT (can:[]) | NO-GO (no controller on silicon — RM0090: classic CAN only) | FULL (I2S2 → shared PCM FIFO — cell stm32f4-i2s, needle `I2S_TX_OK` + `I2S_SUM:16120` + the runner's `SAI_CAP:16:16120`) | NO-GO (engine-side: SysTick->VAL is a latch toggle, not a down-counter → micros() 1ms-quantised; patch delivered) | NONE (no e2e proof — the engine ships only the F407 CDC FIXEDBIN image, a per-die CDC image is needed) | ABSENT (device-only model) | ABSENT (no MAC) | FULL (cell stm32f4-store-x, needle `SDIO_WRRD:PASS` — a 512-byte block write/readback against the bound card image) | FULL (raw; FS NO-GO engine-side — cell stm32f4-store-x, needle `SD_DONE` + the host's SD model; the SdFat FS half of the same spec is the engine-side NO-GO (P_ERR init contradiction)) | ABSENT (no such silicon — engine CHIPS table ltdc:false, node_modules/stm32f4-emu/site/stm32f4.js:83) | ABSENT (no such silicon — dcmi:false, stm32f4.js:85) | ABSENT (no such silicon — qspi:false, stm32f4.js:87) | ABSENT (no such silicon — fsmc:false, stm32f4.js:86) | ABSENT (no such silicon — sai:[], stm32f4.js:84) | NONE (engine has no MicroPython runtime; no F4 image in public/firmware; boards-registry lists only 'arduino-sketch' for the F4 boards; the F4 runner has no REPL inject path) | FULL (OLED/MAX7219 — cell stm32f4-periph-x, needles `OLEDI2C_DRAWN` + `F4SPI_DRAWN` + the host's OLED/MAX7219 models) |
| openhw-stm32f407ve | FULL (cell stm32f4-sweep, needle `F4SWEEP_TICK` — the host read the guest's USART bytes on every F4 die) | FULL (OLED — cell stm32f4-periph-x, needle `OLEDI2C_DRAWN` + the host's SSD1306 model telemetry `vramFillPercent`) | FULL (MAX7219 — cell stm32f4-periph-x, needle `F4SPI_DRAWN` + the host's MAX7219 model) | FULL (cell stm32f4-periph-x, needle `F4ADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32f4-periph-x, needle `F4PWM_SET` + the host's LED model telemetry) | FULL (loopback — cell stm32f4-store-x, needle `F407VEDAC_LOOP:` — the 0/2048/4095 analog staircase read back on the ADC) | FULL (DMA2 stream 0 M2M, TCIF0 — cell stm32f4-dma, needles `V407DMA_OK` + `V407DMA_LISR:18` + `V407DMA_SUM:65656`) | FULL (cell stm32f4-gpio-rtc, needle `GPIOIN_READY` + the guest's own `PB0=…` / `PB1=…` levels) | FULL (cell stm32f4-gpio-rtc, needle `RTC_NOW:` — the host's DS1307 clock reached the guest) | FULL (exact loopback — cell stm32f4-can-x, needle `CAN_LOOP` + the guest's `CAN_LOOP TX:1 RX:1 ID:123 DLC:8`) | NO-GO (no controller on silicon — RM0090: classic CAN only) | FULL (I2S2 → shared PCM FIFO — cell stm32f4-i2s, needle `I2S_TX_OK` + `I2S_SUM:16120` + the runner's `SAI_CAP:16:16120`) | NO-GO (engine-side: SysTick->VAL is a latch toggle, not a down-counter → micros() 1ms-quantised; patch delivered) | FULL (CDC echo — cell stm32f4-usb-ve, needle `USB done` + the host sink's enumState/rxCount) | ABSENT (device-only model) | FULL (gateway DORA 2026-10-15, same runner path as F407 — cell stm32f4-eth-gateway-ve, needle `=== DHCP SUCCESS ===`) | FULL (cell stm32f4-store-x, needle `SDIO_WRRD:PASS` — a 512-byte block write/readback against the bound card image) | FULL (raw; FS NO-GO engine-side — cell stm32f4-store-x, needle `SD_DONE` + the host's SD model; the SdFat FS half of the same spec is the engine-side NO-GO (P_ERR init contradiction)) | FULL (scanout, exact pixels — 64x32, 2047 lit; LTDC_SUM:FC7F1F9E — cell stm32f4-ltdc, needle `LTDC_OK` + the host sink's litPixels:2047) | FULL (capture, DR sum exact — DCMI_SUM:178 — cell stm32f4-dcmi, needle `DCMI_OK` + `DCMI_SRC:PASS 4x4`) | FULL (indirect+mmap agree; 256 words host-verified — QSPI_MMAP:PASS 256 — cell stm32f4-qspi, needle `QSPI_OK`) | FULL (8080 burst, RDDID exact — FSMC_ID:9341 — cell stm32f4-fsmc, needle `FSMC read OK`) | FULL (data path only — register stub + shared FIFO; SAI_CAP:16:16120 — cell stm32f4-sai, needle `SAI_TX_OK` + `SAI_SUM:16120`) | NONE (engine has no MicroPython runtime; no F4 image in public/firmware; boards-registry lists only 'arduino-sketch' for the F4 boards; the F4 runner has no REPL inject path) | FULL (OLED/MAX7219 — cell stm32f4-periph-x, needles `OLEDI2C_DRAWN` + `F4SPI_DRAWN` + the host's OLED/MAX7219 models) |
| openhw-stm32f429 | FULL (cell stm32f4-sweep, needle `F4SWEEP_TICK` — the host read the guest's USART bytes on every F4 die) | FULL (OLED — cell stm32f4-429-periph, needle `F429OLED_DRAWN` + the host's SSD1306 model telemetry `vramFillPercent`; the sibling cell stm32f4-periph-x → `OLEDI2C_DRAWN` covers it too) | FULL (MAX7219 — cell stm32f4-429-periph, needle `F429SPI_DRAWN` + the host's MAX7219 model) | FULL (cell stm32f4-periph-x, needle `F4ADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell stm32f4-periph-x, needle `F4PWM_SET` + the host's LED model telemetry) | FULL (loopback — cell stm32f4-429-periph, needle `F429DAC_LOOP:` — the analog output read back on the ADC) | FULL (DMA2 stream 0 M2M, TCIF0 — cell stm32f4-dma, needles `F429DMA_OK` + `F429DMA_LISR:18` + `F429DMA_SUM:65656`; DMA2D gate still unused) | FULL (cell stm32f4-gpio-rtc, needle `GPIOIN_READY` + the guest's own `PB0=…` / `PB1=…` levels) | FULL (cell stm32f4-gpio-rtc, needle `RTC_NOW:` — the host's DS1307 clock reached the guest) | FULL (exact loopback — cell stm32f4-can-x, needle `CAN_LOOP` + the guest's `CAN_LOOP TX:1 RX:1 ID:123 DLC:8`) | NO-GO (no controller on silicon — RM0090: classic CAN only) | FULL (I2S2 → shared PCM FIFO — cell stm32f4-i2s, needle `I2S_TX_OK` + `I2S_SUM:16120` + the runner's `SAI_CAP:16:16120`) | NO-GO (engine-side: SysTick->VAL is not a down-counter → micros() 1ms-quantized; patch delivered) | NONE (no e2e proof — the engine ships only the F407 CDC FIXEDBIN image, a per-die CDC image is needed) | ABSENT (device-only model) | FULL (gateway DORA 2026-10-15, same runner path as F407 — cell stm32f4-eth-gateway-429, needle `=== DHCP SUCCESS ===`) | FULL (cell stm32f4-store-x, needle `SDIO_WRRD:PASS` — a 512-byte block write/readback against the bound card image) | FULL (raw; FS NO-GO engine-side — cell stm32f4-store-x, needle `SD_DONE` + the host's SD model; the SdFat FS half of the same spec is the engine-side NO-GO (P_ERR init contradiction)) | FULL (scanout, exact pixels — cell stm32f4-ltdc, needle `LTDC_OK` + `LTDC_SUM:FC7F1F9E` + the host sink's litPixels:2047) | FULL (capture, DR sum exact — cell stm32f4-dcmi, needle `DCMI_OK` + `DCMI_SUM:178` + `DCMI_SRC:PASS 4x4`) | FULL (indirect+mmap agree; 256 words host-verified — the F429 DOES have QUADSPI silicon, engine CHIPS table qspi:true — cell stm32f4-qspi, needle `QSPI_OK` + `QSPI_MMAP:PASS 256`) | FULL (8080 burst, RDDID exact — cell stm32f4-fsmc, needle `FSMC read OK` + `FSMC_ID:9341`) | FULL (data path only — register stub + shared FIFO; SAI_CAP:16:16120 — cell stm32f4-sai, needle `SAI_TX_OK` + `SAI_SUM:16120` — same cell as F407/F407VE) | NONE (engine has no MicroPython runtime; no F4 image in public/firmware; boards-registry lists only 'arduino-sketch' for the F4 boards; the F4 runner has no REPL inject path) | FULL (OLED/MAX7219; LTDC proven — OLED: stm32f4-429-periph → `F429OLED_DRAWN`; MAX7219: → `F429SPI_DRAWN`; both + the host's device models) |

Specs: stm32f4-sdio, stm32f4-ltdc, stm32f4-usb, stm32f4-dcmi, stm32f4-qspi,
stm32f4-fsmc, stm32f4-sai, stm32f4-dac, stm32f4-adc, stm32f4-pwm, stm32f4-spi,
stm32f4-sd, stm32f4-sd-fs, stm32f4-sweep, multi-board-uart,
stm32f4-dcmi, stm32f4-qspi, stm32f4-fsmc, stm32f4-sai, stm32f4-can(+x),
stm32f4-429-periph, stm32f4-periph-x, stm32f4-store-x, stm32f4-display-x,
stm32f4-gpio-rtc, stm32f4-crc-rng-x, stm32f4-1wire, stm32f4-usb-ve,
stm32f4-can(+x), stm32f4-429-periph, stm32f4-periph-x, stm32f4-store-x (VE DAC),
stm32f4-sys (IWDG arm/reload/fire, EXTI-SWIER, RTC_BKP0R, HASH SHA-256/SHA-1
digests — 15 cells over F407/407VE/429), stm32f4-clock (tickMHz:24 divider
armed + guest millis advance in delay(2000) quanta),
stm32f4-dma (DMA2 stream 0 M2M 16 words, TCIF0 on all five chips),
stm32f4-i2s (I2S2 master-TX into the shared PCM FIFO on all five chips),
stm32f4-ltdc/-dcmi/-qspi/-fsmc/-sai (F429 + F407 + F407VE in one cell each —
15 cells green 2026-10-22: LTDC_SUM:FC7F1F9E, DCMI_SUM:178,
QSPI_MMAP:PASS 256, FSMC_ID:9341, SAI_CAP:16:16120; the F407VE row of the
table was NONE until this run),
stm32f4-sysblocks (lane/f4-cov2 2026-10-22 — CRC_DR of 3 words =
F4CRC_HEX:FB5C7298 / F4CRC_DEC:4217139864 on the 4 crc:true dice; WWDG
countdown + EWIF + watchdog reset + reset-cause proof; PWR CR readback +
F4PWR_MODE:2 + WFI sleep/wake + WUF; RCC source lock + SYSCLK switch + SWS
mirror + prescalers + bus gates; DBGMCU IDCODE/CR + DWT gating rule + ITM
stimulus),
stm32f4-rng (lane/f4-cov2 2026-10-22 — the model's DRDY is RNG_SR bit 6,
not bit 0; RNG_DR yields distinct nonzero words on F407/F407VE/F429),
stm32f4-cryp (lane/f4-cov2 2026-10-22 — AES-128 ECB vs the FIPS-197
published vector: CRYP is not NONE),
stm32f4-inputs (4/4, 2026-11-03 — same four cells on the Disco: pushbutton
`BTN:` 1→0→1, slide switch MID-RUN `SWI:` 1→0→1, keypad `KEY:11`, joystick
both axes. Board gotcha: this board's `Serial` is USART2 on **PA2/PA3**, so
the switch cell uses PC0 — PA2 is firmware-driven TX and can never follow a
switch. Shares the F1 ARM input path (DC netlist solve + boot pre-poll + IDR
mirror, see the STM32F1 note above); the F4 IDR mirror derives its address
from the wire-only net map pin (`0x40020010 + (port-65)*0x400`).
F4 sibling NO-GOs (engine-side, specs left failing): SdFat FS (P_ERR init
contradiction), ILI9341 (tap death on 120ms+ delays),
DHT22 / 1-Wire (SysTick->VAL modelled as a latch toggle, not a down-counter
→ the STM32duino `micros()` is 1ms-quantised → 26us/70us slots undecodable;
patch + write-up in patches/f4-systick-val-downcounter.patch and
patches/README-f4-systick-val.md). The old "RNG (DRDY never sets)" NO-GO was
a CELL bug (the cell polled the RNG-enabled echo, bit 0, instead of the
model's data-ready bit 6) — RNG is FULL now; the engine still owes the
silicon bit map (RM0090 §22.3.3: DRDY = bit 4, SECS = bit 3; the model uses
bit 6 / bit 5).
F407 cell-bug fixes 2026-10-20 (lane/f4-cov — the two "engine gaps" that
were actually cell bugs): DMA polled LISR bit 5 (reserved) instead of bit 4
(TCIF0) so every board timed out; I2S wrote SPI_I2SCFGR bit 10 (CKPOL)
instead of bit 0 (I2SMOD) so the SPI model never entered I2S mode and the
PCM FIFO stayed empty. Both are fixed in the cells, no engine change.
F407 coverage notes (2026-10-20, lane/f4-cov): the five display/audio cells
(LTDC/DCMI/QSPI/FSMC/SAI) needed NO F407-specific fix — the register maps
are identical on F407 and F429 (LTDC1 0x40016800, DCMI 0x50050000, QUADSPI
0xA0001000 + mmap 0x90000000, FSMC 0xA0000000, SAI1 0x40015800) and the
only board difference is the Arduino core's Serial port (Disco F407 =
USART2, Disco F429 = USART1), which the runner's per-board uartAddr
handles. MicroPython on F4 stays NONE: stm32f4-emu boots
Arduino/STM32duino images only (no MicroPython runtime, no REPL), there is
no F4 MicroPython image in public/firmware, and the F4 runner has no
`micropython-script` firmware path (boards-registry lists it for Pico/ESP32
only) — an upstream STM32F4DISC MicroPython image plus a runner REPL
inject would be needed, and its microsecond sleeps hit the same
SysTick->VAL gap as the DHT22 cell.

## AVR (survey-verified 2026-10-09; re-swept 2026-10-20 — every cell re-checked against the spec that proves it)

**Engine bytes:** the pure-JS npm engine `avr8js` 0.21.0 (`node_modules/avr8js`; integrity pinned by `package-lock.json`) — no wasm pair, no owner build, so `check:engine-bytes` reports **N/A** for this family. (`rp2040js` is still listed in `vite.config.js`'s optimizeDeps but is **not installed** — the Pico family runs on the `pico-emu` wasm engine, never on rp2040js.) Refresh: bump `avr8js` in `package.json` + `package-lock.json`, then re-run the AVR cells.

| Board | UART | SoftSerial | I2C | SPI | ADC | PWM | DAC | DMA | GPIO-in | RTC | EEPROM | CAN-2.0 | CAN-FD (MCP2518FD) | I2S | 1-Wire/DHT | IR | USB-DEV | ETH | SD-SPI | Modbus | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-arduino-uno | FULL (TX seen by the host — avr-control → `CTRL_ALIVE`; multi-board-uart → `HELLO_UNO1`; no AVR UART-RX cell, see family note) | PARTIAL (TX only — avr-softserial-tx → `SS_TX_HELLO`; RX is parked: the runner's RX decoder samples the **TX** pin's level (avr-runner.ts:907-911) and never the injected RX line) | FULL (i2c-ack-disc → `I2C_READY` + `endTransmission` status 0x27; protocol-transactions → `LCD_READY` — the host's LCD2004 model received the text) | FULL (spi-delivery-disc → `SPI_READY` + `LB_READY` (MOSI→MISO loopback 0x9F) and the MFRC522 `VersionReg` = 0x92; protocol-transactions → `RFID_READY`) | FULL (board-input → `ADC_READY`: the host's pot value reached the guest exactly) | FULL (cell peripherals, needle `ACT_READY` — the host's servo model decoded the 90° duty the guest wrote with `analogWrite`) | ABSENT (no DAC in the ATmega328P) | ABSENT (no DMA controller in the ATmega328P) | FULL (board-input → `IN_READY`: the host's slide-switch level reached the guest; peripherals → pushbutton / PIR / keypad cells, DOM → `digitalRead`) | FULL (cluster-d → `RTC_READY`: the host's DS1307 ticked wall-clock seconds over raw Wire) | FULL (avr-eeprom → `EE_RB:` — byte-exact AB/CD readback) | ABSENT (no CAN controller in the AVR; the only CAN path is the external MCP2518FD bridge over SPI) | FULL (avr-mcp2518fd → `CANFD_LOOPBACK_OK`: the host's MCP2518FD model looped the frame back) | FULL (bit-banged — the AVR has **no** I2S peripheral; avr-i2s → `I2S_FRAMES_SENT` and the host's MAX98357 counted the decoded frames; peripherals → `MIC_READY`) | FULL (avr-dht22 → `DHT_READ`; peripherals → the DS18B20 (DallasTemperature) + DHT-22 cells) | PARTIAL (raw NEC-style mark/space envelope, **no 38 kHz carrier** — avr-softproto → `IR_DECODED ADDR=0x00 CMD=0x16`; the spec names the parked carrier path) | ABSENT (no USB device hardware on the ATmega328P — the Uno's USB is a serial bridge, not a USB peripheral) | ABSENT (no Ethernet MAC in the ATmega328P) | FULL (cell peripherals, needle `SD_READY` — the host's SD model took the card image) | FULL (avr-modbus → `MB_OK_43981_12345`: two Unos, master ↔ slave over SoftwareSerial, exact register values) | FULL (display-verify → `TFT_READY` / `OLED_READY`; peripherals → MAX7219 `MX_READY`, Nokia `NLSF_READY`, ePaper `EP_READY`, LCD1602 `LC_READY`, 7-seg `SEG_READY`, ILI9341-touch `TFT2_READY`, NeoPixel `NEO_READY`/`NEO2_READY`, TM1637 `TM_READY`) |
| openhw-arduino-mega | FULL (avr-mega-nano → `UART_MEGA_TX` — the host saw the byte and the LED latch `HOLD_HIGH`) | PARTIAL (TX only — avr-mega-periph → `MEGA_SS_HELLO`; same parked RX as the Uno) | FULL (avr-mega-periph → `MEGA_OLED_DRAWN` on the Mega-wired bus 20/21 — the host's OLED model got the pixels) | FULL (avr-mega-periph → `MEGA_SPI_DRAWN` on 51/50/52) | FULL (avr-mega-periph → `MEGA_ADC_VAL:` — the host's pot value, exact) | FULL (avr-mega-periph → `MEGA_PWM_SET` + the LED telemetry) | ABSENT (no DAC in the ATmega2560) | ABSENT (no DMA controller in the ATmega2560) | FULL (avr-mega-periph → `MEGA_IN_READY`; board-family-sweep → `HOLD_HIGH` latch-out) | FULL (avr-mega-periph → `MEGA_RTC_READY`) | FULL (avr-mega-periph → `MEGA_EE_RB:` — the 4 KB mega backend) | ABSENT (no CAN controller in the ATmega2560) | FULL (avr-mega-periph → `MEGA_CANFD_LOOPBACK_OK`) | FULL (bit-banged — avr-mega-periph → `MEGA_I2S_SENT` + the host's MAX98357 frame count) | FULL (avr-mega-periph → `MEGA_DHT_T:`) | PARTIAL (raw NEC-style envelope, no 38 kHz carrier — avr-mega-periph → `MEGA_IR_DECODED`; the same 1 ms-bit raw frame as the Uno) | ABSENT (no USB device hardware on the ATmega2560) | ABSENT (no Ethernet MAC in the ATmega2560) | FULL (avr-mega-periph → `MEGA_SD_READY`) | FULL (avr-mega-periph → `MB_OK_43981_12345`: the Mega is the Modbus **master**, the slave is an Uno) | FULL (avr-mega-periph → `MEGA_OLED_DRAWN` — the host's OLED model shows the text; no Mega-specific SPI-display cell) |
| openhw-arduino-nano | FULL (avr-mega-nano → `UART_NANO_TX` + the LED latch `HOLD_HIGH`) | PARTIAL (TX only — avr-nano-periph → `NANO_SS_HELLO`; same parked RX as the Uno) | FULL (avr-nano-periph → `NANO_OLED_DRAWN`) | FULL (avr-nano-periph → `NANO_SPI_DRAWN`) | FULL (avr-nano-periph → `NANO_ADC_VAL:` — exact) | FULL (avr-nano-periph → `NANO_PWM_SET` + the LED telemetry) | ABSENT (no DAC in the ATmega328P-class Nano) | ABSENT (no DMA controller in the ATmega328P-class Nano) | FULL (avr-nano-periph → `NANO_IN_READY`; board-family-sweep → `HOLD_HIGH` latch-out) | FULL (avr-nano-periph → `NANO_RTC_READY`) | FULL (avr-nano-periph → `NANO_EE_RB:`) | ABSENT (no CAN controller in the ATmega328P-class Nano) | FULL (avr-nano-periph → `NANO_CANFD_LOOPBACK_OK`) | FULL (bit-banged — avr-nano-periph → `NANO_I2S_SENT` + the host's MAX98357 frame count) | FULL (avr-nano-periph → `NANO_DHT_T:`) | PARTIAL (raw NEC-style envelope, no 38 kHz carrier — avr-nano-periph → `NANO_IR_DECODED`) | ABSENT (no USB device hardware on the ATmega328P-class Nano) | ABSENT (no Ethernet MAC in the ATmega328P-class Nano) | FULL (avr-nano-periph → `NANO_SD_READY`) | FULL (avr-nano-periph → `MB_OK_43981_12345`: the Nano is the Modbus **master**, the slave is an Uno) | FULL (avr-nano-periph → `NANO_OLED_DRAWN`; no Nano-specific SPI-display cell) |
| openhw-attiny85 | PARTIAL (**no UART cell** — the ATtiny85 has no USART; the backend has no native attiny toolchain, so every tiny firmware is Uno-compiled and runs the substitution path: generic avr8js CPU + PORTB + ATtinyTimer1, USART/TWI/SPI/ADC staying Uno-class stand-ins (avr-runner.ts:186-203, avr-tiny-honest.spec.js:6-13)) | PARTIAL (TX only — avr-tiny-honest → `TINY_SS_HELLO` over the routed PB2/PB3 → P1/P2) | PARTIAL (Uno-class TWI stand-in over **virtual** A4/A5 (no P-route exists) — avr-tiny-honest → `TINY_OLED_DRAWN`; native USI I2C is NO-GO: AVRUSI is unwired and there is no attiny FQBN) | PARTIAL (Uno-class SPI model on the routed P1/P0/P3 nets — avr-tiny-honest → `TINY_SPI_DRAWN`; native USI SPI is NO-GO, same reason) | PARTIAL (Uno-class ADC stand-in over virtual A0 — avr-tiny-honest → `TINY_ADC_VAL:`; the real ATtiny85 ADC needs a native FQBN) | FULL (avr-tiny-honest → `TINY_PWM_SET` — a real ATtiny85 Timer1 PWM on P1, P-routed) | ABSENT (no DAC in the ATtiny85) | ABSENT (no DMA controller in the ATtiny85) | FULL (avr-tiny-honest → `TINY_IN_READY` — the host's switch reached P2) | PARTIAL (Uno-class TWI stand-in over virtual A4/A5 — avr-tiny-honest → `TINY_RTC_READY`) | FULL (avr-tiny-honest → `TINY_EE_RB:` — the 512-byte ATtiny85 EEPROM backend) | NONE (no cell — the MCP2518FD bridge cell runs on the Uno/Mega/Nano; the ATtiny85 has no SPI bus to the bridge) | NONE (no cell — same reason as CAN-2.0) | FULL (bit-banged — avr-tiny-honest → `TINY_I2S_SENT` + the host's MAX98357 `totalFrameCount` > 0) | FULL (avr-tiny-honest → `TINY_DHT_T:` — bit-banged on the routed P2) | PARTIAL (raw NEC-style envelope, no 38 kHz carrier — avr-tiny-honest → `TINY_IR_DECODED`) | ABSENT (no USB device hardware on the ATtiny85) | ABSENT (no Ethernet MAC in the ATtiny85) | PARTIAL (Uno-class SPI stand-in — avr-tiny-honest → `TINY_SD_READY`) | NO-GO (the ATtiny85 has **no USART**, so a Modbus RTU/ASCII master cannot exist; the cell would need a software UART) | PARTIAL (stand-in OLED `TINY_OLED_DRAWN` + stand-in MAX7219 `TINY_SPI_DRAWN`; no other display cell on this board) |

AVR family notes (2026-10-20):

- **UART is TX-proven only.** `FULL` in the UART column means the host
  received the guest's byte. No AVR cell injects a byte into the USART RX
  (the runner's USART RX path is not exercised by any AVR spec) — the same
  convention the STM32F1 section uses, stated here once for the family.
- **SoftSerial is TX-proven only on all four boards.** The runner *has* a
  software-serial RX decoder, but its sample source is the **TX** pin
  (`observeSoftSerialTx` → `state.lastLevel`, avr-runner.ts:907-911) while
  the RX line (`setSoftSerialRxLevel`, avr-runner.ts:863) is only driven HIGH
  once at init (avr-runner.ts:608). A host-injected byte on the RX pin is
  therefore never sampled — that is the "RX echo stays parked (EXTI triage)"
  note in avr-softserial-tx.spec.js:6. Until the decoder samples the RX
  pin, every AVR SoftSerial cell is PARTIAL.
- **IR is an envelope cell, not a 38 kHz NEC cell.** All four boards decode a
  raw mark/space frame looped back D3→D2 (1 ms bit). The IRremote carrier
  path is parked: the carrier would appear raw on the loopback wire and its
  26 µs half-period cannot survive emulation timing (avr-softproto.spec.js:9-12).
- **I2S on AVR is bit-banged**, not a peripheral: the runner's edge decoder
  feeds the device model (`avr-i2s.spec.js:3-5`). The proof is the host
  model's frame count, not a guest print.
- **The ATtiny85 row is an honest-substitution row.** Real ATtiny85 silicon
  has no USART and no TWI/SPI hardware (only USI), and the backend has no
  attiny toolchain: every tiny firmware is Uno-compiled and runs on the
  Uno-class models over the real P-net (P0-P5 *are* Arduino digital 0-5 —
  `src/worker/signal/electrical.ts:42-45`; PB2/PB3 carry SoftSerial 10/11;
  SPI 11/12/13 route to P3/P1/P0). Cells that need native USI/ADC prove the
  runner plumbing, **not** native silicon — so they are PARTIAL, never FULL
  (avr-tiny-honest.spec.js:6-25).
- **CAN-FD is an external bridge.** The MCP2518FD is a SPI-attached
  controller; the AVR has no CAN controller of its own, which is why the
  CAN-2.0 column is ABSENT while CAN-FD is FULL.
- **Watchdog / EXTI / timers** live in the system & crypto table below.

Specs: avr-eeprom, avr-i2s, avr-inmp441, avr-dht22, avr-mcp2518fd, avr-modbus,
avr-softserial-tx, avr-softproto, avr-control, board-input, board-family-sweep,
cluster-d, peripherals, protocol-transactions, display-verify, human-senses,
spi-delivery-disc, i2c-ack-disc, avr-mega-nano, avr-mega-periph, avr-nano-periph,
avr-tiny-honest, avr-wdt, multi-board-uart (the Uno is in the cross-family UART
sweep), known-gaps (the 8051 HIGH-float gap is asserted there, not silently).

## Pico (survey-verified 2026-10-09; W/ETH share the base die)

**Engine bytes:** repo-pinned `src/engines/pico-emu/` — glue `c3b784f0` + wasm `0c74dffe`, **ONE matched pair**, byte-equal to the owner's `rp2350/Pico-emu/web` build of 2026-10-08. The OpenHW I2C fork is a separate wasm on purpose (`public/wasm/picoemu-fork.wasm.wasm`, `863559a3`). Owner folder verdict 2026-10-20: **SAME**. Refresh recipe: `src/engines/pico-emu/README.md`.

| Board | UART | I2C | SPI | ADC | PWM | PIO | DMA | MicroPython | DAC | USB-DEV | 1-Wire | I2S | CAN-2.0 | CAN-FD | RTC | GPIO-in | EEPROM | SD | IR | Camera | Display-ext |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-pico (+W/+ETH) | FULL (cell pico-uart-sweep, needle `PICOSWEEP_TICK` — the host read the guest's USART bytes on all six Pico variants: pico / pico-w / pico-eth / pico-2 / pico-2-w / pico-2-eth) | FULL (OLED+LCD — cell pico-i2c, needles `PICO_OLED_READY` + `PICO_LCD_READY2` — the host's SSD1306 and LCD2004 models received the frames; **sensor/storage READS are blocked** — see (j), the mirror answers every master read with 0xFF) | FULL (MAX7219+595 — cell pico-spi, needle `PICO_SPI_DRAWN` (the host's MAX7219 model); the 74HC595 cell pico-595 → `PSR_LATCHED`) | FULL (cell pico-adc, needle `PICOADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell pico-pwm, needle `PICOPWM_SET` + the host's LED model telemetry) | FULL (WS2812 3px — cell pico-pio, needle `PICO_PIO_TICK` + the host's NeoPixel telemetry activePixels:3 / totalPixels:3 / liveOop [16711680, 65280, 255] = R,G,B) | FULL (64B exact — cell pico-dma, needle `DMA_CMP:` — 64 B mem-to-mem, byte-exact) | FULL (I2C — cell pico-mp-i2c, needle `MP_TICK` — the MicroPython image's I2C transaction reached the host's OLED model) | ABSENT (no DAC peripheral in the RP2040 die) | FULL 2026-10-20 (USB CDC loopback: host byte "P" → CDC OUT → guest echo "USBCDC_ECHO:P"; `openhw-usb-device` sink enumState=active rxCount=3 — cell pico-usb) | NONE (no cell yet — the IN-latch inject now works: the runner reaches `gpio_set_input_pin` through the engine's devtools script path, patches/pico-in-latch-inject.md delivers the clean export) | NONE (engine-side: the PIO-based path needs a BCLK/LRC/DIN observe tap the engine does not expose) | ABSENT (no CAN silicon) | ABSENT (no CAN controller in the RP2040 — CAN is external MCP2518-type silicon) | ABSENT (no RTC silicon) | FULL 2026-10-20 (cell pico-gpio-in: `PICO_IN_LEVEL:0:1` — the guest reads GP13 LOW (GND-wired) and GP14 HIGH (3V3-wired); the LOW half is the stuck-at-1 discriminator) | FULL 2026-10-20 (PICO_EE_RB:ABCD + PICO_NVS_RB:1234 — flash-emul readback; cell pico-periph) | NONE (engine-side, MEASURED at runtime 2026-10-20: the ARM path never reports CS to the SPI device, so the SD model's `cs_active` stays 0 and every response is 0xFF — 60 MOSI bytes seen by the engine's SPI mirror, 0 CS events; patch patches/pico-sd-cs-watch.patch delivered and verified) | NONE (no cell yet — same IN-latch route now available) | ABSENT (RP2040/RP2350 have no DCMI) | FULL (OLED/LCD/MAX7219 — OLED+LCD: cell pico-i2c → `PICO_OLED_READY` / `PICO_LCD_READY2`; MAX7219: cell pico-spi → `PICO_SPI_DRAWN`; all three observed on the host's device models. 2026-11-05 sweep adds Nokia 5110 (fill 100%) and ILI9341 (256-pixel RAMWR)) |
| openhw-pico-2 (+W/+ETH, M33) | FULL (cell pico-uart-sweep, needle `PICOSWEEP_TICK` — the same six-variant sweep covers openhw-pico-2 and its W/ETH variants) | FULL (OLED — cell pico2, needle `PICO2_OLED_READY` — the host's SSD1306 model received the frame; the MicroPython I2C cell pico2-mp-i2c → `MP2_TICK`; **sensor/storage READS are blocked** — see (j), the mirror answers every master read with 0xFF) | FULL (cell pico2-spi, needle `P2SPI_DRAWN` — the host's MAX7219 model showed the digits) | FULL (cell pico2-adc, needle `P2ADC_VAL:` — the host's pot value reached the guest exactly) | FULL (cell pico2-pwm, needle `P2PWM_SET` + the host's LED model telemetry) | FULL 2026-10-20 (PICO2_PIO_SHOWN; neopixel telemetry activePixels:3 totalPixels:3, liveOop pixels [16711680, 65280, 255] = R,G,B — cell pico2-pio-dma) | FULL 2026-10-20 (PICO2_DMA_CMP:PASS CK:80 — 64 B mem-to-mem, byte-exact — cell pico2-pio-dma) | FULL (I2C — cell pico2-mp-i2c, needle `MP2_TICK` — the MicroPython image's I2C transaction reached the host's OLED model) | ABSENT (no DAC peripheral in the RP2350 die) | FULL 2026-10-20 (USB CDC loopback: USBCDC_ECHO:P; sink enumState=active rxCount=1 — cell pico-usb) | NONE (no cell yet — the IN-latch inject now works, patches/pico-in-latch-inject.md) | NONE (engine-side: PIO-based path needs an observe tap) | ABSENT (no CAN controller in the RP2350 — CAN is external MCP2518-type silicon) | ABSENT (no CAN controller in the RP2350 — CAN is external MCP2518-type silicon) | ABSENT (no RTC silicon in the RP2350 — the chip only stamps a timestamp) | FULL 2026-10-20 (cell pico-gpio-in: `PICO2_IN_LEVEL:0:1` — GP13 LOW / GP14 HIGH observed by the guest) | FULL 2026-10-20 (PICO2_EE_RB:ABCD + PICO2_NVS_RB:1234 — flash-emul readback; cell pico2-periph) | NONE (engine-side, MEASURED at runtime 2026-10-20: no SPI CS edge on the ARM path → the SD model answers 0xFF forever; patch patches/pico-sd-cs-watch.patch delivered and verified) | NONE (no cell yet — same IN-latch route now available) | ABSENT (no DCMI) | FULL (OLED — cell pico2, needle `PICO2_OLED_READY` + the host's SSD1306 model; the SPI display is pico2-spi → `P2SPI_DRAWN`; 2026-11-05 sweep adds Nokia 5110 (fill 100%) and ILI9341 (256-pixel RAMWR)) |
| openhw-pico-2 (RV32) | FULL 2026-10-20 (cell pico2-rv32-arduino: a REAL arduino-pico RISC-V sketch (`rp2040:rp2040:rpipico2:arch=riscv`, the backend compiles it) boots on the Hazard3 arch and prints `RV32_UART:OK` — the old "Arduino RV32 blocked upstream" was stale; the toolchain is NOT blocked: arduino-cli core rp2040:rp2040 6.0.0 ships the RISC-V menu + toolchain `rp2040:pqt-gcc-riscv 5.0.0-9576866`, so the sketch compiles locally too) — RE-MEASURED 2026-10-22 headless: the guest's UART0 bytes reach the host (patches/probe-pico2-rv32.mjs) | NONE (no cell yet: the arduino-pico RISC-V port compiles `Wire`, but the headless probe measured `RVPROBE:I2C:4` (Wire.endTransmission() = 4, no ACK) with no device attached — the I2C column needs a real I2C device in the e2e harness; NOT closable headlessly) | NONE (engine-side, MEASURED 2026-10-22 headless: the SPI DATA path works on the RV32 — the engine's own SPI mirror saw the MOSI byte `5a` — but the engine never reports CS to the SPI device (`spi_device_cs()` is called only from the ETH paths, src/rp2350_rv/rv_membus.c:451/459/480/488), so a CS'd device never sees the chip-select; and the guest cannot even toggle CS because the RV32 GPIO-out is dead (see the GPIO-in cell). Two engine asks: patches/pico-rp2350-sio-gpio-map.patch (delivered + VERIFIED) and an RV32 CS watch) | PARTIAL 2026-10-20 (the guest's analogRead tracks the injected pot voltage — `RV32_ADC:512:102` for a 50%/10% pair, i.e. the 5:1 ratio holds — but the RV32 path returns the 12-bit code >> 2, so the absolute value is 4× low vs the ARM path; engine-side, file:line in HANDOVER-LANE-pico-cov2.md) — RE-MEASURED 2026-10-22 headless with the same numbers (patches/probe-pico2-rv32.mjs, adc_set ch0=2048/ch1=410) | NONE (engine-side: `analogWrite()` crashes the RV32 guest — the PC jumps into SRAM (0x20000686) and the guest stops; no PWM readback. The RV32 SIO map fix (patches/pico-rp2350-sio-gpio-map.patch) changes the GPIO register map, not the PWM slice — the crash is still open) | ABSENT (the RP2350 has PIO silicon, but the engine's RV32 core exposes no port/PIO model to a RISC-V guest — the same engine gap as the GPIO row) | NONE (the arduino-pico RISC-V port has no DMA API — `dma_channel_transfer_size` does not exist for that core, so the DMA column needs the engine's fixed RV32 image) | ABSENT (no MicroPython runtime on the Hazard3/RV32 path in this repo — the row runs an Arduino RISC-V sketch or the fixed proof image, not a MicroPython build) | ABSENT (no DAC peripheral in the RP2350 die) | NONE (no cell on the RV32 path — the USB CDC cell pico-usb covers the ARM cores (M0+ and M33) only; the engine's RV32 core has no USB device model) | ABSENT (no GPIO model) | ABSENT (the Pico engine has no I2S peripheral and no PIO observe tap — engine-side, the same gap as the ARM rows) | ABSENT (no CAN controller in the RP2350 — CAN is external MCP2518-type silicon) | ABSENT (no CAN controller in the RP2350 — CAN is external MCP2518-type silicon) | ABSENT (no RTC silicon in the RP2350 — the chip only stamps a timestamp) | NONE (engine-side on the repo bytes, MEASURED 2026-10-22 headless: the RV32 GPIO-OUT is dead — `digitalWrite(15,HIGH)` leaves the engine's OUT latch at 0 and the guest reads 0 back, because RP2350 INTERLEAVES the SIO GPIO registers (silicon OUT_SET=0x18/OUT_CLR=0x20/OE=0x30/OE_SET=0x38) while the engine implements the RP2040 map for both chips (include/gpio.h:30-39); the M33 escapes it (the pico-sdk drives the ARM GPIO coprocessor, engine src/thumb32.c:1564) but the RISC-V core has none (pico-sdk gpio_coproc.h:11-14 "#error ... not available on RISC-V"), so every RV32 GPIO write lands on the wrong register. PATCH patches/pico-rp2350-sio-gpio-map.patch DELIVERED + VERIFIED in a patched build: the guest readback 0 → 1 and the engine OUT latch 0x0 → 0x28000, with the M0+/M33 byte-identical before/after) | ABSENT (the flash-emul EEPROM/NVS backend is reached through the ARM flash path — the engine's RV32 core has no flash model, so there is nothing a RV32 guest could read back) | NONE (engine-side: the SD model answers only while the SPI device's `cs_active` is set, and the RV32 path reports CS only for the ETH boards (src/rp2350_rv/rv_membus.c:451/459); the guest could not toggle CS at all while the RV32 GPIO-out was dead (patch patches/pico-rp2350-sio-gpio-map.patch delivered + verified) — the SD column still needs an RV32 CS watch) | ABSENT (the IR path needs the IN-latch inject and the PIO observe tap — engine-side, the same gap as the ARM rows) | ABSENT (no DCMI silicon on the RP2040/RP2350) | NONE (no cell on the RV32 path — the OLED/MAX7219 cells pico-i2c / pico2 / pico2-spi run on the ARM cores only; the engine's RV32 core has no port model, so a display bus cannot be driven) |

Specs: pico-uart-sweep, pico-i2c, pico-spi, pico-595, pico-adc, pico-pwm,
pico-mp-i2c, pico-pio, pico-dma, pico2, pico2-spi, pico2-adc, pico2-pwm,
pico2-mp-i2c, pico2-rv32, multi-board-uart, arch-clocks,
pico-periph (EEPROM readback: PICO_EE_RB / PICO_NVS_RB),
pico2-periph (EEPROM readback: PICO2_EE_RB / PICO2_NVS_RB),
pico2-pio-dma (M33 PIO/WS2812 + M33 DMA), pico-usb (M0+ + M33 USB CDC),
pico-gpio-in (M0+ + M33 GPIO-in: `PICO_IN_LEVEL:0:1` / `PICO2_IN_LEVEL:0:1`),
pico-components (Pico 1 + Pico 2 component compatibility sweep, one
component per cell with the host model's state as the verdict; families via
`PICO_COMP_FAMILIES`, names via `PICO_COMP_ONLY`; outputs = 16/16 green),
pico-exti (M0+ + M33 IO_BANK0 edge ISR: `PICO_EXT_CNT:0..9` / `PICO2_EXT_CNT:0..20`),
pico2-rv32-arduino (RV32 with a REAL arduino-pico RISC-V sketch: `RV32_UART:OK`, `RV32_ADC:512:102`),
pico2-w-wifi-gateway, pico2-eth-gateway, pico2-w-lan, pico2-w-ap2,
pico2-w-http-gateway, pico2-eth-lan, pico2-eth-http-gateway,
pico-eth-w6300-gateway, pico-eth-intn-gateway.

Pico coverage lane 2026-10-20 (lane/pico-cov) + 2026-10-22 (lane/pico-cov2):
the PIO/DMA/EEPROM/USB-DEV columns above are green with real cells, and
2026-10-22 added **GPIO-in (M0+ + M33)**, **EXTI (M0+ + M33)** and the
**RV32 Arduino** cell. The remaining NONE cells are **engine-side**, not
frontend-side, and are listed as owner asks in HANDOVER-LANE-pico.md §5 and
HANDOVER-LANE-pico-cov2.md §5:
(a) no runner→IN-latch inject export — **the blocker is gone on the
frontend side** (the runner reaches `gpio_set_input_pin` through the
engine's devtools script path, `patches/pico-in-latch-inject.patch`
delivers the clean export): GPIO-in and EXTI are green on BOTH boards;
(b) the ARM path never drives the SPI CS line — **PROVEN AT RUNTIME
2026-10-22** (the SD model's `cs_active` stays 0 and `sdcard_spi_xfer()`
returns 0xFF forever: R0/R8/R41/R58 = all 0xFF while 60 MOSI bytes reach
the engine's SPI mirror with **0 CS events**; patch
`patches/pico-sd-cs-watch.patch` delivered);
(c) M33 SHA-256 = the engine's CSR bit map is wrong (START/WDATA_RDY/SUM_VLD
swapped vs silicon, so `sha256_wait_valid_blocking()` never returns) —
**re-measured 2026-10-22 headless**: `PICO2_SHA_STARTRC:0` +
`PICO2_SHA_WRITTEN` and NO digest; patch
`patches/pico-m33-sha256-csr-map.patch` delivered;
(d) M33 WDT = the ROM patch is not re-applied after a watchdog reboot (the
guest dies on the unpatched RP2040-format ROM); patch
`patches/pico-m33-wdt-rom-patch.patch` delivered;
(e) I2S = the engine has no I2S peripheral and the PIO-TX path has no
observe tap;
(f) **RP2350 RV32 GPIO-out is dead** (2026-10-22): RP2350 interleaves the
SIO GPIO registers while the engine implements the RP2040 map for both
chips, and the RISC-V core has no GPIO coprocessor — patch
`patches/pico-rp2350-sio-gpio-map.patch` delivered + VERIFIED (the guest
readback 0 → 1 in a patched build, M0+/M33 unchanged).

Component-compatibility lane 2026-11-05 (`tests/e2e/pico-components.spec.js`,
one component per cell, both boards, host-model state as the verdict):
**outputs 8/8**, **displays 2/2** (SSD1306 OLED + LCD2004 over I2C0),
**inputs 9/9** (potentiometer wiper at 50% → 2048; pushbutton held closed →
LOW; LDR module → ~401; soil moisture 50% → 1.65 V; NTC 25 °C → 1.65 V;
slide pot 25% → ~1024; joystick (0.25,0.75) → GP26/GP27 ~1024/~3071; slide
switch → LOW; 4×4 keypad scan reports key 5 as `KP:1,0`), **SPI 4/4**
(MAX7219 frame
12,1,10,8,11,7,1,126,2,48 → matrix[0]=0x7E; 74HC595 latches 0x81 into
outputs; Nokia 5110 fills 100 % of its 84×48 framebuffer; ILI9341 accepts a
256-pixel RAMWR window) and **I2C write-only 2/2** (PCA9685 and PCA9865:
duty 50 % / full on from raw register writes). Every cell is green on BOTH
boards. Blocked:
I2C sensor reads (j) and sub-tick GPIO strobes (k: HC-SR04, parallel
HD44780). Findings:
(g) **M33 FPU is not emulated** (`include/rp2350_arm/m33_cpu.h`: "FPU
(optional, not yet implemented)"). Measured on Pico 2: `ADD=0.00 MULT=0.00
DIV=0.00` and `(float)i=0.00`, while compile-time-folded constants stay
correct (`(int)3.75f=3`, `150e6/510000=294`). Pico 1 (M0+, soft-float) is
unaffected. Consequence: arduino-pico's float-based `analogWrite()` writes
DIV=0/TOP=0xFEFF on the M33, so the standard Arduino PWM call is broken on
Pico 2 until the engine implements VFP arithmetic. Runner workaround: the
sweep drives integer `pwm_config_*` registers instead (2kHz/50% tone,
50Hz/1472us servo) — the component models are proven, the Arduino helper is
not;
(h) **PIO-based `Servo` library cannot be proven**: arduino-pico's `Servo`
is PIO (`libraries/Servo/src/servo.pio`), and the engine steps PIO only
once per guest instruction — a sketch sitting in `delay()` never advances
the state machine, and the engine's GPIO VCD tap records only SIO writes,
not PIO `gpio_set_pin` output. The servo component is proven on both boards
via hardware PWM; `Servo.h` stays an engine ask (PIO timing + an observe
tap), consistent with the P2 "no cells written yet" note in
`vendor/emulator-hook-specs/pico-emu.md`;
(i) **buzzer silence detector mis-detected the board clock** (fixed in the
component model, `openhw-buzzer/logic.ts`): it scanned the runner's
instance map for a board type, but that map holds components only, so every
Pico fell back to the AVR 16MHz window (1.6M steps) while one Pico tick is
~2M steps — the model declared silence on every tick and never stayed
buzzing. It now uses the runner-agnostic `_boardCyclesPerUs` service
(125/150MHz), preserving the AVR path exactly.

(j) **Pico I2C master reads cannot be answered by a device model** (engine
gap, blocks the whole I2C-sensor and I2C-storage lane): the SDD mirror's
read callback `jsmirror_i2c_read` in `src/sdd_jsmirror.c` is hardcoded to
return `0xFF` and the engine exports no I2C read-inject — the only inject
on the surface is `picoemu_spimirror_inject`, for SPI. Writes DO reach the
models (proved by the SSD1306 OLED and LCD2004 cells: 95k I2C bytes decoded,
`state.lastReadMode` stays false), but every master read is a synthetic
0xFF. Measured with raw `Wire` sketches on both boards: MPU6050 returns
`MPU_ACC:65535,65535,65535` (expects `0,0,16384` at 1g) and BMP180 returns
`BMP_ID:FF` (expects `0x55`) with `BMP_UT:65535` (expects ~36760 at 25 C).
The cells `i2c/mpu6050` and `i2c/bmp180` carry a `blocked` reason and skip in
`tests/e2e/pico-components.spec.js`; promote them as soon as the engine
lands a read queue (mirror of the F1 `i2c1.injectRx` path).

(k) **GPIO strobes shorter than one runner tick do not cross the model
boundary** (blocks HC-SR04, the parallel HD44780 displays, DHT/IR
pulse-width protocols, and any bit-banged protocol whose handshake fits
inside a tick). The Pico runner samples GPIO levels once per tick (~16 ms)
instead of dispatching edges: (1) component→guest: the HC-SR04 model
measures correctly (`lastMeasurement` 100 cm, `echoDurationUs` 5800) but
its 5.8 ms ECHO pulse is sampled as a level, so the guest's `pulseIn()`
returns 0 (`SR:0`); (2) guest→component: the 4-bit LCD write sets RS +
nibble + E high + E low inside one tick, so the model never observes the
E falling edge that latches a nibble and its lines stay blank (the I2C
backpack variants are proven, because the I2C mirror delivers bytes).
Fix belongs on the runner/engine side — an edge-timed GPIO path (the
per-tick IN-latch script cannot carry a sub-tick pulse) — not in the
component models. Both cells are `blocked` in the sweep, not weakened.

Camera is ABSENT (no DCMI silicon on RP2040/RP2350). Cells must stay RED
until the engine lands — do not weaken them to HIGH-only.

## ESP32 (DevKit + CAM shell — survey-verified 2026-10-09)

**Engine bytes:** repo-pinned `src/engines/esp32-emu/dist/sab/` — SAB proxy `3c5c1866` + worker entry `4afe24dd` (the OpenHW-patched bytes: node:crypto MD5 stub + inline `CMD_GET_WIFI_STATS`/`CMD_GET_TWAI_TX` service while RUN=1); engine wasm `public/wasm/esp_engine_wasm.wasm` `d6d17d79` + ROM `public/firmware/esp32-v3-rom.bin` `445981c7`. Owner folder verdict 2026-10-20: **NOT BUILT** for the SAB pair (the owner's `dist/` was deleted mid-session) and **DIFFERENT** for the engine wasm (the repo copy carries the OpenHW patches on purpose). Refresh recipe: `src/engines/esp32-emu/README.md`.

| Board | UART | I2C | SPI | ADC | PWM/LEDC | DAC | DMA | GPIO-in | 1-Wire | DHT-RMT | TWAI | I2S | Camera | MicroPython | WiFi/ETH | SD-SPI | Display-ext | Touch |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-esp32 | FULL | FULL | FULL | FULL | FULL | FULL (loopback) | NONE | FULL (static rails, switch wiper both directions, pushbutton w/ external 10k, keypad, joystick ADC; `INPUT_PULLUP` alone and output readback are engine gaps P4/P5) | FULL (bit-bang + Dallas, centrally green) | FULL (RMT transport) | PARTIAL (RX only; TX needs ACKing peer) | FULL (DAC out) | FULL (QQVGA via camcell) | FULL (I2C) | NONE (deferred) | NONE | FULL (SSD1306 I2C, ILI9341 SPI, ePaper full frame, N5110 fill, LCD1602 I2C, MAX7219 VSPI) | NONE |
| openhw-esp32-cam | FULL | NONE | NONE | NONE | NONE | ABSENT (no 25/26 on shell) | NONE | NONE | NONE | NONE | NONE (no 21/22 on shell) | NONE | FULL (QQVGA) | NONE | FULL (gateway DHCP + 2-board LAN + HTTP/NAT 2026-10-20; LAN cell FLAKY: 2nd ESP32 board sometimes never joins — client serial stops after CCLI-BEGUN while the server side completes) | NONE | NONE | NONE |

Specs: esp32-i2c, esp32-spi, esp32-adc, esp32-pwm, esp32-dac, esp32-onewire,
esp32-dht22, esp32-twai (RX), esp32-i2s-tx, esp32-camcell (DevKit camera),
esp32-camboard (cam shell), esp32-mp-i2c,
esp32-twai-tx (RX proven; TX oracle NO-GO engine-side), esp32-rmt-ir,
esp32-touch, esp32-cam-adc, esp32-gpio-in, esp32-nvs, esp32-interrupts
(centrally green), esp32-ili9341 (centrally green), esp32-sys, esp32-pcnt,
esp32-sdspi, esp32-epaper, esp32-n5110, esp32-wdt-sleep, esp32-cam-sweep,
esp32-cam-mp, esp32-cam-sdspi, esp32-freertos, esp32-hash-crc,
esp32-cam-wifi-gateway, esp32-cam-lan, esp32-cam-http-gateway,
esp32-displays (7-segment + TM1637, mid-run model sampling),
esp32-displays-ext (LCD1602 I2C + MAX7219 VSPI, mid-run model sampling),
esp32-inputs (pushbutton + keypad + joystick, real DOM interaction *after*
firmware boot), esp32-gpio-in-switch (slide-switch wiper flipped mid-run).

### Attached components on the DevKit shell (measured 2026-11-02)

Signal-in / signal-out to the component models, each with its own probe
circuit and a guest-side needle (no cell claims a component green from the
model's own state alone):

| Component | Circuit | Verdict | Needle (what the guest read) |
|---|---|---|---|
| LED, digitalWrite(GPIO2) | `esp1:GPIO2 → led:A`, `GND → led:C` | FULL | `vHistory` 3.3 V ×20, `pins.A=true`, 1.80 V drop / 8.18 mA, canvas lit; 162 publishes (80 H / 82 L) for a 300 ms blink |
| LED, LEDC duty 192 (GPIO16) | `esp32-pwm` | FULL | guest `ESPPWM_G:` = 192, model status `dim`, `glow=true` |
| OLED SSD1306 (I2C) | `esp32-user-oled` / `-debug` | FULL | `USER_OLED_READY`, vramFill 4.1 %, power On |
| TFT ILI9341 (SPI) | `esp32-ili9341` | FULL | writeCount 2400, vramFill 3.1 %, 240×320 |
| DHT22 (RMT) | `esp32-dht22` | FULL | 27.3 °C / 61.2 % |
| PIR motion (`wokwi-pir-motion-sensor`) | `pir:OUT → GPIO27`, `attrs.motion` true/false | FULL | `digitalRead(27)` = 1 with motion, 0 without |
| Photoresistor (analog) | `ldr:2 → GPIO34`, `attrs.lux` | FULL (ADC side) | lux 500 → `analogRead(34)` 3033; lux 200 → 1214 (tracks the model's 5 V ÷ 1023 mapping) |
| Pushbutton (external 10k pull-up) | `GPIO4 → btn:1l`, `GND → 2l`, `10k: 3V3 → 1l`, `pinMode(4, INPUT)` | FULL | DOM press mid-run → `BTN:0`, release → `BTN:1` (test: `esp32-inputs`) |
| Slide switch (wiper → GPIO13) | `3V3 → 3`, `GND → 1`, `2 → GPIO13` | FULL | guest read follows the wiper **both ways** while running: `GPIO13=1` → DOM flip → `0` → flip → `1` (test: `esp32-gpio-in-switch`) |
| 4×4 membrane keypad | rows `GPIO4/5/12/13`, cols `GPIO14/15/16/17` | FULL | DOM hold on key `5` during a matrix scan → `KEY:11` (row 1, col 1) (test: `esp32-inputs`) |
| Analog joystick | `VCC/GND`, `HORZ → GPIO34`, `VERT → GPIO35`, `SEL → GPIO25` | FULL (axes) / PARTIAL (SEL) | DOM drag mid-run → `analogRead(34)` and `analogRead(35)` leave 2048 together (2048 → 686); `SEL` needs an external pull-up (P4) (test: `esp32-inputs`) |
| DC motor | `motor:1 → GPIO26`, `GND → motor:2` | FULL | live `speed` 0.49 while the pin is HIGH (test: `esp32-actuators`) |
| Buzzer (passive) | `SIG → GPIO25`, `ledcAttach(25,1000,10)` + `ledcWrite(25,512)` | FULL | live `isBuzzing: true`, `frequency: 1000 Hz` (test: `esp32-actuators`) |
| Servo (RC PWM) | `PWM → GPIO13`, `ledcAttach(13,50,16)` | FULL (angle) / PARTIAL (width source) | 1500 µs → **92.7°**, 2000 µs → **141.2°** (exact for the 544–2400 µs band); the pulse width is recovered by disambiguating 50–400 Hz duty counts, so a firmware whose duty count fits two resolutions is ignored instead of guessed (`pwmWidthExact`) |
| LCD1602 (I2C PCF8574 0x27) | `SDA → GPIO21`, `SCL → GPIO22`, raw Wire HD44780 init | FULL | live `textContent` = `Hi1602`, `lineCount` 2, backlight true on every sample (test: `esp32-displays-ext`) |
| MAX7219 8-digit (SPI) | `DIN → GPIO23`, `CLK → GPIO18`, `CS → GPIO5` | FULL | live `matrix[0]` = 0x7E, `matrix[1]` = 0x30, `shutdown` false on every sample (test: `esp32-displays-ext`) |
| ePaper 2.9" (SPI) | `CS 5 / DC 21 / RST 22 / DIN 23 / CLK 18` | FULL | `ramPointer` 4736 = full 296×128 frame, `powerStatus` On (test: `esp32-epaper`) |
| Nokia 5110 (PCD8544, SPI) | `SCE 5 / RST 21 / DC 22 / DIN 23 / CLK 18` | FULL | `fillPercent` 100 after the firmware fill (test: `esp32-n5110`) |
| 7-segment digit (direct drive) | `A..G → GPIO12..18`, `COM.1 → GND` | FULL | live `digitSegments[0]` = A..G **true**, DP false, steady across the run (test: `esp32-displays`) |
| TM1637 4-digit (bit-banged CLK/DIO) | `CLK → GPIO22`, `DIO → GPIO23`, `3V3/GND` | FULL | live `digits` = `[0x3F,0x06,0x5B,0x4F]` ('0','1','2','3') — exact after `0x40`/`0xC0`/`0x8F`, on every sample (test: `esp32-displays`) |
| NeoPixel matrix/ring (WS2812) | `DIN → GPIO4`, `Adafruit_NeoPixel(8,4,NEO_GRB+NEO_KHZ800)` | **PARTIAL (engine)** | model `pixels` stays `[]`: Adafruit transmits over RMT and the engine ends a TX after **one symbol** — the tap returns `words=1` per `show()` (237 shows → 237 words). Runner side is ready (`rmt-neopixel.ts`, 8 unit tests; flat-word tap shape normalized) — needs owner ask P3 |
| HC-SR04 ultrasonic | `TRIG → GPIO5`, `ECHO → GPIO18`, `attrs.distance=25` | **PARTIAL** | `pulseIn(18, HIGH)` 0 µs before the fix, 245 µs after → 4.2 cm; with a measured steps/µs calibration 3097 / 2188 µs (53 / 38 cm) — the ratio drifts with guest workload, so no stable distance |

HC-SR04 is the one engine-limited component: `esp32-emu`
`pollGpioChanges()` returns `[{pin, level}]` **without timestamps**, so both
edges of a 10–12 µs TRIG pulse carry the same poll stamp (width 0 µs) and
the ECHO window can only be scaled by a guessed steps/µs ratio. Fixed what
the frontend owns (`openhw-studio-emulator` `4119e2d`: accept a 0-width
trigger as "width unknown", scale the echo through the
`_boardCyclesPerUs` service instead of hard-coded AVR 16). Accurate
pulse-width components on ESP32 (HC-SR04, IR decode, servo input) stay
PARTIAL until the engine exposes a per-edge timestamp/cycle counter —
owner ask.

**Interaction timing (cost three red cells before it was named).** Every
component UI renders with `pointer-events: none` until React `isRunning`
flips, and that flip can land before the guest has booted. A DOM click in that
window hits the canvas, so the model never sees the event and the cell reads
"the component does nothing". Both input specs now gate on
`OpenHWE2E.snapshot()`: `running` **and** the sketch's readiness needle in
`serialText` (new e2e-only field) **and** the target element's computed
`pointer-events !== 'none'`. No fixed sleeps, no retries of the whole circuit.

**ADC pin ids.** On the DevKit shell the ADC nets are addressed as
`GPIO34`/`GPIO35` in wires; a bare `34` endpoint does not land on the injected
net, so `analogRead` stays at its 2048 default and the component looks dead
while its model is fine.

## micro:bit v2 / Retro (survey-verified 2026-10-09; re-swept 2026-10-20)

**Engine bytes (micro:bit):** repo-pinned `public/vendor/board-engines/microbit/` + `src/worker/engines/microbit/` + `public/wasm/nrf52833_periph_wasm_bg.wasm` — glue `112f7ab3` + wasm `d5a0e574`, **ONE** pair, byte-equal to the owner's `microbit-v2/demo/pkg` freeze (owner commit `4a46800`). Owner folder verdict 2026-10-20: **SAME**. Refresh recipe: `public/vendor/board-engines/microbit/README.md`.

**Engine bytes (Retro):** repo-pinned `public/vendor/board-engines/8086emu/multi_cpu_emu.js` + `public/wasm/multi_cpu_emu_bg.wasm` — glue `9832e032` + wasm `fa53c0f2`, **ONE** pair, byte-equal to the npm package `8086emu@1.5.1` and to the owner's `~/Documents/8086/pkg`. Owner folder verdict 2026-10-20: **SAME**. Refresh recipe: `public/vendor/board-engines/8086emu/README.md`.

| Board | UART | I2C | SPI | ADC | DMA | GPIO | Button/Touch | Display | RTC | NVS/EEPROM | MicroPython | I2S | 1-Wire |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| openhw-microbit-v2 | FULL (TX + RX: microbit-cells → `HELLO` (the host saw the byte) and microbit-uart-rx → `UART_RX_READY` + `RX:<hex>` — the host's injected byte came back out of the guest over UARTE0) | FULL (microbit-cells → `OLED:OK` — the host's SSD1306 model received the frame; its telemetry `updateCount` > 0) | FULL (microbit-cells → `S3RX:OK` — the host's SPIM23 model looped the byte back) | FULL (microbit-saadc → `MB_SAADC:1877` — the host's pot value reached the guest exactly; the `attr-600mV` variant → `MB_SAADC:683`) | PARTIAL (the engine's EASYDMA pumps run on every path that uses them (UARTE/TWIM/SPIM/SAADC), but there is **no mem-to-mem cell** — no spec asserts a DMA transfer, only that the DMA-driven peripherals work) | PARTIAL (button-A proven (microbit-cells → `BTN_A_REL`); the generic `digitalRead` path is unproven; the PWM0 readback gear is proven (microbit-pwm → `PWM_SEQ:250` + the LED telemetry `illuminated: true`)) | PARTIAL (button-A FULL — microbit-cells → `BTN_A_REL`: the engine reports the edge and the host drives the press; capacitive touch unproven — the nRF52833's capacitive front end is not modelled) | PARTIAL (OLED FULL — microbit-cells → `OLED:OK` + `updateCount` > 0; the 5×7 LED matrix is observed in the board telemetry (`matrixLit`); SPI displays are not proven on this board) | NONE (no cell — the nRF52833 has **no RTC**: the die-temperature sensor is the nearest thing and *its* cell is skipped too (microbit-temp.spec.js:1-6); the board's time comes from the engine's low-power timer) | NONE (the NVMC readback cell exists but is **skipped**: it needs the runner NVMC erase-pump patch *and* a fixed `.bin` image that erases a page, writes a magic word and prints `MB_NVS:<magic>` (microbit-nvs.spec.js:1-7 `test.describe.skip`) | ABSENT (fixed-bin only — the board runs prebuilt images from `public/firmware/microbit/`; there is no MicroPython build path for the nRF52833 in this repo) | NONE (the engine's I2S taps and the runner's I2S pump are in place (microbit-runner.ts `pumpSysExtras`), but the cell is **skipped** until a fixed `i2s_nrf.bin` image lands (microbit-i2s.spec.js:3-8)) | NONE (no cell — the nRF52833 has no 1-Wire peripheral; a bit-banged 1-Wire over P0-P2 would need a cell) |

Specs (micro:bit): microbit-cells (5 cases — `HELLO`, `BLINK`, `OLED:OK`, `S3RX:OK`, `BTN_A_REL`), microbit-uart-rx, microbit-saadc, microbit-pwm (owner P164 readback gear), microbit-i2s / microbit-nfc / microbit-nvs / microbit-temp (all four are **skipped** — blocked on a firmware image and/or a runner patch; they are listed so the gap is visible, not so it looks proven).

| Board | UART | GPIO | GPIO-in | Bit-bang (I2C/SPI/PWM/SD) | ADC | MicroPython |
|---|---|---|---|---|---|---|
| openhw-8086 | FULL (TX + RX-echo: retro-boards → `HELLO_R86`; retro-rx-echo → `RXECHO_RDY` + the echoed `Q` — the host's injected byte came back out of the guest's 8251) | FULL (retro-gpio → the host's LED lit from the guest's port write) | FULL (retro-gpio-in → `SW86`: the host's slide-switch reached the 8086 PPI PA0) | NONE (capable — the engine exposes the whole port/pin model, but no spec drives a bit-banged I2C/SPI/PWM/SD transaction on this board) | ABSENT (the engine's ADC is a stub that returns NaN — `adc_get`/`adc_set` in the 8086emu glue carry no conversion) | ABSENT (asm only — the retro boards run hand-written .asm, there is no MicroPython port) |
| openhw-8088 | FULL (retro-boards → `HELLO_R88` (console TX); retro-8088-gpio → `RX88_RDY` + the echoed `Z`: the host's injected byte came back out of the 8088's 8251 — the earlier "8086 only" note was stale) | FULL (retro-8088-gpio → the host's LED lit from the guest's port write — the earlier "inject exists, no cell" note was stale) | FULL (retro-8088-gpio → `SW88`: the host's slide-switch reached the 8088 PPI PA) | NONE (capable — no bit-bang cell exists on this board) | ABSENT (ADC stub, as on the 8086) | ABSENT (asm only) |
| openhw-8085 | FULL (retro-boards → `HELLO_R85`) | FULL (retro-gpio → the host's LED lit from the guest's port write) | FULL (retro-gpio-in2 → the host's slide-switch reached the 8085 PPI input latch) | NONE (capable — no bit-bang cell exists on this board) | ABSENT (ADC stub) | ABSENT (asm only) |
| openhw-8051 | FULL (retro-boards → `HELLO_R51`) | PARTIAL (LOW-sink only — retro-gpio → the 8051 quasi-bidirectional port drives LOW; the HIGH side is the pull-up, so a HIGH-drive cell does not exist) | FULL (retro-gpio-in2 → the host's slide-switch reached the 8051 P1/P2) | NONE (capable — no bit-bang cell exists on this board) | ABSENT (ADC stub) | ABSENT (asm only) |
| openhw-6502 | FULL (retro-boards → `Hi` on the console) | FULL (retro-gpio → the host's LED lit from the guest's port write) | FULL (retro-gpio-in2 → the host's slide-switch reached the 6502 VIA pins) | NONE (capable — no bit-bang cell exists on this board) | ABSENT (ADC stub) | ABSENT (asm only) |
| openhw-z80 | FULL (retro-boards → `Hi` on the console) | FULL (retro-gpio → the host's LED lit from the guest's port write) | FULL (retro-gpio-in2 → the host's slide-switch reached the Z80 kit latch E0h) | NONE (capable — no bit-bang cell exists on this board) | ABSENT (ADC stub) | ABSENT (asm only) |
| openhw-rv32 | FULL (retro-boards → `Hi` on the console) | ABSENT (no GPIO model — the engine's rv32 core has no port model) | ABSENT (no GPIO model) | ABSENT (no GPIO model, so nothing can be bit-banged) | ABSENT (ADC stub) | ABSENT (asm only) |

Specs (retro): retro-boards (7 console cells), retro-gpio (+in), retro-gpio-in (8086 PPI PA0), retro-gpio-in2 (8085 / 8051 / 6502 / Z80 GPIO-in), retro-rx-echo (8086 8251 echo), retro-8088-gpio (8088 LED / PPI PA / 8251 echo), retro-pit (8086 8253 ch0 → IRQ0), retro-ctc (Z80 CTC ch0 → IM1), retro-via (6502 VIA T1 → IRQ), retro-8051-timer (8051 Timer0 → vector 000Bh), known-gaps (the 8051 HIGH-float gap is asserted there, not silently).

Real-system chips with **no** proof yet (all NONE): the 8086 PIC / 8237 DMA (the XT needs 8253+8259+8237 for anything beyond polling loops — the engine exposes `dma_status`, `public/vendor/board-engines/8086emu/multi_cpu_emu.js:119`, but no cell drives a transfer) and the 8051's full timer/counter array beyond Timer0 mode 1. Real nRF52833 extras: **BLE 5.1 — the engine HAS a full BLE model** (`ble_adv_state`, `ble_smp_*`, `ble_lesc_*`, `ble_complete_*`: `public/vendor/board-engines/microbit/nrf52833_periph_wasm.js:393`ff) but **no cell drives it** and the runner wires no BLE stack → **NONE, not ABSENT** (the earlier "no engine model — needs owner work" note was wrong: the gap is the *cell + runner wiring*, not the engine). NFC is the same shape: the engine models NFCT (`nfct_take_tx`/`nfct_complete_rx`/`nfct_field_present`) and the runner pumps it (microbit-runner.ts:609-654), but the cell is **skipped** until the `nfct_nrf.bin` firmware image lands (microbit-nfc.spec.js:12 `test.describe.skip`) → NONE. USBD stays **ABSENT** — not pinned on the v2 board.

## System, crypto & connectivity blocks (audited 2026-10-09 vs engine inventories)

Same vocabulary. These have no protocol spec today; NONE = capable-or-modeled,
no e2e proof. (Inventories: F1 `stm32 emu blue pill/src/peripherals/`, F4
`stm32-periph-wasm/src/peripherals/`, ESP32 `engine-wasm/src/peripherals/*`,
Pico `Pico-emu/*.c`, runners in `src/worker/runners/`.)

| Family | CRC | TRNG/RNG | HASH/CRYP | Watchdog | EXTI/Interrupts | PWR/Sleep | Backup/NVS | Clocks | Debug |
|---|---|---|---|---|---|---|---|---|---|
| STM32F1 | FULL 2026-10-20 — CRC_DR of 3 words equals the silicon value FB5C7298 on 3 boards (guest MMIO, cell stm32f1-crc; the engine's crc.rs computes the same polynomial) | ABSENT (no RNG silicon) | ABSENT (no hash/cipher accelerator in the STM32F1 die) | PARTIAL 2026-10-20 — IWDG arm/reload/fire proven on 3 boards (cell stm32f1-sys, needle `<TAG>WDG_ARMED` — the guest's ARMED line is the last thing before the core stops, and the runner's host marker `F1WDOG_RST:1` reports the engine's watchdog-reset bus event; the gd32 dice add cell stm32-gd32-core → `GC8WDG_ARMED`); WWDG still unproven (engine wwdg.rs exists) | FULL 2026-10-20 — EXTI_SWIER -> ISR on 3 boards (EXTI_FIRED, cell stm32f1-sys); other IRQs / NVIC priorities unproven | PARTIAL 2026-10-20 — the PVD path is FULL: the guest's PWR->CSR PVDO level follows the engine's MODELED supply voltage (host attr supplyMv -> pwr_set_supply_mv; PVDO=1 below the 2200 mV PLS threshold, 0 above; cell stm32f1-pwr-clk). SLEEP/STOP is NOT reachable: the engine's WFI only parks the core when deliver_irqs is on and the product path leaves it off (engine src/cpu/mod.rs:122, src/cpu/thumb.rs:2136-2148), so the power-mode mirror stays RUN | FULL 2026-10-20 — the BKP_DR1 magic 0xCAFE reads back on 3 boards (cell stm32f1-sys); NVS/flash unproven | FULL 2026-10-20 — the engine's RCC model decodes the guest's clock-tree writes: F1RCC_HZ:32000000 (PLL x4) and F1RCC_HZ:72000000 (PLL x9) on the guest's own CFGR writes, plus the engine's SW->SWS mirror in the CFGR readback and the guest clock advancing in exact delay(2000) quanta (cell stm32f1-pwr-clk) | PARTIAL 2026-10-20 — the guest reads the engine's per-chip debug ID (DBGMCU_IDCODE 0x10016410 on the F103, 0x2BA01477 on the GD32 — cell stm32f1-dbg). The host-side SWD (engine swd.rs: DP/AP, halt/resume/step, watchpoints) and bootloader (bootloader.rs) surfaces exist in the engine but the F1 runner never calls them, so there is NO host-visible debug surface (NO swd_*/bootloader_* call in src/worker/runners/stm32f1-runner.ts) |
| STM32F4 | FULL 2026-10-22 — CRC_DR of 3 words equals the silicon value FB5C7298 on 4 of the 5 dice (cell stm32f4-sysblocks, needles `F4CRC_OK` + `F4CRC_HEX:FB5C7298` + `F4CRC_DEC:4217139864`; the cell's CRC_TYPES list is F407 / F401 / F411 / F407VE — the F429 is not in it, so the F429 CRC cell is still open) | FULL 2026-10-22 — RNG_DR yields distinct nonzero words on the 3 rng:true dice (cell stm32f4-rng, needle `F4RNG_OK`; the model's data-ready flag is RNG_SR bit 6, silicon's is bit 4 — the old 'DRDY never sets' NO-GO was a cell bug). ABSENT on F401/F411 (engine CHIPS table rng:false, node_modules/stm32f4-emu/site/stm32f4.js:76-77) | FULL 2026-10-22 — HASH: SHA-256 + SHA-1 digests vs the published vectors (cell stm32f4-sys, needle `F407HASH_OK`); CRYP: AES-128 ECB vs the FIPS-197 published vector (cell stm32f4-cryp, needle `F4CRYP_OK` — F407 / F407VE / F429, the cryp:true dice). ABSENT on F401/F411 (hash:false / cryp:false, stm32f4.js:76-77) | FULL 2026-10-22 — IWDG arm/reload/fire (cell stm32f4-sys, needle `<TAG>WDG_ARMED`) AND WWDG: the countdown, the EWIF latch, the watchdog reset and the reset-cause word (cell stm32f4-sysblocks, needles `F4WWDG_ARMED` + `F4WWDG_RSTF` + the CSR bit 30 = WWDGRSTF, on all five dice) | PARTIAL 2026-10-20 — EXTI_SWIER → ISR (cell stm32f4-sys, needle `EXTI_FIRED`); other IRQs / NVIC priorities unproven | FULL 2026-10-22 — the PWR CR readback + the host mode marker + a real WFI sleep/wake with the wake-up flag (cell stm32f4-sysblocks, needles `F4PWR_SLEEP` + `F4PWR_WOKE` + `F4PWR_WUF` + `F4PWR_MODE:2`, on all five dice) | PARTIAL 2026-10-20 — RTC_BKP0R backup-domain readback (cell stm32f4-sys, needle `BKP_OK` + `BKP_HEX:CAFE1234`); NVS/flash unproven | FULL 2026-10-22 — the RCC clock tree: the source lock, the SYSCLK switch + the SWS mirror, the prescalers and the bus gates (cell stm32f4-sysblocks, needles `F4CLK_OK` + `F4CLK_CFGR` + `F4CLK_CFGR2` + `F4CLK_AHB1`, on all five dice). The tickMHz divider itself is asserted by cell stm32f4-clock → `F4CLK_DRAWN` (guest-time quanta, no wall-clock claim) | FULL 2026-10-22 — the guest-visible debug surface: the DBGMCU IDCODE + CR mask, the DWT gating rule and the ITM stimulus port (cell stm32f4-sysblocks, needles `F4DBG_ITM_SENT` + `F4DBG_ID:` + `F4DBG_CR:` + `F4DBG_CNT:` + `F4DBG_ITMREADY:1` + `QX7#`, on all five dice). This is the debug PERIPHERAL, not a host-side SWD debugger — the engine still exposes no SWD/OTG debug host to the app |
| AVR | ABSENT (no CRC hardware on the ATmega328P/2560/ATtiny85, and avr8js 0.21.0 models no CRC peripheral — its whole peripheral set is `adc, clock, eeprom, gpio, spi, timer, timer-attiny, twi, usart, usi, watchdog`: `node_modules/avr8js/dist/esm/peripherals/`) | ABSENT (no RNG hardware on the AVR family, none in avr8js) | ABSENT (no crypto accelerator on the AVR; avr8js has none) | PARTIAL (avr-wdt → Uno + Nano, reset mode: the firmware pets the dog, arms it, starves it, and a **second** `AVR_WDT_BOOT` over the emulated serial IS the reboot proof; interrupt mode: `AVRWDT_I_ISR:1` — avr-wdt.spec.js:85-98,130-137. The Mega 2560 WDT vector is not in the file (avr-wdt.spec.js:14) and the ATtiny85's WDTCR≠WDTCSR is deferred (avr-wdt.spec.js:15)) | PARTIAL (avr-mega-periph → `MEGA_EXT_CNT:` **exactly 10** per 10 driven edges — a storm would inflate it, so `==10` is the assertion (avr-mega-periph.spec.js:285-303); avr-nano-periph → `NANO_EXT_CNT:` exactly 10 (avr-nano-periph.spec.js:277-291). The ATtiny85 INT0 path is unproven (the tiny row is the honest-substitution row, avr-tiny-honest.spec.js:6-25); the Timer1-CTC ISR-rate cells (`MEGA_TMR_ISRS:`) prove the TIMER interrupt, not the external pin) | NONE (no cell — avr8js models no sleep/power-down state and the runner has no sleep path; the WDT cell lists "AVR sleep (CPU no-op)" as an honest boundary, avr-wdt.spec.js:15) | FULL (the EEPROM IS the NVS store on AVR: avr-eeprom → `EE_RB:` byte-exact AB/CD readback; the Mega/Nano run a 4 KB backend (`MEGA_EE_RB:`/`NANO_EE_RB:`) and the ATtiny85 a 512-byte one (`TINY_EE_RB:`)) | PARTIAL (avr-mega-periph → `MEGA_FCPU:16000000` + `MEGA_TICKS1024:` inside the Timer1-gate window 14000..17250 (avr-mega-periph.spec.js:319-333); avr-nano-periph → the same `NANO_TICKS1024:` cell; avr-tiny-honest → `TINY_FCPU:` + `TINY_DTMS:` inside 900..1150 (avr-tiny-honest.spec.js:309-320) — the tiny cell proves the clock IDENTITY, not its rate) | ABSENT (no OCD/JTAG/assert model in avr8js and no debug channel in the runner) |
| Pico | ABSENT (no CRC peripheral in the RP2040/RP2350 die) | NONE (ROSC jitter, no cell) | PARTIAL 2026-10-20 (RP2350 SHA-256: the digest engine is real and the canonical SDK flow yields the FIPS vector in a patched build — `patches/pico-m33-sha256-csr-map.patch` (the CSR bit map contradicted silicon AND the RP2350 atomic aliases were collapsed, so the repo bytes still hang in `sha256_wait_valid_blocking()`); ABSENT on RP2040 — no SHA silicon) | PARTIAL 2026-10-20 (M0+ WDT green — unblocked by the Pico `Serial.`→`Serial1.` rewrite fix; M33 WDT engine-side: `reset_runtime_peripherals()` restores the RP2040-format ROM without re-applying `rom_patch_rp2350_arm()`, so the guest dies on the unpatched ROM) | PARTIAL 2026-10-20 (M0+ + M33 GPIO edge interrupts green — cells pico-exti: the guest ISR counts the RISING edges of a GP12→GP13 loopback; the blocker was the IN-latch inject, now reachable via the engine's devtools script path + `patches/pico-in-latch-inject.patch`; other NVIC/priority paths unproven) | NONE (WFI sleep RED on M0+ & M33 — engine-side) | NONE (sdd_eeprom.c) | PARTIAL (arch-clocks: M0+ + M33 green 2026-10-20; clocks.c) | NONE (gdb.c) |
| ESP32 | NONE (the engine computes CRC32 inside its SHA/RMT model; the cell esp32-hash-crc exists on the DevKit (needle `ESP_CRC32:`) but its green verdict belongs to lane/esp32-cov2 — no proof is recorded in this repo yet) | NONE (rng in rmt_rng_math.rs) | NONE (aes+rsa+sha_ecc_key.rs) | NONE (timers.rs MWDT) | NONE (the engine models the GPIO/EXTI matrix; the cell esp32-interrupts exists on the DevKit (needle `EXTI_COUNT:`) but its green verdict belongs to lane/esp32-cov2 — no proof is recorded in this repo yet) | NONE (ULP present, unproven) | NONE (partition_table+NVS) | NONE (clock(s).rs) | NONE (gdb_session) |
| micro:bit v2 | NONE (no cell — the engine only exposes the BLE radio's CRC (`radio_crc32`, `public/vendor/board-engines/microbit/nrf52833_periph_wasm.js:1975`); the nRF52833's own CRCC accelerator is not modelled, so there is nothing to prove yet) | NONE (no cell — the engine has an RNG tap and a die-temp sensor (`temp_set_celsius`, :2277), but the die-temp cell is SKIPPED (microbit-temp.spec.js:14 `test.describe.skip`) and no cell drives the RNG) | ABSENT (the nRF52833's AES/CCM accelerator is not modelled; the glue's crypto helpers are BLE-LE-only (`ble_smp_*`, `ble_lesc_*`) and no cell drives them) | NONE (no cell — the engine exposes `is_watchdog_reset_requested` (:1570) but the runner does not pump a WDT-reboot path (microbit-runner.ts:591 "WDT-reboot / sleep-wake / QSPI are NOT pumped here")) | PARTIAL (microbit-cells → `BTN_A_REL`: the engine reports the edge and the **host** observes the press — a GPIOTE edge path is proven; the generic `set_intr_pending` (:2223) / PPI / NVIC paths are not proven by any cell) | NONE (no cell — the engine exposes `power_notify_sleep_enter`/`power_notify_sleep_exit` (:1760) and `power_take_systemoff` (:1783), but the runner does not pump the sleep-wake path (microbit-runner.ts:591), so nothing observes it) | NONE (the NVMC readback cell exists but is **SKIPPED**: it needs the runner's NVMC erase-pump patch AND a fixed `.bin` image that erases a page and writes a magic word (microbit-nvs.spec.js:8 `test.describe.skip`); the engine half exists — `nvmc_complete_erase` (:1696)) | NONE (no cell — the engine ticks via `tick`/`tick_n` (:2288) and the board's time comes from the low-power timer, but no cell measures the guest clock; the nRF52833 has no RTC, and the die-temp cell that would stand in for it is skipped) | ABSENT (no SWD/JTAG/UF2 model — the board runs a fixed `.bin` image) |
| Retro | ABSENT (no CRC in the 8086emu API — the modelled machines are 8086/8088/8085/8051/6502/Z80/rv32 and none of them has a CRC peripheral; the glue's `Emulator` class has no crc entry: `public/vendor/board-engines/8086emu/multi_cpu_emu.js:3-816`) | ABSENT (no RNG export in the 8086emu API) | ABSENT (no crypto export in the 8086emu API) | ABSENT (no watchdog in the 8086emu API; the XT/8086 has no WDT and the 8051 has no watchdog peripheral) | PARTIAL (four timer-IRQ cells are green — 8086 8253 ch0 → INT 8/IRQ0 (retro-pit: the guest's tick counter must reach ≥8 `T` prints, serialNeedle `TTTTTTTT`), Z80 CTC ch0 → IM1 vector 38h (retro-ctc), 6502 VIA T1 → IRQ (retro-via), 8051 Timer0 mode 1 → vector 000Bh (retro-8051-timer); the engine drives them through `set_interrupt_mode` (:602) / `set_ea` (:588) / `via_irq` (:763) / `pit_count` (:405) / `ctc_count` (:68). Still unproven: the 8259 PIC's other IRQ lines and the 8237 DMA — the engine exposes `dma_status` (:119) but no cell drives a transfer) | ABSENT (no sleep/power state in the 8086emu API; the 8085 HLT is not modelled) | ABSENT (no EEPROM/flash NVS for the retro boards — they are RAM-only; the engine does expose an *external* flash/EEPROM window (`flash_region`, :161 — "External Flash/EEPROM window (base, len) if configured" — plus `load_flash` :312 and the DOS `fs_get`), but no cell drives it) | NONE (no cell — the engine exposes `set_clock` (:578) and `rtc_write` (:513) (the PC's RTC), but no cell measures the guest clock or the RTC) | ABSENT (no guest-visible debug port; the engine's `run_bp`/`set_pc` are harness-side, not a debug peripheral) |

Connectivity extras not in the main tables:

| Feature | Status |
|---|---|
| Pico-W CYW43 WiFi traffic | FULL 2026-10-15 — Arduino join + gateway DHCP (STATUS=3 IP=192.168.4.2) via unified gateway :5030; the runner enables CYW43 + the WS pump in pico-runner.ts. Cell: `pico-wifi-gateway` ("Pico W joins AP + DHCP via gateway"). **Engine bytes are repo-pinned** (`src/engines/pico-emu/`, md5 glue `c3b784f0` + wasm `0c74dffe`) since 2026-10-20 — the old "engine from owner folder (vite alias)" note is stale (an owner-folder alias is a hard build failure in CI). |
| Pico-W LAN (2-board TCP) | FULL 2026-10-20 — STA+STA same room, TCP echo both directions observed (SRV-RX/SRV-ECHOED/CLI-RX). Cell: `pico-wifi-lan`. The v4 DNS is green + asserted here too (`CLI-DNS:1:104.20.23.154`): the static-IP client had NO resolver (no DHCP lease) — it now calls `WiFi.setDNS(192.168.4.1)` (gateway resolver), and the **lease** path is proven separately in `pico-wifi-dns` (see the DNS row). |
| Pico-W v4 DNS (gateway resolver) | FULL 2026-10-20 — **both** resolver paths are proven, and the old "needs the gateway patch on branch `lane/net-dns` (not yet on main)" note was **STALE**. (a) *explicit*: `WiFi.hostByName("example.com")` with the guest's resolver pointed at the gateway — cell `tests/e2e/pico-wifi-dns.spec.js` → `DNS-LINK=3`, `DNS-IP=192.168.4.2`, `DNS-SERVER=192.168.4.1`, `DNS-SERVER2=192.168.4.1`, `DNS-RC=1`, `DNS-RESOLVED=104.20.23.154`. (b) **lease path** (the guest does NOT call `WiFi.setDNS()`): the same spec's second case takes the resolver from the DHCP lease → `DNS-LINK=3`, `DNS-IP=192.168.4.2`, `DNS-SERVER=192.168.4.1` (the resolver the lease carried), `DNS-RC=1`, `DNS-RESOLVED=172.66.147.243` → **2/2 green**, re-run live on 2026-10-20 with the opt-in guard removed. The gateway that advertises it is `openhw-unified-gateway` **main** @ `3f8814b` "DHCP: advertise the gateway resolver (192.168.4.1) as the lease DNS server" (`dhcp.go`: the lease now advertises 192.168.4.1 FIRST and keeps 8.8.8.8 as the secondary fallback) — `git branch --contains 3f8814b` → `main`; the running binary carries it (its DHCP log line is `Offering %s (dns %v)`). The spec's lease case is **no longer opt-in** (the `test.skip(!process.env.DHCP_DNS, …)` guard is gone). Resolver = the gateway's own DNS on 192.168.4.1:53 (gVisor VN DNS, answers through the host resolver) — it lives in the guest's own L2 domain, so no host egress is needed. Packet trace: guest→192.168.4.1:53 → `A 104.20.23.154 A 172.66.147.243`. |
| Pico-W HTTP client | FULL 2026-10-15 — Arduino HTTPClient GET via gateway NAT (10.150.211.85→host :8092): 200 + body exact. Cell: `pico-http-gateway`. |
| F4 HTTP client | FULL 2026-10-15 — owner eth_http.bin via gateway NAT (TCP + GET + 200 + body, byte-exact response); polling firmware (no ethIrq). |
| Pico IPv6 (SLAAC) | PARTIAL 2026-10-15 — RV32 ping6 guest gets gateway RA (RA-OK live, SLAAC addressing works); ICMPv6 echo unproven (guest targets a hardcoded vnet peer, gateway answers NS only for its own addresses). |
| Pico-W SoftAP | FULL 2026-10-20 — guest beginAP + STA join (STA DHCP lease .2) + TCP BOTH directions: AP-terminated (STA→AP-hosted server, `AP-ECHO:HELLO-AP-SERVE` bytes observed) and AP-client→STA-server. AP subnet fixed at .4.1 by the engine (softAPConfig not honored); the .1 collision with the gateway is resolved GATEWAY-side (room-aware .1 arbitration: a room member that claims .4.1 as a soft AP makes the gateway stop answering .1 ARP). Cells: pico-wifi-ap-serve (new, green), pico-wifi-ap (green), pico-wifi-ap2 (green). |
| Pico-ETH W5500 traffic | FULL 2026-10-15 — Arduino Wiznet5500lwIP DORA via unified gateway :5030 (MACRAW sock0, tickMHz 125); the runner board enables + the WS pump in pico-runner.ts. Polled configuration (no IRQ pin). Cell: `pico-eth-gateway` ("Pico-ETH DHCP via gateway MACRAW"). Engine bytes repo-pinned (`src/engines/pico-emu/`) since 2026-10-20. |
| Pico-ETH W6300 traffic | FULL 2026-10-20 — board attr `ethChip:'w6300'` on the existing W5500-EVB shells (openhw-pico-eth / openhw-pico-2-eth, W5500 stays the default): the runner attaches the engine's W6300 board instead (`_picoemu_board_eth6300` + `_picoemu_w6300_gw_enable`) on the SAME gateway room + 192.168.4.0/24 DHCP pool as CYW43 and the W5500; FQBN wiznet_6300_evb_pico. Arduino `lwIP_w6300` guest (PIO+DMA QSPI transport, engine PIO-QSI bridge) full DORA: version=0x61, MAC RAW mode, ETH-BEGIN-OK, lease 192.168.4.3, plus HTTP 200 + body hello-openhw through the gateway NAT (M0+ and M33). The guest uses the INTn=15 constructor, so this also proves the W6300 interrupt path. Cell: pico-eth-w6300-gateway. |
| Pico-ETH W5500 INTn interrupt (GPIO21) | FULL 2026-10-20 — `Wiznet5500lwIP eth(17, SPI, 21)` on openhw-pico-eth: in IRQ-pin mode the arduino-pico driver registers NO polled RX handler (only `attachInterruptParam(pin, _irq, LOW)`), so the OFFER/ACK can only reach the guest through the INTn interrupt. Observed: ETH-BEGIN-OK + lease 192.168.4.3, guest IO_IRQ_BANK0 deliveries = 3, PROC0_INTE armed = GPIO21 LEVEL_LOW only (1048576). Polled control (`eth(17, SPI)`): same lease, 0 deliveries, nothing armed. Cell: pico-eth-intn-gateway. |
| Pico 2 W (M33) CYW43 WiFi traffic | FULL 2026-10-20 — openhw-pico-2-w joins the fake AP + gateway DHCP (STATUS=3, IP=192.168.4.2) via unified gateway :5030; the runner boots the RP2350/M33 arch (arch 2) and enables CYW43 + the WS pump. Cell: pico2-w-wifi-gateway. Engine bytes repo-pinned (`src/engines/pico-emu/`) since 2026-10-20 — the old "engine from owner folder (vite alias)" note is stale. |
| Pico 2 W (M33) LAN (2-board TCP) | FULL 2026-10-20 — two openhw-pico-2-w as STAs in one gateway room, static 192.168.4.20/.21, TCP echo both directions observed (SRV-RX:HELLO-LAN, SRV-ECHOED, CLI-RX:ECHO:HELLO-LAN, CLI-LAN-DONE). No clock attr needed — the M33 arch default (150MHz) paces the guest. Cell: pico2-w-lan. |
| Pico 2 W (M33) SoftAP | FULL 2026-10-20 — guest beginAP (APC-IP:192.168.4.1) + STA join on a static address (STS-STATUS=3, STS-IP=192.168.4.20) + TCP echo across the AP<->STA link (APC-CONN:1, STS-ECHOED, APC-RX:AP-ECHO2:HELLO-STA). The guest AP address is engine-fixed at .4.1 (softAPConfig not honored, same as M0+) and the direction is AP-client -> STA-server: the gateway fast-answers ARP for .1 and would steal the AP address from a joining STA (room.go apOwner). Cell: pico2-w-ap2. |
| Pico 2 W (M33) HTTP client | FULL 2026-10-20 — Arduino HTTPClient GET via gateway NAT (10.150.211.85 -> host :8092): HTTP-STATUS=3, HTTP-IP=192.168.4.2, HTTP-CODE:200, HTTP-BODY:hello-openhw. Cell: pico2-w-http-gateway. |
| Pico 2 ETH (M33) W5500 traffic | FULL 2026-10-20 — openhw-pico-2-eth full DORA via unified gateway :5030 (ETH-BEGIN-OK, conn=1, lease 192.168.4.3); MACRAW sock0 on the M33 arch, tickMHz 125 (same engine-side quirk as the M0+ ETH cell). Cell: pico2-eth-gateway. |
| Pico 2 ETH (M33) LAN (2-board W5500 TCP) | FULL 2026-10-20 — two openhw-pico-2-eth in one gateway room, static 192.168.4.20/.21, TCP echo over the W5500 MACRAW path (ETH-BEGIN-OK both, ESRV-IP=192.168.4.20, ECLI-IP=192.168.4.21, ECLI-CONN:1, ESRV-ECHOED, ECLI-RX:ECHO:HELLO-LAN). tickMHz 125 on both boards. Two engine-side facts the cell must respect: the guest waits need delay() (the arduino-pico lwIP pump only runs while the sketch yields — under a busy spin the client emits no frame at all), and both boards keep the engine's default W5500 MAC (4E:55:30:31:02:01, from the engine's fixed Pico board id) — with an explicit per-board eth.begin(mac) the peer's ARP reply is never delivered (the peer never emits it) and connect() times out; engine-side, reported to the owner. Cell: pico2-eth-lan. |
| Pico 2 ETH (M33) HTTP client | FULL 2026-10-20 — Arduino HTTPClient GET via gateway NAT on the W5500 stack: ETH-BEGIN-OK, ETH-IP=192.168.4.4, ETH-GW=192.168.4.1, HTTP-CODE:200, HTTP-BODY:hello-openhw. Cell: pico2-eth-http-gateway. |
| Pico 2 ETH (M33) W6300 traffic | FULL 2026-10-20 — same `ethChip:'w6300'` attr on openhw-pico-2-eth (FQBN wiznet_6300_evb_pico2, RP2350/M33 arch): version=0x61, MAC RAW mode, ETH-BEGIN-OK, lease 192.168.4.4, HTTP 200 + body hello-openhw through the gateway NAT. Cell: pico-eth-w6300-gateway. |
| Pico USB device (CDC) | FULL 2026-10-20 (RP2040 + RP2350: host byte → CDC OUT → guest echo "USBCDC_ECHO:P"; the engine's host-sim enumerates arduino-pico's TinyUSB CDC to `active`; sink `openhw-usb-device` enumState=active rxCount — cells pico-usb). USB-HOST stays ABSENT: every engine USB model is device-only. |
| Pico RTC (rtc.c) | NONE (no cell — the engine models an RTC (`rtc.c`), but the RP2040 has **no RTC silicon** (RP2350 only stamps a timestamp), and no spec drives the engine's RTC, so there is nothing a guest could observe) |
| Pico SD/FATFS (sdcard.c, fatfs.c) | NONE (engine-side, MEASURED at runtime 2026-10-20 and RE-MEASURED 2026-10-22 (identical numbers, repo engine bytes, headless probe `patches/probe-pico-sd-cs.mjs`: `sdcard_load rc=0 bytes=4194304`, `SDPROBE:R0:FF`, `SDPROBE:R8:FF:FF:FF:FF`, `SDPROBE:R41:FF`, `SDPROBE:R58:FF:FF:FF:FF`, GP5 OUT-latch transitions LOW→HIGH→LOW→HIGH→LOW→HIGH, SPI0 CR0=1707 CR1=2 SR=3 CPSR=2 RIS=8, `mirror entries=60`, `CS events (0): (NONE)`) — the ARM path never reports CS assert/deassert to the SPI device — `spi_device_cs()` is called only from the RV32 path — so the SD model's `cs_active` stays 0 and `sdcard_spi_xfer()` returns 0xFF forever; the guest's 60 MOSI bytes DO go out (the engine's own SPI mirror saw them) but 0 CS events, and the raw-SPI bring-up read R0/R7/R1/OCR = 0xFF. Patch `patches/pico-sd-cs-watch.patch` delivered and verified: the same probe answers R0=0x01, R7=0x01 00 00 01 AA, R1=0x00, OCR=0xC0FF8000) |
|  ESP32 WiFi link | FULL 2026-10-15 — Arduino STA join + gateway DHCP (STATUS=3, scan + IP) via unified gateway :5030; the runner passes config.wifi + throttled stats telemetry. Cell: `esp32-wifi-gateway`. Root cause of the RED was a host-side SAB wedge (stats CMD unserviced mid-run), fixed inline in the vendor mirror (see session notes); the engine itself is exonerated. RE-VERIFIED 2026-11-03 (MAC attr 24:6F:28:00:00:31; gateway log shows DISCOVER/OFFER/REQUEST/ACK): the cell now also proves the **scan path** — `SCAN n=1` on a fresh STA, asserted before the join — then `STATUS=3` + `IP=192.168.4.3`. Still open: `scanNetworks()` called AFTER `WiFi.begin()` stalls the guest for minutes and then returns `-2` (3/3 on 2026-11-03), so the cell scans first; see the P6 ask in `vendor/emulator-hook-specs/esp32-emu.md`. |
| ESP32-CAM WiFi link | FULL 2026-10-20 — openhw-esp32-cam STA join + gateway DHCP (STATUS=3, IP=192.168.4.4) on the esp32-cam board preset (4MB flash + 4MB PSRAM, picked from the board type by esp32-runner.ts); engine dials :5030 at boot. Firmware target is the core's generic esp32:esp32:esp32 build (the frontend maps the cam shell to kind 'esp32'; no per-shell FQBN override). Cell: esp32-cam-wifi-gateway.  |
| ESP32-CAM LAN (2-board TCP) | PARTIAL 2026-10-20 — **FLAKY, not green**: 2 of 3 runs green (CSRV-RX:HELLO-LAN + CCLI-LAN-DONE) with the repo-committed ESP32 SAB bytes. Two boards in one gateway room, static 192.168.4.20/.21, TCP echo both directions observed when it works. Two failure signatures: (a) the client stops after CCLI-BEGUN (the 2nd board's host-side UART drain wedges — diagnosed in lane/esp32-cov: the SAB proxy busy-spins per CMD and the engine only services a fixed allow-list inline while RUN=1, so a CMD the runner polls wedges the board worker), (b) the SERVER never joins (CSRV-STATUS=3 missing) — see run 3 of the 2026-10-20 3× measurement. The per-board MAC attr (macAddress 24:6F:28:00:00:21/:22, new in esp32-runner.ts) is what makes the two boards distinguishable at all — without it the STA MAC is all zeros and the gateway's ARP reply never resolves. **Acceptance: 3 of 3 green runs.** Cell: `esp32-cam-lan` (needle `CCLI-LAN-DONE`). Diagnosis tooling: tests/e2e/esp32-cam-lan-diag.spec.js + patches/esp32-cov-diag-probe.patch. `[frontend] + [engine owner]` |
| ESP32-CAM HTTP client | FULL 2026-10-20 — Arduino HTTPClient GET via gateway NAT (10.150.211.85 -> host :8092): STATUS=3, IP=192.168.4.6, HTTP-CODE:200, HTTP-BODY:hello-openhw (same per-board MAC attr; the scan runs after the proof markers, off the proof path). Cell: esp32-cam-http-gateway. RE-VERIFIED 2026-11-03: STATUS=3, IP=192.168.4.4, HTTP-CODE:200, HTTP-BODY:hello-openhw with the host server on 127.0.0.1:8092 (`SCAN n=-2`, still failing, after the markers). |
| ESP32 multi-board boot | FULL 2026-10-20 — two ESP32 boards in ONE run now boot and run (before this, a 2-board ESP32 run produced NO serial at all). The engine's SAB CMD field holds ONE slot and run() is fire-and-forget, so in multi-board mode the lockstep tick's CMD flood (GPIO-change + 8x LEDC + TWAI/RMT/camera polls — 36.6k CMD exchanges measured in one 90s run) always overwrote the pending RUN and the guest never started. esp32-runner.ts now gates every CMD-posting poll on the core being provably alive and re-posts RUN every 250ms while it is idle (frontend-side fix, no engine change). |
| ESP32 BLE | ABSENT **on this board** (silicon: the classic ESP32 preset has no Bluetooth radio — only the ESP32-C/S/W do; the engine does carry a Bluetooth HCI model for those variants — `native_bt_hci_push_c2h` / `native_bt_hci_h2c_ptr`, `src/engines/esp32-emu/dist/sab/worker-entry.js:7820-7842,8437-8461` — but no cell drives it and the ESP32 board preset cannot use it) |
| ESP32 PCNT | FULL 2026-10-22 — the guest's PCNT unit 0 counts the firmware-driven pulses looped from GPIO12 to GPIO13 (cell `esp32-pcnt`, needle `PCNT_COUNT:` — the counter grows to >= 5). The counter is an ENGINE peripheral (native_pcnt_init/reset in the wasm, the PCNT matrix signals in worker-entry.js), so the host observes the engine's count, not a guest opinion |
| ESP32 SDMMC | NONE (no cell — the engine models SDMMC, but the board's SD path is SPI/SD-SPI (`esp32-sdspi`); nothing drives the SDMMC peripheral) |
| ESP32 ULP | NONE (no cell — the engine has a ULP coprocessor model, no spec drives it) |
| ESP32 FreeRTOS tasks | PARTIAL 2026-10-22 — the cell `esp32-freertos` proves a **second task really runs**: the guest's pinned task increments a counter and the main loop prints it (`RTOS_TASK:` — the count reaches >= 2). The missing observation is named: the only thing the host sees is the GUEST's own counter print — the engine exposes no host-visible task state, so this stays PARTIAL until a task tap exists |
| ESP32 speed (engine pacing) | MEASURED 2026-11-04 — compute-bound guest code runs at **~0.06× wall** natively (~18× slower than a real ESP32): a `volatile` 200k-increment loop reports 32.4M loops per GUEST second (silicon-plausible) but 1.85M per WALL second. Idle waits are fast-forwarded: `delay(2000)` is 330 ms wall at 160 MHz. The pace pill is an EMA of `sim.nanos`: 0.08 on the busy loop vs 2.3 during idle. Gotcha: a plain `total++` loop is folded by the optimizer (46× too fast); the cell uses a volatile counter. **Clock presets SHIPPED 2026-11-04** (160/80/40/20/8; board attr `tickMHz` → init `cpuFrequency`; patched wasm `f860d5a7`): CPU clock = cycles per guest second, APB 80 MHz and RTC 32.768 kHz absolute. Loops/guest-s 32.4M / 16.2M / 8.1M / 4.05M / 1.62M; `delay(2000)` 330 / 382 / 450 / 775 / 1061 ms wall; compute 0.057 / 0.211 / 0.497 / 0.960 / 2.42 guest-s per wall-s. Old blockers were not the model: the backend Intel HEX artifact was never parsed (all-0xFF flash → PC 0x4000fcac, zero serial) and the idle yield used a ~4 ms-clamped `setTimeout` (MessageChannel now). Engine patch uncommitted in the owner repo (baseline `c03f3927`). Cell: `esp32-speed`. |
| ESP32 eFuse | FULL 2026-10-22 — three ENGINE-side facts, delivered to the guest and read back by the host: the 240 MHz default CPU frequency (`ESP_CPU_MHZ:240`), two distinct nonzero words from the engine's RNG (`ESP_RNG:`) and a nonzero eFuse MAC (`ESP_MAC:`) — cell `esp32-sys` |
| ESP32 USB-CDC (usbcdc.rs) | ABSENT at board level (the classic ESP32 has no USB silicon; the model exists in the engine but no board preset exposes it, and no cell can exist on this board) |
| F1 USB-FS extra (usb.rs/otg.rs in engine) | FULL 2026-10-22 — the USB-FS **control plane** is proven on ALL SIX F1 boards (cell `stm32f1-usb`, needle `USB enum done` + the host sink `enumState=enumerated` / `rxCount=89 (the cell asserts rxCount >= 80)`; the guest also prints `USBRST` and `USB_HOST:PASS`). Bus reset + the device/config/lang descriptors + SET_ADDRESS + SET_CONFIGURATION, all host-observed. There is **no CDC/bulk data phase yet**, so the claim is control-plane only — that is why the board table says "no CDC data phase yet" |
| F4 DMA2D | NONE (lane/f4-cov2 2026-10-22 added no DMA2D cell: the engine's F429 DMA2D flag is true — `node_modules/stm32f4-emu/site/stm32f4.js:110` dma2d:true — but the gate is unused, and the new sys-block cell `stm32f4-sysblocks` covers CRC / WWDG / PWR / RCC / DBG only. The gap is the cell, and behind it an engine-side DMA2D model) |
| micro:bit NFC / USB | NFC **NONE** — the engine models NFCT (`nfct_take_tx`/`nfct_complete_rx`/`nfct_field_present`) and the runner pumps it (microbit-runner.ts:609-654), but the cell is **skipped** until the `nfct_nrf.bin` firmware image lands (microbit-nfc.spec.js:12 `test.describe.skip`); USB **ABSENT** (USBD is not pinned on the v2 board) |
| LittleFS/SPIFFS anywhere | NONE (the repo **ships** a littlefs wasm + the FS builders — `src/worker/fs/fs-builders.ts:28,82` — but **no cell** exercises a guest filesystem on any board; the closest proof is the ESP32 flash path (`esp32-nvs`: Preferences put/get + an Arduino EEPROM-on-flash byte roundtrip), which is a raw-flash path, not a POSIX FS) |


## Infra notes (2026-10-10/11)

- F4 pace breakthrough: LOAD-sized chunking (same instructions, more SysTick
  fires per tick) took Disco 45→288 guest-ms/s (6.4x), guardrails green.
  TickMHz divider — see the 2026-10-20 correction below (it is NOT inert;
  the old verdict came from the step-counted pace pill, which is
  divider-independent by construction).
- Engine adoptions: F1 bytes (130 MIPS showcase), F4 bytes (42 MIPS warmed) —
  both export-verified, guardrail-proven. ESP32 bytes refreshed (no speedup).
- ESP32 boot chain fixed (crypto stub, WASM handoff, TWAI wedge, seedMMU
  removal); OLED cell green centrally. TWAI-TX oracle + SD-SPI + sleep are
  engine-side NO-GOs.
- F1 DHT nan regression under active hunt (runner exonerated by A/B, engine
  bytes verified, firmware stable) — bluepill cell marked RED until green.
  RESOLVED 2026-10-20: the RED was the app running the STALE npm engine
  bytes (see below), not the engine; with the pinned owner bytes the cell
  is green 8/8 (BP), 8/8 (MP+CB via maple-cb-2) and 12/12 (gd32 wave2).
  The per-read nan intermittency itself is still there (~1 in 8 reads).
- F1 ENGINE BYTES re-pinned 2026-10-20 (single resolution point):
  the F1 runner resolves `stm32f1-emu` → the npm package, so dev AND the
  built app both ran the OLD npm build (glue 7387b216 / wasm ddfbc2a5 /
  facade 44845aa9 / emulator d2f7fcf3 — 132 wasm exports, pin events as
  triples), while public/vendor carried a THIRD byte set (glue 43c24f16 /
  wasm d1e69c28) that nothing ever loaded. The npm build is an older build
  of the same engine: no `instruction_count_now` / `i2c_clear_rx` /
  `tim_chan_pin` exports and no edge tcount → SoftSerial RX + I2C RTC RED.
  Fix: the owner's matched byte set is committed in src/engines/stm32f1-emu
  (glue 43c24f16 + wasm d1e69c28 + emulator 091a0746 + facade f2cff22c — one
  build, 135 exports) and vite.config.js aliases the npm-shaped specifiers
  onto it, so dev, the built bundle (hashed wasm asset) and the /vendor
  runtime fallback all load the SAME pair. An alias to the owner FOLDER is
  not deployable: the container build (deploy.yml → Dockerfile) checks out
  only this repo + openhw-studio-emulator, so an absolute owner path is a
  hard vite failure, and the owner rebuilds that folder every few minutes,
  so dev could never match a committed deploy snapshot.
- DEPLOY BUILD HAZARD — **RESOLVED 2026-10-20 (lane/engine-bytes)**. The
  hazard was real and it broke the build: `vite.config.js` aliased
  pico-emu + esp32-emu to absolute owner-folder paths, and the owner's
  `esp32 emu/dist/` was deleted mid-session, so `npm run build` failed with
  `[vite:worker-import-meta-url] Could not load …/esp32 emu/dist/sab/
  worker-proxy.js … ENOENT`. In CI/Docker the same aliases point at folders
  that do not exist at all → hard build failure, and the built Pico wasm
  asset carried an absolute owner path.
  Fix (the F1 pattern, applied to every engine): the bytes are now committed
  in this repo and the aliases point at them, so dev, `npm run build` and
  the runtime `/vendor/board-engines/…` fallback all read the SAME files:
  - `src/engines/pico-emu/` — glue `picoemu.wasm.js` (md5 c3b784f0) + wasm
    `picoemu.wasm.wasm` (md5 0c74dffe), a MATCHED pair, byte-equal to the
    owner's `rp2350/Pico-emu/web` build of 2026-10-08.
  - `src/engines/esp32-emu/dist/sab/` — `worker-proxy.js` (md5 3c5c1866) +
    `worker-entry.js` (md5 4afe24dd), byte-equal to the runtime-fallback
    mirror, i.e. the OpenHW-patched bytes (node:crypto MD5 stub, inline
    `CMD_GET_WIFI_STATS` + `CMD_GET_TWAI_TX` service while RUN=1).
  The owner folder stays reachable for engine development with
  `OPENHW_ENGINE_FROM=owner npm run dev` (never in CI). Proven after the
  change: `npm run build` green with no owner path in `dist/`, pico-usb
  (M0+ + M33) green, esp32-wifi-gateway green. Provenance + refresh recipe
  in `src/engines/*/README.md` (same shape as stm32f1-emu).
  The npm endgame stays a one-file flip: when the engines are published,
  the alias entries in `vite.config.js` are removed and the bare specifiers
  in the runners resolve to the packages.


- Pace pill now reports step-counted virtual time (was wall clock — always
  ~100%). Expect single digits on F4 at 1x; that is the truth.
- PROOF STANDARD (new): every board proves guest-time advance — pace specs
  assert monotonic millis + divider markers vs wall elapsed, alongside the
  serial needle. Speed is a main test now, not an observation.
- F4 tickMHz divider: the 2026-10-10 "PROVEN INERT" verdict was WRONG and
  is retracted 2026-10-20. It was taken from the step-counted pace pill
  (virt-ms/s), which is divider-independent BY CONSTRUCTION and therefore
  could not observe the effect. Measured A/B on the deployed engine bytes
  (wasm md5 9455e31c, glue md5 19a9630), same sketch (Disco + MAX7219),
  same box, back to back, guest-ms per WALL second:
    tickMHz:24 (div=7) -> 1267   |   default (div=1) -> 158      (8.0x)
  and in an earlier session with a lighter sketch: 469 vs 106 (4.4x) —
  the ratio moves with the host load, because a 7x-faster SysTick also
  means 7x more ISR entries and on a busy host the ISR storm eats part
  of the gain. So the divider really does speed the GUEST clock up
  ~4-8x (the guest SysTick LOAD is rewritten 168000 -> 24000). The e2e
  cell `stm32f4-clock` proves the divider is ARMED (the F4CLK:div=7 write
  receipt) and that the guest clock advances in exact delay(2000) quanta
  (measured: 50 of 50 sample pairs exactly +2000 guest-ms); it
  deliberately makes NO acceleration claim (one run cannot measure a
  ratio) and it asserts the guest advance in guest-time quanta, not in
  wall-dependent milliseconds — the old "max(millis) >= 8000" floor turned
  the cell into a host-speed test (on a slow host the guest clock only
  reached ~2300 guest-ms in 120 s and the cell failed although the clock
  was fine: it had advanced by exactly one delay quantum). F4 preset is
  attr-only (no menu); F1/Pico/ESP32 dividers share the design and are
  UNVERIFIED for effect — no acceleration claims until pace tables prove
  them (Pico set_clock and ESP32 nanos-scaler are engine-honored by code
  reading, still unproven live).
- ENGINE-BYTE INTEGRITY CHECK (new, 2026-10-20) — `npm run check:engine-bytes`
  re-measures the **Engine byte status** table above, READ ONLY, on demand:
  it hashes the repo-pinned bytes and the owner folder's bytes and prints
  `engine | pinned file (md5) | owner folder file (md5 | MISSING) | verdict`.
  Verdicts: SAME / DIFFERENT (the owner rebuilt — information) /
  MISMATCHED PAIR (a glue+wasm pair moved inconsistently — the dangerous
  one: it is what a bad hand-copy produces) / NOT BUILT (the owner folder
  has no build output) / MISSING + MIRROR DRIFT (the **repo** side is broken
  → non-zero exit) / OWNER ABSENT (no owner folder — normal on CI) /
  N/A (no owner: the pure-JS `avr8js` package, the repo-only Pico fork).
  It exits non-zero **only** when the repo side is broken, because the
  owner folders are moving targets and a DIFFERENT owner folder is
  information, not a failure. The tool is also a unit test
  (`tests/unit/worker/engine-bytes.test.mjs`): the repo side is intact, the
  CI degradation path exits 0, and the run is provably READ ONLY (the
  watched trees are byte-identical afterwards). The refresh protocol —
  refresh only from a **stable** owner build, always take glue + wasm +
  facade from **one** build, run the check before *and* after, re-run that
  engine's cells afterwards — is in `docs/engine-bytes.md` and next to the
  bytes in `src/engines/<engine>/README.md` (and
  `public/vendor/board-engines/<engine>/README.md`).
- GATEWAY DNS (2026-10-20) — the unified gateway advertises its own
  resolver (192.168.4.1) in the DHCP lease: `openhw-unified-gateway`
  **main** @ `3f8814b` "DHCP: advertise the gateway resolver (192.168.4.1)
  as the lease DNS server" (`dhcp.go` — 192.168.4.1 first, 8.8.8.8 kept as
  the secondary fallback). `git branch --contains 3f8814b` → `main`; the
  running binary carries the change (its DHCP log line is
  `Offering %s (dns %v)`). A guest therefore gets a working resolver
  **straight from the lease** — no `WiFi.setDNS()` needed — which is what
  the `pico-wifi-dns` lease case now asserts unconditionally (the old
  `test.skip(!process.env.DHCP_DNS, …)` opt-in is gone).

## Deliberately out of scope (engine-limited)

- **USB-HOST everywhere** — every engine's USB model is **device-only**:
  the micro:bit glue exposes no USB host peripheral, the Pico engine's USB
  model enumerates a device (CDC) and never enumerates a host, and the F1
  `usb.rs` model is a device stack. Declined, not deferred: no engine can
  express "the guest enumerates a peripheral".
- **DSI, SWD/JTAG/DFU/OTA** — no engine models a debug/boot **host**: the
  **Debug** column of the system table is FULL for STM32F4 (2026-10-22 — the
  guest-visible DBGMCU / ITM / DWT taps are proven by cell `stm32f4-sysblocks`)
  and PARTIAL for STM32F1 (the guest reads the per-chip DBGMCU IDCODE — cell
  `stm32f1-dbg` — but the host-side SWD surface is never called). No family
  has a SWD/DFU/OTA HOST, so an external flash programmer stays out of scope.
- **Native CAN-FD on F1/F4/ESP32** — classic-only silicon (bxCAN has no FD
  controller); the FD proof is the AVR's **external** MCP2518FD bridge
  (avr-mcp2518fd → `CANFD_LOOPBACK_OK`), which is why the AVR row says
  ABSENT for CAN-2.0 but FULL for CAN-FD.

## Next to prove (NONE cells worth a cell)

**Owner tags** (who has to act, so the queue is actionable):
`[frontend]` = a runner/harness/cell change we own ·
`[engine owner]` = a patch for the engine's own repo (deliver as a patch,
never an in-place edit in the read-only engine folders) ·
`[user decision]` = a product/scope call only the user can make.

Ordered by leverage — the top of the list is where the next hour should go.

1. **ESP32-CAM 2-board LAN** — the cell exists and passes 2 of 3 runs
   (FLAKY, **not** green). Two failure signatures: (a) the client stops
   after `CCLI-BEGUN` (the SAB proxy busy-spins per CMD while the engine
   only services a fixed allow-list inline during RUN=1, so a CMD the
   runner polls wedges the board worker); (b) the server never joins
   (`CSRV-STATUS=3` missing). Two fronts: (a) `[frontend]` stop calling
   CMDs the engine cannot service mid-run; (b) `[engine owner]` widen the
   inline allow-list (the `CMD_GET_WIFI_STATS` inline service is already
   in the committed bytes). Tooling: `tests/e2e/esp32-cam-lan-diag.spec.js`,
   `patches/esp32-cov-diag-probe.patch`. **Acceptance: 3 of 3 green runs.**
   `[frontend] + [engine owner]`
2. **Pico SD (the CS watch)** — the ARM path never reports CS to the SPI
   device, so the SD model stays inactive and every answer is 0xFF
   (measured at runtime: 60 MOSI bytes, 0 CS events). The patch
   `patches/pico-sd-cs-watch.patch` is delivered and verified in a patched
   build; it needs the owner to land it and rebuild glue+wasm as ONE pair.
   `[engine owner]`
3. **Pico RV32 GPIO-out + the RV32 SPI CS** — the SIO map patch is
   delivered and verified (`patches/pico-rp2350-sio-gpio-map.patch`) but
   not landed, and the RV32 SPI path additionally needs a CS watch
   (`spi_device_cs()` is called only from the ETH paths). Until both land,
   the RV32 row's GPIO / PWM / SPI columns stay NONE. `[engine owner]`
4. **Pico 1-Wire / DHT / IR** — the IN-latch inject is reachable from the
   frontend again, but the engine still exposes no one-wire/PIO observe
   tap, so the 1-Wire, IR and DHT columns on the ARM rows cannot be
   closed. `[engine owner]`
5. **AVR SoftSerial RX + USART RX (all four boards)** — the runner HAS a
   software-serial RX decoder but it samples the **TX** pin
   (`observeSoftSerialTx` → `state.lastLevel`, avr-runner.ts:907-911)
   while the RX line (`setSoftSerialRxLevel`, avr-runner.ts:863) is only
   driven HIGH once at init (avr-runner.ts:608); no AVR cell injects a
   byte into the USART RX either. Every AVR SoftSerial/UART RX cell stays
   PARTIAL until the decoder samples the RX pin. `[frontend]` (the
   sampling source) or `[engine owner]`
6. **F4 CRC on the F429** — the new sys-block cell runs CRC on 4 of the 5
   dice (F407 / F401 / F411 / F407VE); the F429 has `crc:true` in the
   engine CHIPS table but is not in the cell's CRC_TYPES list. One line to
   close. `[frontend]`
7. **F4 1-Wire / DHT22** — engine-side: `SysTick->VAL` is modelled as a
   latch toggle, not a down-counter, so the STM32duino `micros()` is
   1 ms-quantised and the 26 µs/70 µs slots are undecodable. Patch and
   write-up delivered (`patches/f4-systick-val-downcounter.patch`,
   `patches/README-f4-systick-val.md`); the cell stays RED until the
   owner rebuilds the wasm and the glue together. `[engine owner]`
8. **micro:bit I2S / NFC / NVS / TEMP** — four cells exist but are
   **skipped** (microbit-i2s.spec.js:10, microbit-nfc.spec.js:12,
   microbit-nvs.spec.js:8, microbit-temp.spec.js:14). Each needs a fixed
   `.bin` image (I2S, NFC) or a runner patch + image (NVS, TEMP) that
   nobody has produced yet. `[user decision]` (produce the images) +
   `[frontend]` (the runner patches).
9. **micro:bit BLE** — the engine has a full BLE model (`ble_adv_state`,
   `ble_smp_*`, `ble_lesc_*`) and the runner wires no BLE stack, so there
   is no cell and no path. A *cell + runner wiring* gap, not an engine
   gap. `[frontend]`
10. **Retro 8086 PIC / 8237 DMA** — the engine exposes `dma_status`
    (multi_cpu_emu.js:119) but no cell drives a transfer; the 8259 PIC's
    other IRQ lines are unproven too (the four timer-IRQ cells only cover
    IRQ0 / IM1 / VIA / Timer0). `[frontend]` for the cell, `[engine owner]`
    if the 8237 needs a new export.
11. **Retro bit-bang peripherals** — the 8086/8088/8085/8051/6502/Z80 rows
    are all NONE in the bit-bang column: the engine exposes
    `i2c_read`/`i2c_write` (:238/:247) and `spi_read`/`spi_write`
    (:704/:712) but no spec drives a bit-banged I2C/SPI/PWM/SD transaction
    on any of them. `[frontend]` (the cell) — the engine side looks present.
12. **Retro UART RX on the other ISAs** — the 8251 echo is proven on the
    8086 (`retro-rx-echo`) and the 8088 (`retro-8088-gpio`); the 8085 /
    8051 / 6502 / Z80 UART is TX-only (console). `[frontend]`
13. **AVR IR 38 kHz carrier** — all four boards decode a raw mark/space
    envelope looped back D3→D2 (1 ms bit). The carrier cannot survive
    emulation timing at a 26 µs half-period (avr-softproto.spec.js:9-12),
    so the IRremote path needs an engine-side carrier model.
    `[engine owner]`
14. **ESP32 DevKit SD-SPI + sleep** — engine-side NO-GOs: the card's
    answers do not reach the guest and the sleep path is not reachable.
    `[engine owner]`
15. **F4 SAI full-duplex** — the SAI column stays "data path only" until
    the model gains clocking. `[engine owner]`
16. **ATtiny85 native USI / ADC / INT0** — the ATtiny85 row is an
    honest-substitution row: the backend has no attiny toolchain, so every
    tiny firmware is Uno-compiled and runs the Uno-class models over the
    real P-net. Proving native silicon needs a tiny toolchain **and** the
    USI/ADC models wired. `[user decision]` (toolchain) + `[engine owner]`
    (USI wiring).
17. **Pico RV32 core** — the RV32 row runs a REAL arduino-pico RISC-V
    sketch (cell pico2-rv32-arduino → `RV32_UART:OK`), but the engine's
    rv32 core has **no GPIO model** (so its whole GPIO / bit-bang / ADC
    column is ABSENT) and no MicroPython path. A toolchain is a
    `[user decision]`; a GPIO model is an `[engine owner]` ask.
18. **ESP32 FreeRTOS host-side observation** — the cell proves a second
    task runs (the guest's `RTOS_TASK:` counter advances), but the only
    observation is the GUEST's own print; a host-visible task tap would be
    needed to make that column FULL. `[engine owner]` (or `[frontend]` if
    the runner can read a task state out of the engine).

**Closed since the previous sweep** (kept here so the queue is not
re-litigated): the Pico IN-latch inject (the frontend blocker is gone —
GPIO-in and EXTI are green on BOTH boards), the F1 USB-DEV control plane
(6/6 green, cell `stm32f1-usb`), the Mega / Nano / MapleMini sweeps
(`avr-mega-periph`, `avr-nano-periph`, `stm32f1-maple-cb` / `-2` are
green) and the F4 system blocks (CRC / RNG / CRYP / WWDG / PWR / Clocks /
Debug — cell `stm32f4-sysblocks`).

Engine-side asks that are NOT frontend work (deliver as patches, never
in-place edits in the read-only engine repos): F4 `SysTick->VAL`
down-counter (`patches/README-f4-systick-val.md`), pico IN-latch + SD CS +
the RV32 SIO map + the M33 SHA-256 CSR map + the M33 WDT ROM patch +
softAPConfig + the `live=0` DHCP stall, esp32 `scanNetworks()` hang +
`wifi-fix@a0684ef` merge, F4 `fault_pc` export. MicroPython on F4 needs an
upstream image + a runner REPL inject path (no frontend shortcut).
