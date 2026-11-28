# HANDOVER — lane/pico-cov2 (Pico family coverage, restart #13)

Branch: `lane/pico-cov2`
Worktree: `/home/danish1075/Documents/simulator/sim-pico-cov2`
Dev server: `:5177` (`vite.agent.config.js`), gateway room `netpicocov2`.

This session = **verification + proof** of the work the previous lane of
this branch BUILT but did not PROVE, plus one new engine patch that was
found, built and verified here.

---

## 1. STATUS

| what | state on `7be0d334` | state now (this session) |
|---|---|---|
| `pico-gpio-in` cell | committed, unproven | **GREEN, re-run here** (2/2) |
| `pico-exti` cell | committed, unproven | **GREEN, re-run here** (2/2) |
| `pico2-rv32-arduino` cell | committed, unproven | **GREEN, re-run here** (1/1) — plus the RV32 evidence re-measured headlessly |
| 4 patch files | delivered | **all 5 apply cleanly** to the CURRENT owner tree (`git apply --check`, individually AND combined) |
| SD CS runtime proof | claimed | **DONE, re-measured**: NONE (engine-side) with the exact bytes |
| M33 SHA-256 runtime proof | claimed | **DONE, re-measured**: NO DIGEST (engine-side) |
| Pico 2 RV32 | "PARTIAL, Arduino blocked upstream" | the toolchain is **NOT** blocked; the RV32 GPIO-out is **dead** (engine-side, new root cause) → **new patch, built + verified** |
| Pico W6300 shells | missing | **REPORTED** (needs the emulator package's component + SVG → UI, another agent) |

## 2. Repro commands

```bash
cd /home/danish1075/Documents/simulator/sim-pico-cov2
export TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest
/tmp/lane-run.sh 5177 tests/e2e/pico-gpio-in.spec.js     # one file at a time
```

The shared `/tmp/e2e-slot.lock` was heavily contended during this session
(4 lanes queued, one held it for >1 h), so the browser re-runs were slow;
the headless probes below need no slot and were used to cross-check.

## 3. THE CELLS — verdict + serial evidence (all re-run here, `--workers=1`)

### 3.1 `tests/e2e/pico-gpio-in.spec.js` — **GREEN (2/2)**

| case | needle observed |
|---|---|
| RP2040 (M0+) | `PICO_IN_LEVEL:0:1` (repeated) |
| RP2350-M33 | `PICO2_IN_READY`, `PICO2_IN_LEVEL:1:1` (the first sample, before the host's injection lands), then `PICO2_IN_LEVEL:0:1` ×N |

The LOW half is the discriminator: the guest reads GP13 (GND-wired) = 0
and GP14 (3V3-wired) = 1. Before the IN-latch route the IN latch idled
HIGH, so the cell would read `1:1`.

### 3.2 `tests/e2e/pico-exti.spec.js` — **GREEN (2/2)**

| case | needle observed |
|---|---|
| RP2040 (M0+) | `PICO_EXT_CNT:0,1,2,…` — the guest's own ISR counter, one count per RISING edge of the GP12→GP13 loopback |
| RP2350-M33 | `PICO2_EXT_CNT:0,1,2,…,20` — 20 edges counted |

### 3.3 `tests/e2e/pico2-rv32-arduino.spec.js` — **GREEN (1/1)**

The guest's own bytes: `RV32_UART:OK` and `RV32_ADC:512:102` (a 50%
pot on GP26 and a 10%-of-full-scale pot on GP27 → the 5:1 ratio the cell
asserts). Cross-checked headlessly (§4.3): the same 512:102 with the same
ADC injection.

## 4. THE RUNTIME PROOFS (headless, repo engine bytes — no browser, no slot)

### 4.1 SD CS — **NONE (engine-side)**, measured 2026-10-22

`node patches/probe-pico-sd-cs.mjs` (MODE=sd) and `MODE=mirror`:

```
sdcard_load rc=0 bytes=4194304
sdcard_cs_pin export MISSING (unpatched engine)
SDPROBE:R0:FF
SDPROBE:R8:FF:FF:FF:FF
SDPROBE:R41:FF
SDPROBE:R58:FF:FF:FF:FF
GP5 (guest CS pin) OUT-latch transitions: LOW -> HIGH -> LOW -> HIGH -> LOW -> HIGH
SPI0 CR0=1707 CR1=2 SR=3 CPSR=2 RIS=8
mirror entries=60
MOSI bytes (60): ff×20 40 00 00 00 00 95 ff | 48 00 00 01 aa 87 ff ff ff ff | 77 00 00 00 00 ff | 69 40 00 00 00 ff | 7a 00 00 00 00 ff ff ff ff ff
CS events (0): (NONE)
```

Read: the guest's SPI bytes go out **perfectly** (CMD0/CMD8/CMD55/ACMD41/
CMD58 are all visible in the mirror) and the guest's CS pad really
toggles — but the engine's SPI **device** never sees a CS edge, so the
card answers 0xFF forever. Root cause + patch:
`patches/pico-sd-cs-watch.patch` (see its README).

### 4.2 M33 SHA-256 — **NO DIGEST (engine-side)**, measured 2026-10-22

`node patches/probe-pico2-sha256.mjs`:

```
PICO2_SHA_READY
PICO2_SHA_STARTRC:0
PICO2_SHA_WRITTEN
RESULT: NO DIGEST (sha256_wait_valid_blocking() never returned)
```

Patch: `patches/pico-m33-sha256-csr-map.patch` (CSR bit map vs silicon +
the collapsed RP2350 atomic aliases + BSWAP).

### 4.3 Pico 2 RV32 — the UART/ADC path is real, the **GPIO-out is dead**

`node patches/probe-pico2-rv32.mjs` (new probe, committed) — the same
firmware on all three arches:

| arch | `RVPROBE:OUT15` (guest readback of a pin it drives) | engine GPIO OUT latch | `RVPROBE:ADC` | SPI mirror |
|---|---|---|---|---|
| RP2040 (M0+) | **1** | 0x28000 (bit15=1) | — | 1 MOSI byte, 0 CS events |
| RP2350-M33 | 0 (the M33's IN latch does not mirror OUT) | 0x28000 (bit15=1) | — | 1 MOSI byte, 0 CS events |
| **RP2350-RV32** | **0** | **0x0 (bit15=0)** | **512:102** | 1 MOSI byte, 0 CS events |

The ADC numbers reproduce the e2e cell exactly (2048 → 512, 410 → 102:
the RV32 ADC path returns the 12-bit code >> 2, so the **ratio** holds
but the absolute code is 4× low).

**Root cause of the dead RV32 GPIO-out (NEW, this session):**
RP2350 **interleaves** the SIO GPIO registers (silicon
`OUT=0x10, HI_OUT=0x14, OUT_SET=0x18, HI_OUT_SET=0x1C, OUT_CLR=0x20,
HI_OUT_CLR=0x24, OUT_XOR=0x28, HI_OUT_XOR=0x2C, OE=0x30, HI_OE=0x34,
OE_SET=0x38, …`), while the engine implements the **RP2040** map for
both chips (`include/gpio.h:30-39`). The M33 escapes the bug because the
pico-sdk drives the **ARM GPIO coprocessor** on RP2350 (implemented in
`src/thumb32.c:1564`); the **RISC-V core has no coprocessor**
(pico-sdk `rp2_common/hardware_gpio/include/hardware/gpio_coproc.h:11-14`
→ `#error "GPIO coprocessor port is not available on RISC-V"`), so an RV32
guest falls back to the SIO registers and **every GPIO write lands on the
wrong register**: `gpio_put(HIGH)` (OUT_SET 0x18) executes OUT_CLR, and
`gpio_set_dir(OUTPUT)` (OE_SET 0x38) is dropped entirely.

→ **`patches/pico-rp2350-sio-gpio-map.patch`** (new): translate the
RP2350 SIO GPIO offset into the engine's internal RP2040 slot when
`membus_rp2350_mode` is set, and fix the RV32 ETH CSn/RSTn watch offsets
(`src/rp2350_rv/rv_membus.c`). **Built and VERIFIED** (see §5.3).

Consequence for the RV32 row: SPI/CS and SD stay NONE on the repo bytes
(the engine never reports CS to the SPI device on the RV32 —
`spi_device_cs()` is only called from the ETH paths,
`src/rp2350_rv/rv_membus.c:451/459/480/488`), but with the SIO-map patch
the guest can finally move a CS pin.

**The "Arduino RV32 blocked upstream" claim was stale** — the toolchain is
present and local:

```
$ arduino-cli core list | grep rp2040
rp2040:rp2040   6.0.0   6.1.0   Raspberry Pi Pico/RP2040/RP2350
$ arduino-cli board details -b rp2040:rp2040:rpipico2 | grep -i riscv
Option:  RISC-V   arch=riscv      (toolchain: rp2040:pqt-gcc-riscv 5.0.0-9576866)
$ arduino-cli compile --fqbn rp2040:rp2040:rpipico2:arch=riscv … → "Sketch uses 71704 bytes (1%)"
```

So the RV32 sketch compiles **locally**, not only through the backend.

## 5. THE PATCH FILES (5) — all apply cleanly to the CURRENT owner source

Checked against a **copy** of the owner tree outside the engine repo
(`/tmp/opencode/allcheck`, a copy of `/home/danish1075/Documents/rp2350/Pico-emu`
@ `b83786f` + the owner's working-tree changes):

| patch | `git apply --check` | write-up | acceptance test |
|---|---|---|---|
| `pico-in-latch-inject.patch` | **rc=0** | `README-pico-in-latch-inject.md` | `_picoemu_set_gpio_input(7,0)` → the guest's GP7 = 0 |
| `pico-sd-cs-watch.patch` | **rc=0** | `README-pico-sd-cs-watch.md` | the SD probe answers R0=0x01 instead of 0xFF |
| `pico-m33-sha256-csr-map.patch` | **rc=0** | `README-pico-m33-sha256-csr-map.md` | `PICO2_SHA_DIGEST:BA7816BF…015AD` (FIPS 180-4) |
| `pico-m33-wdt-rom-patch.patch` | **rc=0** | `README-pico-m33-wdt-rom-patch.md` | the M33 survives a watchdog reboot |
| `pico-rp2350-sio-gpio-map.patch` (NEW) | **rc=0** | `README-pico-rp2350-sio-gpio-map.md` | the RV32 guest's `digitalRead(15)` = **1** (was 0) |

All five **together**: `git apply --check` → **rc=0**.

### 5.3 The new patch, built and verified here

```bash
cp -a /home/danish1075/Documents/rp2350/Pico-emu /tmp/opencode/siocheck   # copy, never the repo
cd /tmp/opencode/siocheck && git apply …/pico-rp2350-sio-gpio-map.patch
export EMSDK=/home/danish1075/Documents/rp2350/emsdk   # pinned emsdk 6.0.9 == emsdk-version
./build_wasm.sh        # → BUILD_RC=0, wasm 10595ad87b7cc4c29097da3728f40aca
```

Same probe, same firmware, patched engine:

```
RV32  (patched):  RVPROBE:OUT15:1    GPIO OUT latch = 0x28000 (bit15 = 1)
M33   (patched):  RVPROBE:OUT15:0    GPIO OUT latch = 0x28000   (unchanged)
M0+   (patched):  RVPROBE:OUT15:1    GPIO OUT latch = 0x28000   (unchanged)
```

→ the RV32 can drive a pin HIGH; the M0+/M33 are byte-identical before
and after (the translation is gated on `membus_rp2350_mode`).

**The patched bytes are NOT committed** — the repo keeps the owner's bytes
(`src/engines/pico-emu/`, md5 `0c74dffe…` / `c3b784f0…`).

## 6. Pico W6300 board shells — REPORTED, not done

* The **coverage is already FULL** through the board attr `ethChip:'w6300'`
  on the existing ETH shells (`openhw-pico-eth` / `openhw-pico-2-eth`),
  cells `pico-eth-w6300-gateway` (M0+ + M33) — matrix row
  "Pico-ETH W6300 traffic" / "Pico 2 ETH (M33) W6300 traffic" = FULL.
* The FQBNs exist: `BOARD_FQBN.pico_w6300 = rp2040:rp2040:wiznet_6300_evb_pico`,
  `pico_w6300_2 = rp2040:rp2040:wiznet_6300_evb_pico2`
  (`src/pages/simulationpage/constants/simulatorConstants.js:61-62`).
* A **dedicated shell** (`openhw-pico-w6300`) would need a new component in
  the `@openhw/emulator` package (the board shells live there with their
  SVG) **plus** a palette entry, a description and an asset key
  (`staticContent.js` COMPONENT_DESCRIPTIONS + the board-asset map) →
  **UI/SVG → another agent's territory.** REPORTED, not taken over.

## 7. Cells that could NOT be closed (precise reasons)

| cell / column | value | why (file:line / measurement) |
|---|---|---|
| Pico 2 RV32 SPI | NONE (engine-side) | the SPI data path works (the mirror saw the MOSI byte) but `spi_device_cs()` is only called from the ETH paths (`src/rp2350_rv/rv_membus.c:451/459/480/488`) → a CS'd device never sees the chip-select; the guest could not even toggle CS before the SIO-map patch |
| Pico 2 RV32 GPIO-in | NONE (engine-side) | the RV32 GPIO-out is dead (RP2350 SIO map, §4.3) → the IN latch can never be driven by the guest; patch delivered + verified |
| Pico 2 RV32 SD | NONE (engine-side) | same CS problem as SPI |
| Pico 2 RV32 I2C | NONE | the RISC-V port compiles `Wire`, but the headless probe measured `RVPROBE:I2C:4` (`Wire.endTransmission()` = 4 = no ACK) — with no I2C device attached the column cannot be judged headlessly; it needs a device in the e2e harness |
| Pico 2 RV32 PWM | NONE (engine-side) | `analogWrite()` crashes the guest (PC jumps into SRAM 0x20000686) — unchanged by the SIO-map patch (that patch only moves the GPIO register map) |
| Pico 2 RV32 DMA | NONE | the arduino-pico RISC-V port has no DMA API (`dma_channel_transfer_size` does not exist for that core) → the sketch does not compile |
| Pico M0+/M33 1-Wire (DHT22) | NONE (no cell) | the IN-latch route the DHT22 model needs now exists; the cell still has to be written (the DHT bit timing is ~26 µs and the script-path inject granularity is ~8 µs — the direct export in `pico-in-latch-inject.patch` is the safe route) |
| Pico M0+/M33 IR | NONE (no cell) | same route as above |
| Pico M0+/M33 I2S | NONE (engine-side) | no I2S peripheral in the engine and the PIO path has no observe tap |
| Pico M0+/M33 SD | NONE (engine-side) | proven at runtime (§4.1); patch delivered |
| M33 SHA-256 | NONE (engine-side) | proven at runtime (§4.2); patch delivered |
| M33 WDT | NONE (engine-side) | `reset_runtime_peripherals()` restores the RP2040-format ROM without re-applying `rom_patch_rp2350_arm()`; patch `pico-m33-wdt-rom-patch.patch` delivered (not built here — the WDT ROM patch was already verified by the previous lane in a patched build) |

## 8. TODO (priority order) for the next Pico lane

1. **Re-run the three cells** whenever the shared slot frees (they are
   green here; a re-run only guards against a regression).
2. **1-Wire / DHT22 cell** (M0+ + M33) — the IN-latch route now exists;
   prefer the direct `_picoemu_set_gpio_input` export (the devtools script
   path leaks ~18 kB per level change — `src/devtools.c:632-640` — and a
   40-bit DHT stream would leak fast).
3. **IR cell** (M0+ + M33) — same route.
4. **RV32 CS watch** — extend `pico-sd-cs-watch.patch` to the RV32 SIO
   offsets (the RV32 needs `spi_device_cs()` on the RP2350 OUT_SET/OUT_CLR
   writes) so the RV32 SPI/SD columns can close.
5. **RV32 PWM crash** — `analogWrite()` → PC 0x20000686; a separate engine
   bug.
6. **RV32 I2C** — needs a device in the e2e harness (the headless probe
   cannot judge it).

## 9. Engine-folder observations (observation only — never edited)

Owner folder: `/home/danish1075/Documents/rp2350/Pico-emu`
(`git log -1` = `b83786f "M33 MP + RV32 silence fixes, DSP family, PIO taps,
docs refresh (507/507, sweep 71/71)"`; the working tree has uncommitted
changes in `src/picoemu_wasm.c`, `src/pio.c`, `tests/test_suite.c`, the
docs and the `web/` artefacts).

| file | md5 | note |
|---|---|---|
| `web/picoemu.wasm.wasm` | `0c74dffe5f5458a9062e4f7a13197781` | **byte-identical to the repo-committed engine bytes** — the owner has NOT produced new bytes |
| `web/picoemu.wasm.js` | `c3b784f0a59b151bc698329300a0611e` | same |

My verification build (in `/tmp/opencode/siocheck`, a COPY — never in the
engine repo), with `pico-rp2350-sio-gpio-map.patch` applied:

| file | md5 |
|---|---|
| `web/picoemu.wasm.wasm` | `10595ad87b7cc4c29097da3728f40aca` |
| `web/picoemu.wasm.js` | `740d87cc30f5d8d8b32ec42ce99c2f31` |

NOT committed — the repo keeps the owner's bytes.

## 10. Files changed in this session

| path | what |
|---|---|
| `patches/pico-rp2350-sio-gpio-map.patch` | **NEW** — the RP2350 SIO GPIO map fix (RV32 GPIO-out) |
| `patches/README-pico-rp2350-sio-gpio-map.md` | **NEW** — the write-up (goal, file:line, acceptance test, measured proof) |
| `patches/probe-pico2-rv32.ino` / `.mjs` | **NEW** — the headless RV32 probe (GPIO-out + SPI mirror + ADC inject) |
| `matrix.md` | the Pico rows only: the RV32 row (re-measured), the Pico spec list, the Pico lane note, the Pico SD connectivity row |
| `HANDOVER-LANE-pico-cov2.md` | this file (rewritten) |

## 11. Pointers

* Previous lanes: `HANDOVER-LANE-pico.md`, `HANDOVER-LANE.md`.
* Engine contract: `vendor/emulator-hook-specs/pico-emu.md`.
* Engine bytes provenance: `src/engines/pico-emu/README.md`.
* Hard rules (unchanged): one cell at a time, `--workers=1`, never edit a
  file while a cell runs, never `pkill -f`, never touch another lane's
  worktree, never push `md`, engine folders are READ-ONLY (deliver
  patches, verify in a copy), `npm run build` stays green and
  `public/version.json` noise is reverted before every commit.
