# stm32f4-emu — hook spec (for emulator agent)

Our runner: `OpenHW-studio-frontend/src/worker/runners/stm32f4-runner.ts`.
Engine site: `public/vendor/board-engines/stm32f4-emu/site/{stm32f4.js,emulator.js}`.
Status: **wedged — needs core-side work**. Firmware faults/stops at the first I2C data write (`millis()` frozen after ~200, reboot loop, zero runner callbacks).

## What to add / fix

1. **Diagnose the first-write fault (P0)**. Evidence: frozen `millis()` ⇒ ~0 instructions retired per `step()` (a flag-spin would still advance SysTick). Suspects: `fault_pc` set (`emulator.js:1370-1371`) or the WFI branch (`:1325-1356`). Expose to JS: `stopped` flag + `fault_pc` (or equivalent) so our discriminator probe can read them.
2. **Broadcast I2C event queue (P0)**. Today `processOled()` (`emulator.js:498-500`, run at `:767`) drains the same `i2c_take_events(I2C1)` queue **before** `processI2cDevices()` (`:732-737`, `:778`) — with `ext.oled` on I2C1, per-address observer specs (`withAssets.i2c`) structurally starve even on a healthy bus. Fix: deliver each event to ALL consumers (broadcast), or give observers their own queue — never one drain starving another.
3. **Read-path parity with F1 (P1)**. `withAssets.i2c` specs accept `onStart/onWrite/onStop` but **no `onRead`**; `parseI2c` (`site/stm32f4.js:189-206`) never dispatches reads (only `pushRx`, which our runner never fills). Add `onRead` + RX-fill — MANDATORY, not optional: every I2C sensor in the registry (MPU6050, BMP180, ADXL345, DS1307 RTC, EEPROM, PCA9685) reads, so without this the whole future sensor shelf stays dark on F4.
4. Keep F1-style semantics where they exist: pre-`init_svd` address-keyed `i2c_register_slave` (`emulator.js:431-435`) is fine as long as (2) broadcasts.

## Constraints

- Additive-only; F4 Arduino serial/boot cells already pass — no behavior change when `withAssets.i2c` is absent.
- Runner `stepBudget` ignores the engine `stopped` flag today; after exposing it, keep stepping side-effect-free when stopped.

## Cross-cutting constraints (sync/SAB — engine side of the contract)

Engines never touch SharedArrayBuffer: each engine runs as a plain
synchronous step function inside its board Worker, and only our
`arm-runner-base.ts` touches SAB (pin bitfields, barrier cells, STEP
collect). Two things the engine must still guarantee so multi-board
lockstep holds:

1. **Reset clears everything, synchronously** — cores, peripherals, pending
   events, and any `stopped`/fault flags. A sticky flag desyncs one board's
   lane forever while the others advance. (Directly relevant to §1: the
   first-write fault flag must not survive `reset()`.)
2. **Expose a cycle/instruction counter per step** — feeds sim-time edge
   stamps (replacing the runner's wall-clock approximation) and the
   skew/pace accounting. One counter serves both.

## Further surface (same agent — full protocol audit 2026-10)

Already present in-engine, runner-unwired (our side, listed so nothing is missed):

5. **ADC**: `setAdcChannel/clearAdcChannel` (`emulator.js:705-706`) exists —
   our runner returns `NaN` (`stm32f4-runner.ts:387`). Engine task: keep +
   document it; wiring is ours.
6. **PWM/timer-out**: TIM-register buzzer model (`ext_devices.buzzer`,
   TIM3/TIM4) exists — generalize/document for servo/LED cells if cheap.
7. **SDIO blocks / camera frame / FSMC / QSPI** (`stm32f4.js:634-669`):
   present; no cells written yet — P2, keep stable, do not expand scope.
8. **SPI SD card** (`ext_devices.spi_sd`, engine 079e4f0): synchronous
   model-side protocol engine (CMD0/8/55/41/58/16/13/9/10/17/18/24/12,
   SDHC block addressing, Ncr=0). Runner attaches
   `spi_sd: [{peripheral:'SPI1', blocks:8, cs:'PA4'}]` when an
   `openhw-sd-card` is present and suppresses the JS-side MISO reply
   while the model owns the bus (bridge still feeds component
   telemetry). Firmware-side contract: sample R1 on the LAST command
   byte (Ncr=0 — the model answers immediately, not one byte later).

## HASH peripheral — silicon deviations found while proving the F4 HASH cell (2026-10-20, lane/net-pace)

The HASH peripheral IS modeled and computes **standard** digests: the e2e
cell `tests/e2e/stm32f4-sys.spec.js` ("HASH computes standard SHA-256 and
SHA-1 digests", F407/407VE/429) asserts SHA-256("") against the published
FIPS 180-4 vector, plus SHA-256("abcd") and SHA-1("abcd") against
`sha256sum` / `sha1sum`. Measured on the deployed bytes (glue md5
`19a9630`, wasm md5 `9455e31c`; the owner folder's wasm is a third, dirty
build — do not mix them).

What the cell needs from the engine (the deviations to fix):

1. **`HASH_CR.INIT` is modelled at bit 0; RM0090 puts it at bit 2.**
   Silicon firmware does `HASH_CR = HASH_CR | HASH_INIT` (0x4). The model
   only reacts to bit 0, so the message buffer is NOT cleared and the
   digest covers the concatenation of the old and the new message.
2. **`HASH_SR` writes SET `DINIS`/`DCIS`; on silicon they are rc_w1**
   (write 1 clears). Firmware that acknowledges a flag re-asserts it and
   can never leave the completion path.
3. **The SHA-256 digest is mirrored into `HR0..HR3` only**, so the main
   bank's `HR4` (`0x5006041C`) reads 0 instead of digest word 4 (silicon
   has HASH_HR0..HR4 there; the full 8 words live in the alias bank at
   `0x50060710..0x5006072C` = SVD base+0x310).
4. (drive-by) **The HASH completion interrupt is never raised**:
   `check_interrupt()` tests `sr & 0x08` (BUSY) and `cr & 0x20` (a
   `HASH_CR` bit that does not exist) instead of `HASH_IMR.DCIE` (bit 1)
   and `HASH_SR.DCIS`.

Patch (against `stm32-periph-wasm/src/peripherals/hash.rs`), repro steps
and the exact measured values: `patches/f4-hash-silicon-fixes.patch`,
`patches/f4-hash-completion-interrupt.patch`, `patches/README-f4-hash.md`
in this repo.

Also worth knowing (no change requested):

* Register map the cell uses: CR `0x50060400` (ALGO0 bit 7, ALGO1 bit 18),
  DIN `0x50060404` (the word is taken big-endian), STR `0x50060408`
  (DCAL bit 8, NBLW bits 0..4), SR `0x50060424` (DCIS bit 1),
  HR0..4 `0x5006040C..0x5006041C` (HR5/HR6 alias IMR/SR on silicon),
  HASH_HR0..7 `0x50060710..0x5006072C` (the full digest).
* ALGO: `00` SHA-1, `01` MD5, `10` SHA-256, `11` unimplemented.
* The model hashes the pushed bytes as a MESSAGE with standard padding
  (sha1/sha2 crates), so SHA-256("") is reached by pushing no data at all.

## IWDG timing model (2026-10-20, lane/net-pace) — no change requested, but the cell depends on it

`src/peripherals/iwdg.rs` counts **retired instructions**, not wall time:
`timeout = RLR * 128 * prescaler_div(PR)` with `RLR` truncated to 12 bits.
The maximal window (RLR=0xFFF, PR=0) is therefore 2,096,640 instructions
≈ **13 GUEST ms**, roughly 1000x shorter than real silicon's ~13 s at the
same RLR/PR (LSI 40 kHz). The e2e cell
(`tests/e2e/stm32f4-sys.spec.js`, "IWDG stays alive while it is petted" +
"IWDG fires after petting stops") is written against that model and
asserts in guest-time units, so it is host-throughput independent. If the
IWDG ever becomes wall/LSI-timed, the cell's delays have to grow with it.

## Acceptance (our e2e, in order)

1. Discriminator probe (to be written): OLED firmware through first-write window ⇒ `emu.oled.frame > 0` (`stm32f4.js:393-399`, incremented at `emulator.js:530`) AND firmware `millis()` delta ≈ 0 AND `stopped == true`/`fault_pc != 0xFFFFFFFF`. This conjunction = "bus transacted, core faulted".
2. Full cell: Disco F407 SSD1306 `vramFill > 0` via I2C1 (mirrors the green F1 cell).
