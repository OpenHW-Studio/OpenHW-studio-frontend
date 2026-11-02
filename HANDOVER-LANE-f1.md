# HANDOVER — STM32F1 coverage lane (`lane/f1-cov2`)

**Mission:** close the remaining STM32F1 (Blue Pill / F103 / GD32) protocol
columns in `matrix.md` with REAL live e2e cells, or an evidenced reason why
a cell stays open.
**Status:** SPI, USB-DEV, DMA (bluepill), CRC, Watchdog (IWDG), EXTI, PWR
(PVD), Backup (BKP), Clocks and Debug-identity are now cell-backed.
SD-SPI stays PARTIAL (engine-side). MicroPython stays NONE (no image).
**Engine bytes:** every cell in this lane ran against the **repo-pinned**
pair `src/engines/stm32f1-emu/pkg/` (glue `43c24f16` + wasm `d1e69c28`,
facade `091a0746` / `f2cff22c`) — the self-consistent, cell-green set.

---

## 1. What closed (with the serial needle that proves it)

| Column | Value | Cell | Proof (serial needle / observed bytes) |
|---|---|---|---|
| SPI (6 boards) | FULL | `tests/e2e/stm32f1-spi-miso.spec.js` (7/7) | `JEDEC:C84016` + `DATA:A5` (6/6 boards) and `VER:92` (MFRC522 VersionReg, bluepill) |
| USB-DEV (6 boards) | FULL (control plane) | `tests/e2e/stm32f1-usb.spec.js` (1/1) | `USBRST`, `USB enum done`, `USB_HOST:PASS`, liveOop `enumState=enumerated rxCount=89` |
| DMA (bluepill) | FULL | `tests/e2e/stm32f1-dma.spec.js` (3/3) | `BPDMA_OK`, `BPDMA_SUM:65656`, `BPDMA_BAD:0` |
| CRC | FULL | `tests/e2e/stm32f1-crc.spec.js` (3/3) | `F1CRC_HEX:FB5C7298` (the silicon CRC value) |
| Watchdog (IWDG) | PARTIAL (IWDG FULL, WWDG open) | `tests/e2e/stm32f1-sys.spec.js` (9/9) | `BPWDG_ARMED` then the engine's `F1WDOG_RST:1` (the core was stopped and the runner rebooted it) |
| EXTI | FULL | `tests/e2e/stm32f1-sys.spec.js` (9/9) | `EXTI_TRIG` → `EXTI_FIRED` (the ISR ran) |
| PWR / Sleep | PARTIAL (PVD FULL, SLEEP/STOP open) | `tests/e2e/stm32f1-pwr-clk.spec.js` (3/3) | `CR:10` + `CSR:C` / `PVDO:1` at a 2000 mV modeled supply, `CSR:8` / `PVDO:0` at the 3300 mV default |
| Backup / NVS | FULL (BKP) | `tests/e2e/stm32f1-sys.spec.js` (9/9) | `BKP_HEX:CAFE` (the magic survives) |
| Clocks | FULL | `tests/e2e/stm32f1-pwr-clk.spec.js` (3/3) | `F1RCC_HZ:32000000` and `F1RCC_HZ:72000000` (the engine's decode of the guest's CFGR writes) + `CFGR32:9000A` (`SWS32:2` — the engine's SW→SWS mirror) + millis 300→2300 (one exact delay(2000) quantum) |
| Debug identity | PARTIAL | `tests/e2e/stm32f1-dbg.spec.js` (2/2) | `IDCODE:10016410` (F103) / `IDCODE:2BA01477` (GD32) — the engine's per-chip values |
| SD-SPI | PARTIAL (engine-side) | — | see §3 |
| MicroPython | NONE (no image) | — | see §4 |

Regression-checked after the runner change: `stm32-spi.spec.js` (MAX7219)
and `stm32-595.spec.js` still pass (2/2).

## 2. The MISO root cause (the big one) — what the engine does and what the runner must do

**Root cause.** The F1 engine's SPI peripheral only consults the MISO
injection queue when an ext device is attached to the bus. Its DR-write
handler reads the injected byte INSIDE the `if let Some(ref d) = device`
branch and falls back to a hard `0xFF` with no device
(engine `src/peripherals/spi.rs`, the `0x000C` write arm). The F1 runner
attached only I2C devices (`i2c_oled` / `i2c_eeprom`), so **every SPI read
on the F1 clocked in 0xFF** — that was the "MISO-read gap" in the matrix.

**Engine-level proof** (repo bytes, not the owner's live folder):
`scripts/f1-spi-miso-engine-probe.mjs`

```
[no-device]  injected MISO 0x42 on channel 1
[no-device]  rx after 2nd DR write (0x42 injected before it): 0xff   <-- IGNORED
[with-device] rx after 2nd DR write (0x42 injected before it): 0x42  <-- DELIVERED
[jedec] rx bytes: 0xc8 0x40 0x16 0x00                              <-- native device MISO
```

**Fix (runner side, `src/worker/runners/stm32f1-runner.ts`):** attach the
engine's own SPI NOR-flash model to SPI1:

* board attr `spiFlash: '0xC84016'` → attach it explicitly (JEDEC + 4 KB
  of `0xA5` content, CS = `PA4`);
* or automatically when the circuit has a JS SPI slave (any component with
  `onSPIByte` / `onSPIByteExchange`).

The engine's flash model answers **in-clock** (JEDEC `0x9F` → `C8 40 16`,
data `0x03` → the content byte on the clock after the 24-bit address), and
its presence also re-enables the injection queue for the JS slave models.

**Known transport artifact (documented, not hidden):** the JS slave models
are answered by the runner's SPI bridge, which injects the model's byte
AFTER the transfer event — so a JS slave's answer reaches the guest one
transfer late. The MFRC522 cell compensates with one priming transfer and
then asserts the exact silicon value (`VER:92`); the MFRC522 holds the
register value on every data clock, so the value is identical to silicon.
A second artifact: an attached engine device idles at `0x00` on MISO, not
the silicon `0xFF` (the engine's device `read()` returns 0 when it has no
reply — `ext_devices/spi_flash.rs:165` `unwrap_or_default()`; the LCD /
touchscreen / usart_probe devices do the same). This breaks drivers whose
"wait until != 0xFF" idiom is the SD protocol's (see §3).

**Other runner changes in this lane (all F1-only):**
1. the SPI bus anchor above;
2. `F1RCC_HZ` is now reported **on change** instead of once, so a guest
   that reconfigures the clock tree is observable from the host;
3. board attr `supplyMv` → the engine's modeled supply
   (`pwrSetSupplyMv`), so the guest can observe the PVD level;
4. `3V3`/`3.3V` were added to the 3.3 V rail spec — a component with a
   `3V3` pin (the MFRC522) is now powered instead of sitting at 0 V.

## 3. Cells that stay open (and why)

* **SD-SPI — PARTIAL (engine-side).** The SD card in SPI mode answers on
  the F1 (the values `0x01` / `01 00 00 01 AA` / `00 C0 FF 80 00` were
  observed by the guest) but the answers land **one command late**, so no
  SD driver can be written and the CMD17 block data is not byte
  comparable. Cause: the F1 engine has **no SPI-mode SD device** —
  `ext_devices.sd_card` is the SDIO *backing store*, and the engine binds
  only `spi_flash` / `lcd` / `touchscreen` / `usart_probe` to the SPI bus
  (engine `src/ext_devices/mod.rs:50-89`). So the card answers through the
  runner's JS bridge, whose MISO is injected at the engine drain
  (`stm32f1-runner.ts`, the `onTransfer` arm) and lands a command late.
  The F4 does not have this problem: its engine owns
  `ext_devices.spi_sd` and the runner attaches it and suppresses the JS
  reply (`src/worker/runners/stm32f4-runner.ts:262-266`).
  **OWNER ASK:** port the F4 engine's SPI-mode SD device to the F1 engine
  (or give the F1 SPI an in-transfer `respond` hook like the F4's
  `onByte(ch, byte, respond)`).
  The red cell was removed from `tests/e2e/` (it would break CI); the
  recipe and the observed bytes are in §1/§3 of this file.
* **PWR SLEEP/STOP — PARTIAL (engine-side).** The engine's WFI only parks
  the core when `deliver_irqs` is on, and the product path leaves it off
  (engine `src/cpu/mod.rs:122` `deliver_irqs: false`;
  `src/cpu/thumb.rs:2136-2148` "without delivery this is a plain nop
  (polling path)"), so the power-mode mirror (`pwr_mode()`) stays RUN and
  a guest `WFI` returns immediately (measured: the guest's post-WFI print
  always appears). The PWR *register* block and the PVD path are proven.
* **Watchdog — WWDG open.** `iwdg.rs` is proven end to end; the engine's
  `wwdg.rs` has no cell (the WWDG has a windowed counter, not the IWDG's
  free-running one).
* **Debug (host surface) — open.** The engine models SWD
  (`src/peripherals/swd.rs`: DP/AP access, halt/resume/step, watchpoints)
  and the bootloader (`src/peripherals/bootloader.rs`), but the F1 runner
  never calls any `swd_*` / `bootloader_*` export, so there is **no
  host-visible debug surface** (no such call anywhere in
  `src/worker/runners/stm32f1-runner.ts`). The guest-visible debug
  *identity* is proven (`stm32f1-dbg`).
* **MicroPython — NONE (no image).** `public/firmware/` ships micropython
  only for esp32 / rp2040 / rp2350 / microbit; the F1 board families
  register `firmware: ['arduino-sketch']` only
  (`src/worker/boards-registry.ts:169, 179, 189, 199`) and the F1 runner
  has no REPL-inject path (compare `esp32-runner.ts:34`).

## 4. Engine-folder observations (observation only — nothing touched)

`/home/danish1075/Documents/stm32 emu blue pill/pkg/` (the owner's live
folder, being rebuilt while this lane ran):

| file | md5 (owner folder) | md5 (repo-pinned) |
|---|---|---|
| `stm32_bluepill_wasm.js` (glue) | `43c24f1611785283ee60c220e1a20b3a` | same |
| `stm32_bluepill_wasm_bg.wasm` | **`641abe52933b9cdab8b5ecdbaef08f79`** | `d1e69c2892c10425ddcaad02236d45f2` |
| `emulator.js` | `091a074694506948211ac1f80542fb18` | same |
| `stm32f1.js` | `f2cff22cba7e34e5fb6e5e574219c485` | same |

The owner folder therefore holds the **mismatched pair** (new wasm
`641abe52` with the old glue `43c24f16`). All cells in this lane ran
against the **repo-pinned** pair (glue `43c24f16` + wasm `d1e69c28`).
The file:line citations above point at the owner's current Rust source
(read-only observation); the committed wasm is one build older.

## 5. Hard rules for the successor

1. **One cell file at a time**, `--workers=1`; kill leftovers with
   `pgrep -x chrome` (never `pkill -f`).
2. **Never edit a file while a cell runs** (vite full-reloads the page →
   "execution context was destroyed").
3. Own dev server: `cp vite.config.js vite.agent.config.js` (port 5174,
   `strictPort`, `cacheDir: '.vite-cache-f1cov2'` — the default
   `node_modules/.vite` is shared with :5173 and a foreign re-optimize
   kills the cell) and `cp playwright.config.js playwright.agent.config.js`
   (baseURL `http://localhost:5174`, `webServer: undefined`).
4. `export TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest`.
5. Keep `.tmp-vitest/`, `playwright-report/`, `test-results/`,
   `.vite-cache-*` and `*agent.config.js` out of commits; revert
   `public/version.json` after every build.
6. Engine bytes: use the repo-pinned pair; never copy bytes out of the
   owner's live folder; never edit/build/checkout there.
7. Commit on `lane/f1-cov2` only. Never push, never merge into `md`.

## 6. Files changed in this lane

```
M src/worker/runners/stm32f1-runner.ts   (SPI anchor, F1RCC_HZ on change,
                                          supplyMv attr, 3V3 rail)
M matrix.md                               (F1 rows + system row + specs)
M .gitignore                              (.vite-cache-f1cov2/)
A tests/e2e/stm32f1-spi-miso.spec.js      (7/7)
A tests/e2e/stm32f1-pwr-clk.spec.js       (3/3)
A tests/e2e/stm32f1-dbg.spec.js           (2/2)
A scripts/f1-spi-miso-engine-probe.mjs    (engine-level root-cause probe)
A scripts/f1-matrix-patch.py              (the matrix patch, re-runnable)
A scripts/warm-f1cov2.mjs                 (dep-optimizer warm-up: boot the
                                          page + a real circuit until vite
                                          stops re-optimizing — the first
                                          run after a cache wipe otherwise
                                          dies with "execution context was
                                          destroyed")
```
