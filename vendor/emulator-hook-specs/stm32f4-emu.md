# stm32f4-emu — hook spec (for emulator agent)

Our runner: `OpenHW-studio-frontend/src/worker/runners/stm32f4-runner.ts`.
Engine site: `public/vendor/board-engines/stm32f4-emu/site/{stm32f4.js,emulator.js}`.
Status (2026-10-20): **the old "wedged" status is retired** — the first-write
fault is gone and the F4 cells (I2C/SPI/display/USB/CAN/SD/Ethernet/HASH/
IWDG) are green. What is still open for the engine is recorded below and in
the two HASH patch files under `patches/`.

## What to add / fix — the 2026-10 asks are CLOSED, here is the residue

The four original asks were about the first-write wedge. That wedge is gone
and the F4 cells are green, so the list below is what actually remains:

1. **RESOLVED — the first-write fault.** The firmware no longer faults at the
   first I2C data write; `millis()` advances and the runner callbacks fire.
   The F4 I2C cell is green: `tests/e2e/stm32f4-periph-x.spec.js`
   ("SSD1306 draws via I2C1"). **Residue:** `stopped` is now part of the
   `execute()`/`step()` return (`{instCount, stopped}`), but `fault_pc` is
   still only used internally (`emulator.js:1483`, `:1551`) and is **not**
   exposed to JS. Exposing it would let a cell distinguish "bus transacted,
   core faulted" from "bus never transacted" without a probe sketch.
2. **RESOLVED — I2C event fan-out.** The engine now takes each bus's events
   ONCE and fans them out to every consumer (`i2cGroups` +
   `processI2cBus`, `emulator.js:771-785`; the OLED/TFT handlers are
   "events in, no take"). The old starvation (one drain starving the other)
   is gone.
3. **RESOLVED — read-path parity with F1.** `withAssets.i2c` specs now accept
   `onRead`: master reads raise `onRead(address)` at the address phase and
   the returned bytes are pushed into the RX queue
   (`site/stm32f4.js:189-220`, handle parity at `:481-490`). Our runner
   supplies `onRead` (`stm32f4-runner.ts:222`), so the registry's reading
   sensors (MPU6050, BMP180, ADXL345, DS1307, EEPROM, PCA9685) are no
   longer dark on F4.
4. **Keep F1-style semantics where they exist**: pre-`init_svd` address-keyed
   `i2c_register_slave` is fine — the fan-out (2) makes it safe.

### What the engine still owes us

* **The HASH peripheral's four silicon deviations** — see the HASH section
  below and the patches under `patches/` (`README-f4-hash.md`,
  `f4-hash-silicon-fixes.patch`, `f4-hash-completion-interrupt.patch`).
  These are **not** worked around in our runner; they are delivered as
  patches for the owner to apply.
* **Typed net API** (`ethInject`, `ethSetLink`, create-time `onTx`,
  `withAssets.irq_eth`) — see the network section above.
* **A clean owner-folder build.** F4 still runs the **npm pair**; the owner's
  local folder is mid-rebuild and its glue/wasm differ from npm by hundreds
  of lines, so folder-first is suspended for F4 only (see
  `resolve.alias` in `vite.config.js`). Glue + wasm must version-match.
* **Engine repos are READ-ONLY for us.** Deliver engine changes as patch
  files or branch proposals for the owner to merge — never apply them in
  place.

## Constraints

- Additive-only; F4 Arduino serial/boot cells already pass — no behavior change when `withAssets.i2c` is absent.
- Runner `stepBudget` ignores the engine `stopped` flag today; keep stepping side-effect-free when stopped.

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


## Network — the unified-gateway contract (PROVEN 2026-10-20)

There is no in-emulator IP stack any more: the F4 on-chip MAC is a **station
on a raw-Ethernet bus** and the gateway (`openhw-unified-gateway`, Go) owns
the network — `ws://127.0.0.1:5030/api/network-gateway`, room via
`?sessionId=`, virtual net `192.168.4.0/24`, gateway `192.168.4.1`, DHCP +
gVisor DNS/NAT.

### The four facade entry points we drive

| Entry point | Role |
|---|---|
| `withAssets.onTx` (**create-time**) | TX tap: the facade hands every MAC frame to the runner. It must be a **create-time** asset — the facade has no post-create hook for it, so a late assignment loses frames. |
| `ethInject(frame)` | RX: hand one complete Ethernet frame to the MAC (runner injects <=8 per drain) |
| `ethSetLink(true/false)` | drives the link so BMSR/PHYSTS report carrier (silicon: an external PHY). Called at boot and on teardown. |
| `withAssets.irq_eth = true` | **opt-in** (we set it from the board attr `ethIrq=on`, default off, chips 407/429 only): raises the ETH interrupt (IRQ61) on RX. Only for interrupt-driven guests — the polling HTTP image must NOT set it. |

The runner (`src/worker/runners/stm32f4-runner.ts`,
`startF4NetLink` / `pumpF4NetLink` / `stopF4NetLink`) owns the WebSocket
(`src/worker/net/gateway-link.ts`): TX frames queued by `onTx` are sent per
drain; RX frames are queued and injected via `ethInject`.

### Proof cells (live, green — the gateway is the evidence)

* `tests/e2e/stm32f4-eth-gateway.spec.js` — F407 bare-metal DHCP DORA
  through the gateway (`DHCP Offer: IP=192.168.x`; the owner's
  `eth_dhcp.bin`).
* `tests/e2e/stm32f4-eth-gateway-ve.spec.js` — 407VE (shares the F407 die).
* `tests/e2e/stm32f4-eth-gateway-429.spec.js` — F429 (needs its own `_f429`
  build; see the owner's engine `NETWORKING.md` §3).
* `tests/e2e/stm32f4-http-gateway.spec.js` — F407 HTTP client through the
  gateway NAT (`TCP connected` + `HTTP/1.1 200 OK`; the owner's
  `eth_http.bin`, polling firmware, no `ethIrq`).

### Gateway expectations

* The **DHCP lease carries the resolver** `192.168.4.1` alongside `8.8.8.8`.
* A **static-IP guest has no lease and therefore no resolver** — it must set
  one explicitly.
* The **DHCP pool is a global counter** (MAC-keyed, but the counter is shared
  by every room and board on the box and wraps at `.250`) and drifts — assert
  only the `192.168.` prefix, never a fixed lease number.

### Engine gaps we rely on the owner to fix

1. **Type the facade net API.** `ethInject`, `ethSetLink`, `onTx` and
   `withAssets.irq_eth` are used through `any` casts in our runner. A rename
   is silent: the ETH cells would fail as "no DHCP offer" instead of a
   missing-hook error.
2. **`withAssets.onTx` must be honoured as a create-time asset** (see the
   table above). This is the shape the owner CLI reference documents, and our
   runner matches it — but it deserves a declared type and a doc comment on
   the facade side.
3. `withAssets.irq_eth` should be a documented, typed asset: today it is an
   untyped `any` flag that only one guest kind wants.


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

## Acceptance (our e2e — all green today)

1. `tests/e2e/stm32f4-periph-x.spec.js` — "SSD1306 draws via I2C1" (the old
   discriminator probe's target: the bus transacts and the frame lands).
   Mirrors the green F1 cell.
2. `tests/e2e/stm32f4-sys.spec.js` — IWDG (arm/reload/fire, asserted in
   guest-time units) and HASH (SHA-256/SHA-1 against the FIPS 180-4 vectors).
   Must stay green with the HASH patches applied — the cell reads the digest
   from the alias bank and asserts `HR0..HR3` of the main bank, never `HR4`.
3. `tests/e2e/stm32f4-eth-gateway.spec.js` (+ `-ve`, `-429`) and
   `tests/e2e/stm32f4-http-gateway.spec.js` — the Ethernet path (see the
   network section above) must stay green.
4. `tests/e2e/stm32f4-clock.spec.js` / `stm32f4-pace.spec.js` — the pace
   cell asserts the **guest-time** fact (consecutive prints exactly one
   `delay(2000)` apart). The old "tickMHz divider is PROVEN INERT" claim is
   **retracted**: the divider really does accelerate the guest clock
   (div=7 → 489..1267 guest-ms/wall-s vs div=1 → 106..158). The cell logs
   the host coverage instead of asserting a wall-dependent count.

   Runner-side note (not an engine issue, recorded so it is not
   re-diagnosed): the `tickMHz` write receipt used to be emitted on a
   **private serial source** (`'f4clk'`). The page's serial ingress accepts
   one source per board per 240 ms, so the private source flipped the
   arbitration and the board's **own** output was silently dropped. The
   receipt is now emitted on the board's own source `'uart0'`.
