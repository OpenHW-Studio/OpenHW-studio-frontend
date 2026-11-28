# HANDOVER — lane/matrix-complete (matrix completion + engine-byte integrity)

**Lane:** `lane/matrix-complete` (from `lane/engine-bytes`) · worktree
`/home/danish1075/Documents/simulator/sim-matrix-complete` · date **2026-10-20**.

Two jobs:

* **JOB 1** — make `matrix.md` complete and self-explanatory: every cell
  carries a value **and** its justification (a cell = spec file + serial
  needle, or a `file:line` in the engine source).
* **JOB 2** — build the safety net for engine owners who rebuild their
  folders continuously, so a hand-copy can never mix a new wasm with an old
  glue.

---

## 1. What I swept (and what I did NOT touch)

| area | owner | swept? |
|---|---|---|
| title + "How to read this matrix" legend | **me** | rewritten (vocabulary, evidence rule, guest-print rule, guest-time rule) |
| "Engine byte status" table | **me** | **new** |
| AVR board table (4 rows × 21 cols) | **me** | every cell re-swept |
| micro:bit v2 + Retro board tables | **me** | every cell re-swept |
| system/crypto table — AVR / micro:bit / Retro rows | **me** | every cell re-swept |
| connectivity extras table (whole) | **me** | every row given a source |
| infra notes / deliberately out of scope / next to prove | **me** | extended (nothing restructured) |
| STM32F1 / STM32F4 / Pico / ESP32 board rows | f1/f4/pico/esp32 lanes | **not touched** |
| system/crypto table — F1 / F4 / Pico / ESP32 rows | f1/f4/pico/esp32 lanes | **not touched** |
| "DEPLOY BUILD HAZARD" note | lane/engine-bytes | **not touched** (only added to) |
| existing "Next to prove" entries 1–6 | lane/engine-bytes | **kept verbatim** (only owner tags added, entries 7–17 appended) |

**Rule applied everywhere:** no cell without a source. A cell that names a
spec must name the **needle** too; a cell that says NONE must say *why*
(no cell / engine gap / upstream block / silicon fact).

---

## 2. Engine byte status (measured 2026-10-20, `npm run check:engine-bytes`)

| engine | owner folder | pinned md5 (repo) | owner md5 TODAY | verdict |
|---|---|---|---|---|
| `stm32f1-emu` | `~/Documents/stm32 emu blue pill/pkg` | glue `43c24f16` + wasm `d1e69c28` + facade `091a0746`/`f2cff22c` | glue `43c24f16` + wasm **`641abe52`** + facade `091a0746`/`f2cff22c` | **MISMATCHED PAIR** — the owner rebuilt the wasm only |
| `pico-emu` | `~/Documents/rp2350/Pico-emu/web` | glue `c3b784f0` + wasm `0c74dffe` | `c3b784f0` + `0c74dffe` | **SAME** |
| `esp32-emu` (SAB) | `~/Documents/esp32 emu/dist/sab` | proxy `3c5c1866` + worker `4afe24dd` | **no `dist/` at all** | **NOT BUILT** |
| `esp32` engine wasm + ROM | `~/Documents/esp32 emu/src/engine/esp-xtensa` | wasm `d6d17d79` + ROM `445981c7` | wasm `d1c08b41` + ROM `445981c7` | **DIFFERENT** — the repo copy carries the OpenHW patches on purpose |
| `stm32f4-emu` | `~/Documents/stm32 F4/site` | glue `19a96301` + wasm `9455e31c` + facade `9631b8db`/`1f36d0ed`/`abd3334f` | glue `2574b1e2` + wasm `578ce844` + facade `9f9d7338`/`1f36d0ed`/`abd3334f` | **DIFFERENT** — a consistent rebuild (all three moved) |
| `nrf52833-periph-wasm` (micro:bit) | `~/Documents/microbit-v2/demo/pkg` | glue `112f7ab3` + wasm `d5a0e574` | `112f7ab3` + `d5a0e574` | **SAME** |
| `8086emu` (retro) | `~/Documents/8086/pkg` | glue `9832e032` + wasm `fa53c0f2` | `9832e032` + `fa53c0f2` | **SAME** |
| `pico-emu-fork` | — (we build it) | wasm `863559a3` | — | **N/A** — repo-only, deliberately not the owner bytes |
| `avr8js` (AVR) | — (pure-JS npm) | `node_modules/avr8js` 0.21.0 | — | **N/A** — the npm package *is* the engine |

**Repo side: OK — 21 pinned files present, every repo copy byte-identical to
its pinned primary.** The tool exits **0**.

> The "owner md5 TODAY" column is a **snapshot in time**. While the table
> was being written the STM32F4 owner's `site/emulator.js` moved **twice**
> (`c00a11f6` → `2c12466c` → `9f9d7338`) and the wasm moved again
> (`578ce844` → `214cfc92`). That churn is the entire reason the
> repo-pinned snapshot is the deploy artifact and the reason a refresh
> must take glue + wasm + facade from **one** build. Re-run the tool
> instead of trusting a number in a table.

### The tool (JOB 2 deliverable)

* `scripts/check-engine-bytes.mjs` — **read only**, never writes/copies.
  The engine list + pinned/owner paths are **DATA at the top of the file**
  (`const ENGINES = [...]`) → a new engine is one entry.
  Options: `--json`, `--verbose`, `--repo-only` (what CI wants).
* npm script: `npm run check:engine-bytes` (added to `package.json`).
* Verdict set: `SAME` / `DIFFERENT` / `MISMATCHED PAIR` / `NOT BUILT` /
  `MISSING` (repo broken) / `MIRROR DRIFT` (repo broken) / `OWNER ABSENT`
  (CI) / `N/A (no owner)`.
* **Exit non-zero only when the repo side is broken.** A different owner
  folder is information, not a failure — the owners rebuild continuously.
* CI degradation: an absent owner folder → *owner folder not present (CI)*,
  exit 0.
* Unit test `tests/unit/worker/engine-bytes.test.mjs` (4 tests, green):
  repo side intact · every engine listed · CI path exits 0 · the run is
  provably read-only (the watched trees are byte-identical afterwards).
* Protocol docs: `docs/engine-bytes.md` + a per-engine section in
  `src/engines/{stm32f1,pico,esp32}-emu/README.md` and
  `public/vendor/board-engines/{stm32f4-emu,microbit,8086emu}/README.md`.

---

## 3. Matrix contradictions found (before → after)

All of these are in sections **I own**.

| # | section | cell before | cell after |
|---|---|---|---|
| 1 | connectivity: Pico-W v4 DNS | "DHCP-carried DNS … needs the gateway patch on branch `lane/net-dns` (not yet on main)" | **FULL, both paths** — the gateway is `openhw-unified-gateway` **main** @ `3f8814b` (`git branch --contains 3f8814b` → `main`; the running binary carries it). Lease path: `DNS-LINK=3`, `DNS-IP=192.168.4.2`, `DNS-SERVER=192.168.4.1` (from the lease), `DNS-RC=1`, `DNS-RESOLVED=104.20.23.154` → 2/2 green. The spec's `test.skip(!process.env.DHCP_DNS, …)` opt-in is **removed** |
| 2 | system table: Retro EXTI/Interrupts | `NONE (chip PIC/CTC/VIA)` — **contradicted by four green cells** | `PARTIAL` + the four cells: 8086 8253→IRQ0 (`retro-pit`), Z80 CTC→IM1 38h (`retro-ctc`), 6502 VIA T1→IRQ (`retro-via`), 8051 Timer0→000Bh (`retro-8051-timer`); the 8259 PIC's other lines + 8237 DMA still unproven (engine exposes `dma_status` :119) |
| 3 | micro:bit family note | "BLE 5.1 (no engine model — needs owner work)" — **wrong**: the glue exports a full BLE peripheral (`ble_adv_state` :393, `ble_smp_*`, `ble_lesc_*`) | BLE is **NONE, not ABSENT**: the gap is the *cell + runner wiring*, not the engine |
| 4 | system table: micro:bit EXTI/Interrupts | `NONE (PPI+GPIOTE)` | `PARTIAL` — the button-A edge **is** proven (`microbit-cells` → `BTN_A_REL`); the generic `set_intr_pending` (:2223) / PPI / NVIC paths are not |
| 5 | system table: micro:bit Watchdog | `NONE` | `NONE` + the reason: the engine exposes `is_watchdog_reset_requested` (:1570) but the runner does not pump a WDT-reboot path (microbit-runner.ts:591) |
| 6 | system table: micro:bit PWR/Sleep | `NONE` | `NONE` + the reason: `power_notify_sleep_enter/exit` (:1760) + `power_take_systemoff` (:1783) exist, the runner does not pump sleep-wake (microbit-runner.ts:591) |
| 7 | system table: micro:bit Backup/NVS | `NONE (NVMC-backed NVS)` | `NONE` + the reason: the cell exists but is **skipped** (microbit-nvs.spec.js:8) — needs the runner NVMC erase-pump patch **and** a fixed `.bin` image |
| 8 | system table: micro:bit CRC | `ABSENT` | `NONE` — the engine exposes the BLE radio CRC (`radio_crc32` :1975); the nRF's own CRCC accelerator is not modelled → there is nothing to prove |
| 9 | system table: micro:bit HASH/CRYP | `ABSENT` | `ABSENT` + the reason (no AES/CCM model; the BLE-LE crypto helpers are not driven) |
| 10 | system table: AVR Watchdog | `PARTIAL (Uno+Nano reboot+ISR; Mega vector absent, Tiny deferred)` | same value, now with the needles (`AVR_WDT_BOOT` ×2 = the reboot proof, `AVRWDT_I_ISR:1`) and the file:line for the Mega/Tiny boundaries |
| 11 | system table: AVR EXTI | `PARTIAL (Mega+Nano/328P exact-count; Tiny INT0 unproven)` | same value, now with the needles (`MEGA_EXT_CNT:` / `NANO_EXT_CNT:` **exactly 10** — a storm would inflate it) |
| 12 | system table: AVR Clocks | `PARTIAL (mega+nano+tiny gate cells)` | same value, now with the needles (`MEGA_FCPU:16000000` + `MEGA_TICKS1024:` 14000..17250; `TINY_FCPU:`/`TINY_DTMS:` 900..1150) — and the note that the tiny cell proves the clock **identity**, not its rate |
| 13 | system table: AVR PWR/Sleep | `NONE` | `NONE` + the reason (avr8js models no sleep state; the WDT cell lists "AVR sleep (CPU no-op)" as an honest boundary) |
| 14 | system table: AVR Debug / CRC / RNG / HASH | bare `ABSENT` | each with its silicon + engine fact (avr8js' full peripheral list: adc, clock, eeprom, gpio, spi, timer, timer-attiny, twi, usart, usi, watchdog) |
| 15 | system table: AVR Backup/NVS | "EEPROM covered in main table" (not a value) | `FULL` + the needles (`EE_RB:`, `MEGA_EE_RB:`, `NANO_EE_RB:`, `TINY_EE_RB:`) |
| 16 | system table: Retro Clocks / Debug / PWR / Backup | bare `NONE`/`ABSENT` | each with a reason (`set_clock` :578 / `rtc_write` :513 exist, no cell measures them; no debug port; no sleep state; `flash_region` :161 is an *external* flash/EEPROM window no cell drives) |
| 17 | Retro board table: 8088 UART/GPIO | `PARTIAL (TX; RX-echo typed 8086 only)` / `NONE (inject exists, no cell)` | **FULL** — `retro-boards` → `HELLO_R88` and `retro-8088-gpio` → `RX88_RDY` + the echoed `Z`; the LED cell is in the same spec. The old note was **stale** |
| 18 | Retro family note: 8086 PIC/8237 DMA | "Real-system chips with NO proof yet (all NONE)" | now says the engine **exposes** `dma_status` (:119) and what exactly is missing (a cell, not a model) |
| 19 | connectivity: Pico-W CYW43 / Pico-ETH W5500 | "engine from owner folder (vite alias)" — **stale since lane/engine-bytes** | "engine bytes repo-pinned (`src/engines/pico-emu/`) since 2026-10-20 — an owner-folder alias is a hard build failure in CI" |
| 20 | connectivity: ESP32 BLE | `ABSENT (no engine model)` | `ABSENT on this board` — the classic ESP32 preset has no BT radio; the engine **does** carry a BT HCI model (`native_bt_hci_push_c2h`, worker-entry.js:7820-7842) for the C/S/W variants, but no cell drives it |
| 21 | connectivity: "ESP32 PCNT / SDMMC / ULP / FreeRTOS tasks / eFuse" — one `NONE each` row | one row | split: **PCNT / FreeRTOS / eFuse have unskipped cells** (`esp32-pcnt`, `esp32-freertos`, `esp32-sys`) → flagged `⚠ CELL EXISTS — verdict owned by lane/esp32-cov2`; SDMMC / ULP stay NONE with a reason |
| 22 | connectivity: LittleFS/SPIFFS | `NONE (no cell)` | `NONE` + the fact that the repo **ships** a littlefs wasm + FS builders (`src/worker/fs/fs-builders.ts:28,82`) and the closest proof is the ESP32 flash path (`esp32-nvs`) |
| 23 | connectivity: F1 USB-FS / F4 DMA2D | `NONE …` | same values + `⚠ a staged cell exists` (`stm32f1-usb`, control plane only) — verdicts belong to the F1/F4 lanes |
| 24 | connectivity: Pico RTC / Pico SD | `NONE (model exists; …)` / bare `NONE` | with the reasons (no cell; the SD one is the engine-side CS-line ask) |
| 25 | "Next to prove" | 6 entries, untagged, missing families | entries 1–6 **kept**, owner tags added (`[frontend]` / `[engine owner]` / `[user decision]`), and entries **7–17** added for AVR (SoftSerial RX, USART RX, 38 kHz IR carrier, ATtiny85 native USI/ADC/INT0), micro:bit (I2S/NFC/NVS/TEMP images, BLE wiring), Retro (PIC/8237 DMA, bit-bang, UART RX on the other ISAs), ESP32-CAM (2-board join race) and Pico RV32 (toolchain + GPIO model) |
| 26 | "Deliberately out of scope" | 3 bare bullets | each with the reason it is a silicon/engine fact, not a backlog item |

Also added (not restructured):

* the **legend** — vocabulary, what counts as evidence for `FULL`, the
  rule that **a guest's own "OK" print is not proof** (the *other side's*
  observed bytes are), and the rule that **time facts are asserted in
  guest-time quanta** (never wall-clock);
* the **Engine byte status** table (one row per engine, owner folder /
  pinned path / pinned md5 / owner md5 today / verdict) + the plain
  statement that the owner folders are moving targets and the repo-pinned
  snapshot is what dev/build/deploy use;
* a per-family **engine bytes** line under every family header
  (F1, F4, Pico, ESP32, AVR, micro:bit, Retro) with the md5s and the
  refresh-recipe path.

---

## 4. Left to the other lanes (cross-check these)

I did **not** edit them, but I found these in the sections they own:

1. **ESP32 system/crypto row** says `NONE (rng in rmt_rng_math.rs)`,
   `NONE (timers.rs MWDT)`, `NONE (clock(s).rs)`, `NONE (partition_table+NVS)`
   — but `tests/e2e/esp32-sys.spec.js` (CPU clock + `esp_random` liveness +
   eFuse MAC), `esp32-wdt-sleep.spec.js` (WDT bite + light sleep) and
   `esp32-nvs.spec.js` (Preferences put/get + EEPROM roundtrip) all exist
   and are **not skipped**. → lane/esp32-cov2 should reconcile.
2. **ESP32 board row**: the DMA column says `NONE`, the 1-Wire/DHT-RMT says
   `FULL` (bit-bang + Dallas) — check against `esp32-onewire` / `esp32-dht22`
   (both exist, unskipped).
3. **F1 USB-DEV column** says `NONE (FS-device capable)` while
   `tests/e2e/stm32f1-usb.spec.js` exists (staged control-plane cell).
4. **F4 system row** says `PARTIAL — HASH FULL … CRYP still NONE` —
   `stm32f4-crc-rng-x.spec.js` and `stm32f4-rng-crc.spec.js` exist; the
   row's CRC/RNG cells should name them.
5. **Pico system row**: `NONE (ROSC jitter, no cell)`, `NONE (nvic.c …)`,
   `NONE (WFI sleep RED …)` — the Pico lane owns the verdicts; the engine
   byte line under the Pico header (written by this lane) says the owner
   folder is **SAME**, so any Pico RED that looks like an engine problem
   should be re-checked with `npm run check:engine-bytes` first.
6. **Pico board rows** still have bare `FULL` cells (the sweep that adds
   needles to every Pico cell is the Pico lane's).

---

## 5. Hard rules for the successor

1. **The owner engine folders are READ ONLY.** Read and hash them; never
   edit, build, check out a branch or commit in them. Deliver engine
   changes as **patches** (see `patches/`).
2. **Never hand-copy engine bytes file by file.** Glue + wasm (+ facade)
   must come from **one** build. The glue resolves its wasm relative to
   itself; a mixed pair fails at `WebAssembly.instantiate` (missing
   export) or silently misbinds.
3. **The repo-pinned snapshot is the deploy artifact.** Dev, `npm run
   build`, the container and the `/vendor` runtime fallback all read the
   committed bytes. An alias to an owner folder is a hard build failure in
   CI (the container checks out only this repo).
4. **Refresh protocol** (full text in `docs/engine-bytes.md`): refresh only
   from a **stable** owner build → copy the **whole** set in one go →
   `npm run check:engine-bytes` before **and** after → `npm run build` +
   `git checkout -- public/version.json` → re-run **that engine's cells**
   → record the new md5s in the engine README and in the matrix's Engine
   byte status table.
5. **`npm run check:engine-bytes` exits non-zero only for a broken repo
   side.** Do not "fix" a DIFFERENT/MISMATCHED PAIR/NOT BUILT verdict by
   copying bytes — report it to the owner.
6. **A matrix cell without a source is a guess.** Every value needs either
   a spec file + the serial needle it asserts, or a `file:line` in the
   engine/runner source. A guest's own "OK" print is not proof — the
   *other side's* observed bytes are.
7. **Timing claims are guest-time quanta**, never wall-clock (the F4
   `stm32f4-clock` cell was a host-speed test in a board's clothes).
8. **Git**: commit on `lane/matrix-complete` only; never push, never merge
   into `md`. `npm run build` must stay green; revert `public/version.json`
   after every build. Keep `.tmp-vitest/`, `playwright-report/`,
   `test-results/`, `.vite-cache-*/` and `*agent.config.js` out of commits.
9. **Box pressure**: the app crashed once with 5 concurrent lanes. Run
   **one** spec file at a time, `--workers=1`; check `free -h` before each
   run; kill leftover browsers by PID (`pgrep -x chrome`), never `pkill -f`.
   No source edits while a run is in flight (vite HMR kills the pages).

---

## 6. Commands + results (2026-10-20)

| command | result |
|---|---|
| `npm run check:engine-bytes` | exit **0** — repo side OK (21 pinned files, every copy matches); verdicts: F1 **MISMATCHED PAIR**, Pico **SAME**, ESP32 **NOT BUILT**, ESP32 engine wasm **DIFFERENT**, F4 **DIFFERENT**, micro:bit **SAME**, retro **SAME**, Pico fork + avr8js **N/A** |
| `npx vitest run tests/unit/worker/engine-bytes.test.mjs` | **4/4 passed** (repo side intact · engines listed · CI degrades to exit 0 · the run is read-only) |
| `npx vitest run` (whole suite) | see the commit message / the tail of the report below |
| `npm run build` | see below (green, `public/version.json` reverted) |
| e2e | `npx playwright test tests/e2e/pico-wifi-dns.spec.js --config playwright.matrix-agent.config.js --workers=1` → **2/2 green** (the lease case now runs unconditionally: `DNS-LINK=3`, `DNS-IP=192.168.4.2`, `DNS-SERVER=192.168.4.1`, `DNS-RC=1`, `DNS-RESOLVED=172.66.147.243`; the explicit case → `DNS-RESOLVED=104.20.23.154`) |

### Files changed by this lane

```
M  matrix.md                                  (my sections: legend, engine byte status,
                                              AVR / micro:bit / Retro tables, system rows for
                                              AVR / micro:bit / Retro, connectivity extras,
                                              infra notes, out of scope, next to prove)
M  package.json                                (+ "check:engine-bytes")
M  src/engines/stm32f1-emu/README.md          (byte-check + refresh protocol)
M  src/engines/pico-emu/README.md             (byte-check + refresh protocol)
M  src/engines/esp32-emu/README.md            (byte-check + refresh protocol)
A  public/vendor/board-engines/8086emu/README.md     (new — byte provenance + refresh)
A  public/vendor/board-engines/microbit/README.md    (new — byte provenance + refresh)
A  public/vendor/board-engines/stm32f4-emu/README.md (new — byte provenance + refresh)
A  scripts/check-engine-bytes.mjs             (the tool)
A  tests/unit/worker/engine-bytes.test.mjs    (the tool's unit test)
A  docs/engine-bytes.md                       (the protocol)
A  HANDOVER-LANE-matrix.md                    (this file)
M  tests/e2e/pico-wifi-dns.spec.js            (the DHCP-lease DNS case is unconditional)
M  tests/e2e/microbit-*.spec.js               (race fix: wait for window.OpenHWE2E)
M  tests/e2e/retro-*.spec.js                  (race fix: wait for window.OpenHWE2E)
```

The `tests/e2e/microbit-*` and `tests/e2e/retro-*` edits are the
`waitForFunction(() => window.OpenHWE2E)` race fix (the harness installs
the global asynchronously; a fixed 8 s wait loses the race on a loaded host
→ "Cannot read properties of undefined (reading 'setupCircuit')").
