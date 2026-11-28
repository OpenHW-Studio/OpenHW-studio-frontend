# HANDOVER-LANE-verify — independent re-run of the committed cells

Verification agent (3rd session after model deprecation + free-usage cut-off).
Work performed 2026-10-22 21:0x–. **This file is UNCOMMITTED** on
`lane/pico-cov2` (working tree only) so a cut-off cannot lose it; nothing was
committed to either lane branch.

Worktrees treated read-only: F4 `sim-f4-cov2` (`lane/f4-cov2` @ `115d39a9`),
Pico `sim-pico-cov2` (`lane/pico-cov2` @ `e8b1f980`).

## STATUS

| # | cell | status | evidence |
|---|------|--------|----------|
| 1 | F4 `stm32f4-sysblocks.spec.js` | **PASS** 24/24 (11.2m) | CRC FB5C7298/4217139864, WWDG_DEC down + SR.EWIF + RSTF + BKP 57474447, PWR_MODE:2 + SLEEP/WOKE/WUF, CLK_OK + CR1 bit17 + CFGR2 PLLI2S=5, DBG_ITM_SENT |
| 2 | F4 `stm32f4-ltdc.spec.js` + `stm32f4-dcmi.spec.js` | NOT YET | — |
| 3 | 1-Wire NO-GO / owner md5 | DONE (see below) | source still toggle model; owner bytes differ from pins |
| 4 | Pico `pico-exti` / `pico-gpio-in` / `pico2-rv32-arduino` | NOT YET | — |
| 5 | Pico patch applicability | DONE — all 5 APPLY CLEAN | `git apply --check` on a /tmp copy of the owner's CURRENT tree |
| 6 | `probe-pico-sd-cs.mjs` headless | DONE | R0/R8/R41/R58 = FF (unpatched committed engine); mirror: 60 MOSI bytes, 0 CS events |

## 5. Patch applicability against the owner's CURRENT source

Owner tree copied (never in place):

```
rsync -a "/home/danish1075/Documents/rp2350/Pico-emu/" /tmp/lane-verify/Pico-emu-cur/
# copy HEAD b83786f ("M33 MP + RV32 silence fixes, DSP family, PIO taps, docs refresh (507/507, sweep 71/71)")
# + the owner's uncommitted working-tree edits (AGENTS.md, CHANGELOG.md, README.md modified; cp_*.log deleted)
```

`git apply --check` per patch, inside `/tmp/lane-verify/Pico-emu-cur`:

| patch | touches | verdict |
|---|---|---|
| `pico-in-latch-inject.patch` | build_wasm.sh, src/picoemu_wasm.c | **APPLIES CLEAN** |
| `pico-sd-cs-watch.patch` | build_wasm.sh, include/gpio.h, src/gpio.c, src/picoemu_wasm.c | **APPLIES CLEAN** |
| `pico-m33-sha256-csr-map.patch` | include/devtools.h, src/devtools.c, src/membus.c | **APPLIES CLEAN** |
| `pico-m33-wdt-rom-patch.patch` | src/main.c, src/picoemu_wasm.c | **APPLIES CLEAN** |
| `pico-rp2350-sio-gpio-map.patch` (the RV32 SIO-map patch) | src/gpio.c, src/rp2350_rv/rv_membus.c | **APPLIES CLEAN** |

None of the five is landed in the owner's tree (a landed patch would fail
`--check`); all five still apply to today's working copy, so the lane's
findings are still open upstream work.

## 6. SD-CS probe, headless, on the COMMITTED engine bytes

Engine under test: `src/engines/pico-emu/picoemu.wasm.js` +
`picoemu.wasm.wasm` as committed in the worktree. That byte pair does **not**
export `picoemu_sdcard_cs_pin` (`grep -c picoemu_sdcard_cs_pin` = 0), i.e. it
was **not** built with `pico-sd-cs-watch.patch` — expected, the patch is
proposed, not applied.

Firmware: `patches/probe-pico-sd-cs.ino` compiled once with
`arduino-cli --fqbn rp2040:rp2040:rpipico` to
`/tmp/lane-verify/fw/out/sdprobe/sdprobe.ino.uf2`
(source md5 `32b1621cee9f0212b8f504979a030f1a` == repo ino).

### MODE=sd (SD model attached on SPI0)

```
sdcard_load rc=0 bytes=4194304
sdcard_cs_pin export MISSING (unpatched engine)
SDPROBE:R0:FF
SDPROBE:R8:FF:FF:FF:FF
SDPROBE:R41:FF
SDPROBE:R58:FF:FF:FF:FF
GP5 (guest CS pin) OUT-latch transitions: LOW -> HIGH -> LOW -> HIGH -> LOW -> HIGH
SPI0 CR0=1707 CR1=2 SR=3 CPSR=2 RIS=8
```

Measured bytes: **R0=FF, R8=FF FF FF FF, R41=FF, R58=FF FF FF FF** — every
card response is 0xFF. The guest is alive (6 CS latch transitions, SPI0
CR0/CR1/SR/CPSR/RIS live), the card simply never answers.

### MODE=mirror (SPI tap on SPI0 instead of the card)

```
mirror entries=60
MOSI bytes (60): ff ... 40 00 00 00 00 95 ff 48 00 00 01 aa 87 ... 77 00 00 00 00 ff 69 40 00 00 00 ff ff 7a ...
CS events (0): (NONE)
```

**60 MOSI bytes arrived, 0 CS events.** The guest really shifted CMD0 /
CMD8(0x48)/CMD41(0x69/0x77)/CMD58(0x7a) out on the bus, but the engine never
raised a chip-select event, so `sd->cs_active` (engine `src/sdcard.c:379`)
never became true and the card stays silent. This reproduces the lane's
diagnosis byte-for-byte on the committed engine bytes.

## 3. 1-Wire NO-GO — owner tree state and md5 comparison

Pinned/deployed bytes in the F4 worktree (what the e2e cells actually run):

| file | md5 |
|---|---|
| `public/wasm/stm32_periph_wasm_bg.wasm` (wasm) | `9455e31cdbb2295697db81e49ec4119e` |
| `public/vendor/board-engines/stm32f4-emu/site/vendor/stm32_periph_wasm.js` (glue) | `19a9630175082fab610c8685e8aad7cb` |

Owner tree `/home/danish1075/Documents/stm32 F4/` (read-only, live build):

| file | md5 | note |
|---|---|---|
| `site/vendor/stm32_periph_wasm_bg.wasm` | `03d472a9ff117ab33291a3d7f1086d72` | mtime 21:03, being rewritten during the check |
| `site/vendor/stm32_periph_wasm.js` | `398eed0cf1677115f549215d3a328344` | |
| `stm32-periph-wasm/pkg/` | — | **the directory disappeared mid-check** (owner rebuild in progress; one `find` saw `pkg/stm32_periph_wasm_bg.wasm` md5 `6175041e8817f222d0d411ee6977656f`, the next listing had no `pkg/`) |

**Verdict: wasm DIFFERENT from pinned** (`03d472a9` vs `9455e31c`), and the
glue is a new build too (`398eed0c` vs `19a96301`) — a self-consistent owner
pair, NOT the deployed pair. Observation only; nothing was copied or built.

**Did the owner land `f4-systick-val-downcounter.patch`?** **No.**
`stm32-periph-wasm/src/peripherals/systick.rs` still carries the toggle model
(lines 28–31: `self.val_toggle = !self.val_toggle; if self.val_toggle { self.cvr } else { self.rvr }`)
and `git status` shows that file unmodified. The 1-Wire NO-GO stands on the
source of truth (the model is still 1 ms-quantised `micros()`), and the newer
owner wasm has not been shown to change it.

## 1./2./4. e2e cells

(filled in as each cell completes — one cell at a time through `/tmp/lane-run.sh`)

### Cell 1 — F4 `tests/e2e/stm32f4-sysblocks.spec.js` — **PASS**

Worktree `sim-f4-cov2` (`lane/f4-cov2` @ `115d39a9`), port 5175.

```
24 passed (11.2m)      lane-run rc=0      wall 16m22s (slot wait + vite start)
```

Needles asserted (all present in the serial the browsers saw; the spec refuses
the cell otherwise):

- CRC: `F4CRC_HEX:FB5C7298` + `F4CRC_DEC:4217139864`, no `F4CRC_MISMATCH`
- WWDG: `F4WWDG_DEC:<n>,<m>` strictly decreasing, `F4WWDG_SR` bit0 (EWIF) set,
  `F4WWDG_CSRCLR` bit30 cleared, `F4WWDG_RSTF`, ≥2 boots,
  `F4WWDG_BKP:57474447` after the reset
- PWR: `F4PWR_SLEEP` → `F4PWR_WOKE`, `F4PWR_WUF`, `F4PWR_MODE:2` (STOP via LPDS),
  `F4PWR_CR1`/`F4PWR_CSR1` readback
- Clocks: `F4CLK_OK` (no `F4CLK_BAD`), `F4CLK_CR1` bit17, `F4CLK_CFGR` SW/SWS=1,
  `F4CLK_CFGR2` PLLI2S bits = 5, `F4CLK_AHB1` gate readback
- Debug: `F4DBG_READY`, `F4DBG_ID` = `10006431` (F407VE) / `10016413` (F407DBG) /
  `10006419` (F429), `F4DBG_CR:3`, `F4DBG_CTRL0:1`,
  `F4DBG_CNT:n,n,n,cycles` (frozen counter equal across reads),
  `F4DBG_ITMREADY:1`, `F4DBG_ITM_SENT` — observed verbatim in the tail for all
  three boards.
