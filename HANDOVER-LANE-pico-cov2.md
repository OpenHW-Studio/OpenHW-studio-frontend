# HANDOVER — lane/pico-cov2 (Pico family coverage, crash-restart lane)

Branch: `lane/pico-cov2` (from `lane/engine-bytes`).
Worktree: `/home/danish1075/Documents/simulator/sim-pico-cov2`.
Dev server: `:5177` (`vite.agent.config.js`), gateway room `netpicocov2`.

---

## 1. Mission + status

Finish the IN-latch export ask, prove the SD CS gap at runtime, close what
is possible on the RV32 arch, deliver the remaining engine patch files, and
update the Pico rows of `matrix.md`.

**STATUS: the IN-latch blocker is GONE (frontend-side) and three engine
patches are delivered and VERIFIED in a patched engine build (built outside
the engine repo, in `/tmp`).**

| what | before | now |
|---|---|---|
| GPIO-in (M0+ + M33) | NONE (engine-side) | **FULL** — cells `pico-gpio-in` |
| EXTI (M0+ + M33) | NONE (engine-side) | **PARTIAL** (GPIO edge IRQ proven) — cell `pico-exti` |
| SD (M0+ + M33) | NONE (code-reading only) | **NONE, but now PROVEN AT RUNTIME** + patch delivered |
| RV32 UART | PARTIAL "fixed image only; Arduino RV32 blocked upstream" | **FULL** — cell `pico2-rv32-arduino` (the blocker was stale) |
| RV32 ADC | NONE | **PARTIAL** (the guest's analogRead tracks the injected code) |
| M33 SHA-256 | NONE (engine CSR map) | still NONE on the repo bytes; **patch delivered + verified** (FIPS digest) |
| 1-Wire / IR / I2S | NONE | still NONE (no cell written) |

## 2. Repro commands

```bash
cd /home/danish1075/Documents/simulator/sim-pico-cov2
export TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest
npx playwright test --config=playwright.agent.config.js \
    tests/e2e/pico-gpio-in.spec.js --workers=1 --reporter=line   # one file at a time
```

The dev server is started detached:
`(setsid nohup npx vite --config vite.agent.config.js --host 127.0.0.1 > /tmp/vite-picocov2.log 2>&1 &)`
(`/tmp/opencode/vite-picocov2-watchdog.sh` relaunches it — the shared box
kills it now and then).

## 3. Files created / changed in this lane

| path | what |
|---|---|
| `src/worker/runners/pico-runner.ts` | (1) `setGpioInput()` now reaches the **guest-visible IN latch**: the owner's `_picoemu_set_gpio_input` when the engine provides it, else the engine's devtools script path (`"0ms: gpio<n> <level>"` → `script_poll` → `gpio_set_input_pin`). (2) NEW `publishGpio()` override — board-to-board GPIO fan-out (the base has NO board→board propagation, so a GP12→GP13 loopback was electrically dead and no EXTI cell could exist). |
| `tests/e2e/pico-gpio-in.spec.js` | NEW — M0+ + M33 GPIO-in cells. |
| `tests/e2e/pico-exti.spec.js` | NEW — M0+ + M33 IO_BANK0 edge-ISR cells. |
| `tests/e2e/pico2-rv32-arduino.spec.js` | NEW — RV32 with a REAL arduino-pico RISC-V sketch (UART + ADC). |
| `patches/pico-in-latch-inject.patch` + `patches/README-pico-in-latch-inject.md` | the IN-latch export ask (highest leverage: one export unblocks GPIO-in / 1-Wire / IR / EXTI on BOTH boards). |
| `patches/pico-sd-cs-watch.patch` + `patches/README-pico-sd-cs-watch.md` | the SPI CS watch for the SD model. |
| `patches/pico-m33-sha256-csr-map.patch` + `patches/README-pico-m33-sha256-csr-map.md` | the M33 SHA-256 CSR bit map + the RP2350 atomic-alias collapse. |
| `patches/probe-pico-sd-cs.ino` + `patches/probe-pico-sd-cs.mjs` | the runtime SD probe (headless, boots the engine WASM directly). |
| `matrix.md` | ONLY the Pico rows + the Pico spec list + the Pico row of the system/crypto table + the Pico SD connectivity row. |

## 4. Cells — green / red + exact serial evidence

GREEN (live, this lane, `--workers=1`):

* **M0+ GPIO-in** — `tests/e2e/pico-gpio-in.spec.js`:
  `PICO_IN_LEVEL:0:1` (repeated). The guest reads GP13 = **0** (wired to
  GND) and GP14 = **1** (wired to 3V3). The LOW half is the discriminator:
  before the fix the IN latch idled HIGH, so the cell reads `1:1`.
* **M33 GPIO-in** — same file:
  `PICO2_IN_READY` then `PICO2_IN_LEVEL:1:1` (the first sample, before the
  host's injection lands) then `PICO2_IN_LEVEL:0:1` ×N.
* **M0+ EXTI** — `tests/e2e/pico-exti.spec.js`:
  `PICO_EXT_CNT:0,1,2,3,4,5,6,7,8,9` — the guest's own ISR counter, one
  count per RISING edge of the GP12→GP13 loopback.
* **M33 EXTI** — same file:
  `PICO2_EXT_CNT:0,1,2,…,20` — 20 edges counted.
* **RV32 UART + ADC** — `tests/e2e/pico2-rv32-arduino.spec.js`:
  `RV32_UART:OK` and `RV32_ADC:512:102` (a 50% pot on GP26 and a 10%-of-
  full-scale pot on GP27 → the 5:1 ratio is what the cell asserts).

RED / honest limitations:

* **M33 SHA-256** — still RED on the repo bytes (the cell
  `tests/e2e/pico2-periph.spec.js` SHA case): the guest prints
  `PICO2_SHA_READY`, `PICO2_SHA_STARTRC:0`, `PICO2_SHA_WRITTEN` and then
  **no digest** (`sha256_wait_valid_blocking()` never returns). The patch
  is delivered and verified (§5.3) — the cell goes green unchanged when the
  owner lands it.
* **RV32 GPIO-out** — engine-side: `digitalWrite(15,HIGH)` leaves the
  engine's OUT latch at 0 (the OE write lands, the OUT write does not), so
  the guest reads back 0 and no LED/ISR evidence is possible.
* **RV32 PWM** — engine-side: `analogWrite(16,192)` crashes the guest — the
  PC jumps into SRAM (`core0 PC=20000686`) and the guest stops printing.
* **RV32 DMA** — the arduino-pico RISC-V port has no DMA API
  (`dma_channel_transfer_size` does not exist for that core → the sketch
  does not compile), so the RV32 DMA column needs the engine's fixed image.
* **1-Wire / IR** — no cell written in this lane; the IN-latch route they
  needed now exists, so they are the cheapest next cells.
* **M33 WDT / WFI sleep / I2S** — unchanged from `HANDOVER-LANE-pico.md`
  (engine-side; the M33 WDT ROM-patch ask is still open — I did not deliver
  that patch).

## 5. Findings (root cause + evidence + owner ask)

### 5.1 The IN-latch export (HIGHEST LEVERAGE — one export, four columns, both boards)

* Engine: `src/picoemu_wasm.c:374` `picoemu_set_gpio()` → `gpio_set_pin()`
  (`src/gpio.c:676`) writes the **OUT latch** only; `gpio_get_pin()`
  (`src/gpio.c:~725`) returns the **IN latch** for an input pin; `gpio_reset()`
  sets `gpio_in = 0xFFFFFFFF` → every input idles HIGH.
* The right entry point exists and is not exported:
  `gpio_set_input_pin()` (`src/gpio.c:748`, `include/gpio.h:109`) — IN latch
  + edge detector + NVIC.
* **Ask** (patch `pico-in-latch-inject.patch`): export
  `_picoemu_set_gpio_input(pin,val)` → `gpio_set_input_pin()`, plus
  `_picoemu_inject_gpio_level(pin,val)` → `gpio_inject_level()` (silent
  level force for open-drain slaves).
* **Acceptance** (measured in a patched build):
  `after _picoemu_set_gpio_input(7,0): level=0 serial="INLATCH:0"`,
  `after _picoemu_set_gpio_input(7,1): level=1 serial="INLATCH:1"`.
* **Meanwhile the frontend is NOT blocked**: the runner reaches the same C
  function through the engine's devtools script path
  (`_picoemu_script_load` → `script_init`/`script_poll` →
  `gpio_set_input_pin`, `src/devtools.c:632-699`). Measured headlessly:
  script `0ms: gpio7 0` → the guest-visible GP7 = 0. That is why the
  GPIO-in and EXTI cells are green today.
  *Caveat for the owner*: `script_init()` re-`calloc`s the event table on
  every load and never frees the old one (`src/devtools.c:632-640`) → ~18 kB
  leaked per level change. A 1-Wire/DHT bit stream would leak fast, so the
  direct export matters.

### 5.2 The ARM path never reports SPI CS (SD) — PROVEN AT RUNTIME

* `src/sdcard.c:379` — `sdcard_spi_xfer()` returns 0xFF unless
  `sd->cs_active`; `src/sdcard.c:476` `sdcard_spi_cs()` is the only writer.
* `src/spi.c:117` `spi_device_cs()` is the only path to it — and
  **`src/rp2350_rv/rv_membus.c:451` is the ONLY caller in the tree** (the
  RV32 path). The ARM path (M0+/M33) never reports CS.
* **Measured** (headless, repo engine bytes, `patches/probe-pico-sd-cs.mjs`):
  ```
  sdcard_load rc=0 bytes=4194304
  SDPROBE:R0:FF  SDPROBE:R8:FF:FF:FF:FF  SDPROBE:R41:FF  SDPROBE:R58:FF:FF:FF:FF
  GP5 (guest CS pin) OUT-latch transitions: LOW -> HIGH -> LOW -> HIGH -> LOW -> HIGH
  SPI0 CR0=1707 CR1=0 SR=3 CPSR=2 RIS=8      <- the SPI peripheral itself is alive
  mirror entries=60                          <- 60 MOSI bytes went out
  CS events (0): (NONE)                      <- but the device never saw a CS edge
  ```
  The guest's CS pin DOES toggle on the pad; the engine simply never tells
  the SPI device → the card answers 0xFF forever.
* **Ask** (patch `pico-sd-cs-watch.patch`): a CS watch in `src/gpio.c`
  (`gpio_set_cs_watch(pin, spi_num)`) that mirrors the pad level into
  `spi_device_cs()` from the SIO write path (`gpio_write32`), the PIO path
  (`gpio_set_pin`) and the direction change (`gpio_set_direction`); the host
  tells the engine the CS line with the new export
  `_picoemu_sdcard_cs_pin(pin)`.
* **Acceptance** (measured in a patched build): the same probe reads
  `SDPROBE:R0:1`, `SDPROBE:R8:1:0:0:1` (+AA), `SDPROBE:R41:0`,
  `SDPROBE:R58:0:C0:FF:80` (+00).

### 5.3 M33 SHA-256 — TWO defects, not one

* **(a) The CSR bit map contradicted silicon.** Engine
  `include/devtools.h:539-542`: `WDATA_RDY=bit0 / SUM_VLD=bit1 / START=bit31`.
  RP2350 silicon (pico-sdk
  `src/rp2350/hardware_regs/include/hardware/regs/sha256.h`): `START=bit0 /
  WDATA_RDY=bit1 / SUM_VLD=bit2 / ERR=bit4 / BSWAP=bit12`. The SDK's
  `sha256_wait_valid_blocking()` polls SUM_VLD (bit 2) → never returns.
* **(b) The RP2350 atomic aliases were collapsed.** `src/membus.c:1515`
  called `sha256_write(addr & 0xFFF, val)` — the alias bits are gone. The
  SDK's `hw_set_bits()`/`hw_clear_bits()` (pico-sdk
  `hardware/address_mapped.h:135-147`) write the **mask** to the alias
  register (`+0x1000` XOR, `+0x2000` SET, `+0x3000` CLEAR —
  `hardware/regs/addressmap.h:19-21`). Measured engine trace of the guest's
  three CSR writes:
  ```
  [SHACSR] val=00000010 -> (clear ERR)  -> the engine set the CSR to 0x10
  [SHACSR] val=00001000 -> (set BSWAP)  -> the engine set the CSR to 0x1000
  [SHACSR] val=00000001 -> (set START)  -> the engine set the CSR to 0x01
  ```
  → every other bit was destroyed, so BSWAP was lost and the digest came
  out byte-swapped even once the hang was fixed.
* **(c) BSWAP was never honoured** (`sha256_bswap` was a constant 1 in
  `src/devtools.c`).
* **Ask** (patch `pico-m33-sha256-csr-map.patch`): the silicon bit map +
  alias-aware `sha256_write()` + BSWAP honoured + `sha256_init()` keeps
  BSWAP across a START.
* **Acceptance** (measured in a patched build, the canonical SDK flow
  `pico_sha256_start_blocking(SHA256_BIG_ENDIAN)` → `update_blocking("abc")`
  → `finish()`):
  `PICO2_SHA_DIGEST:BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD`
  = FIPS 180-4 SHA-256("abc"), byte-exact. On the repo bytes the same
  firmware prints `PICO2_SHA_STARTRC:0` / `PICO2_SHA_WRITTEN` and NO digest.

### 5.4 The "Arduino RV32 blocked upstream" claim was STALE

* The arduino-pico core 6.0.0 ships the RISC-V arch menu for rpipico2
  (`rp2040:rp2040:rpipico2:arch=riscv`, toolchain `pqt-gcc-riscv`), the
  backend compiles it (POST /api/compile → HTTP 200 + a UF2 with the
  `rp2350-riscv` family 0xe48bff5a), and the engine boots it on the
  Hazard3 arch. The frontend already had the mapping
  (`simulatorConstants.js:50` `pico_2_rv32`, selected by the board attr
  `arch:'rv32'`).
* So RV32 UART is FULL (real Arduino firmware, not a fixed image).

### 5.5 The board-to-board GPIO gap (frontend-side, fixed here)

The base runner (`arm-runner-base.ts`) has NO board→board propagation:
`publishGpio()` only fans a driven level out to **component** pins. A wire
between two pins of the same board (the classic GP12→GP13 loopback an EXTI
cell needs) was therefore electrically dead. The ESP32 runner already had
this override (`esp32-runner.ts:935`); the Pico runner now has the same
one (`pico-runner.ts` `publishGpio` override).

## 6. What is left + hard rules for the successor

TODO (priority order):

1. **1-Wire / DHT22 cell** — the IN-latch route now exists, so the DHT22
   model (`_driveBoardPin` → `setGpioInput`) should now reach the guest.
   Write `tests/e2e/pico-dht22.spec.js` (M0+ + M33) and close the
   1-Wire column. Watch the script-path leak (§5.1).
2. **IR cell** — same route (the IR receiver model drives the board pin).
3. **M33 WDT patch** — `picoemu_watchdog_reboot()` →
   `reset_runtime_peripherals()` → `rom_init()` restores the RP2040-format
   ROM without re-applying `rom_patch_rp2350_arm()`. Small patch, not
   delivered here.
4. **RV32 GPIO-out / PWM** — engine asks (the OUT write never lands; the
   PWM write crashes the guest). Both need engine work.
5. **W6300 board shell** — the coverage is already FULL through the
   `ethChip:'w6300'` attr on the existing ETH shells (cell
   `pico-eth-w6300-gateway`), but a dedicated `openhw-pico-w6300` shell
   would need a board icon/SVG → **UI, another agent's territory** →
   reported, not done.

HARD RULES (unchanged): never edit ANY file while a cell runs (vite
full-reload kills the page); `--workers=1`; one spec file at a time; kill
leftover browsers with `pgrep -x chrome` (never `pkill -f`); check
`free -h` between runs (the box dies under ~2 GiB available); re-run a
failing cell once serially before calling it red; never touch the main
worktree or another `sim-*` lane; never push `md`; the engine folders are
READ-ONLY (deliver patches, never edit in place — verification builds live
in `/tmp/opencode/picobuild`, a COPY); `npm run build` must stay green and
`public/version.json` noise must be reverted after every build.

## 7. Engine-folder observations (observation only — never edited)

Owner folder: `/home/danish1075/Documents/rp2350/Pico-emu`
(`git log -1` = `b83786f "M33 MP + RV32 silence fixes, DSP family, PIO taps,
docs refresh (507/507, sweep 71/71)"`).

| file | md5 | note |
|---|---|---|
| `web/picoemu.wasm.wasm` | `0c74dffe5f5458a9062e4f7a13197781` | byte-identical to the repo-committed engine bytes (`src/engines/pico-emu/`) — the owner's rebuild had NOT produced new bytes yet |
| `web/picoemu.wasm.js` | `c3b784f0a59b151bc698329300a0611e` | same |

Verification build (mine, in `/tmp/opencode/picobuild`, never in the engine
repo): `web/picoemu.wasm.wasm` md5 `650e366e5cc3ae4ea235b58233cb0b7a` with
all three patches applied (IN-latch + SD CS + SHA-256 map). NOT committed —
the repo keeps the owner's bytes.

## 8. Pointers

* Previous lane: `HANDOVER-LANE-pico.md` (same directory).
* Engine contract: `vendor/emulator-hook-specs/pico-emu.md`.
* Engine bytes provenance: `src/engines/pico-emu/README.md`.
