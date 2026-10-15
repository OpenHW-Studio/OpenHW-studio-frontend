# pico-emu — hook spec (for emulator agent)

Package: `pico-emu` first-party source (`/home/danish1075/Documents/rp2350/Pico-emu`, commit `a47d098`). Our runner: `OpenHW-studio-frontend/src/worker/runners/pico-runner.ts`.
Status (2026-10): jsmirror is upstreamed in-tree (`src/sdd_jsmirror.c`, `src/sdd.c`, `include/sdd.h`, `build_wasm.sh`) and the simulator vendors the first-party build — the old `vendor/pico-emu-fork/fork.patch` replay is retired (kept for history).

## What to add

1. **jsmirror SDD slave** (I2C observation channel, default OFF — active only after `sdd_add`):
   - `_picoemu_sdd_add("jsmirror:i2c=0,addr=0x3C,...")` → registers ACK-sink slaves, returns ≥0 on success.
   - `_picoemu_jsmirror_pending()` → count of queued ring entries.
   - `_picoemu_jsmirror_pop(ptr, max)` → drains entries as `uint16_t`:
     - `0x200` = STOP, `0x100|addr` = START+address, `0x00–0xFF` = data byte.
2. **Address-probe ACK for scans**: `machine.I2C.scan()` (MicroPython) and `Wire` address probe must see ACK at registered addresses — same path as Arduino DW writes, no firmware-specific casing.

## What to expose (stable JS ABI)

`_picoemu_sdd_add`, `_picoemu_jsmirror_pending`, `_picoemu_jsmirror_pop`,
plus existing `_picoemu_write_uart` (REPL injection) and UART-out poll — all already used by our runner, keep signatures frozen.

## MicroPython findings (proven live 2026-10, needs engine work)
Our runner injects via chunked `exec()` lines and the Arduino I2C path is
green, but two MP-specific gaps remain in-engine:

7. **Scan path — engine exonerated 2026-10-06, runner-side suspect.**
   `machine.I2C.scan()` bit-bangs SIO GPIO (never touches the DW
   controller — zero-length DW writes are register-invisible by SDK
   design, so there is no DATA_CMD pattern to route). Native SIO
   repro passes fully: 0x3C ACKs + ring `[0x13C, 0x200]`, all other
   addresses NACK ring-silent, full 0x08–0x77 sweep finds exactly
   `[0x3C]`; committed engine tests lock it. If live `scan()` still
   reports `[]`, suspect runner-side mirror-attach timing vs. the scan
   (diagnostic: dump `_picoemu_jsmirror_pending` right after a live
   scan; each live probe leaves exactly 2 entries). NACKed-probe ring
   visibility is a follow-up spec decision, not a bugfix.
8. **`time.sleep()` never wakes.** Firmware goes silent inside `sleep`
   (no output, no traceback, engine appears halted); Arduino `delay()`
   works (busy-wait, no alarm). Prime suspect: TIMER alarm IRQ / WFI
   wakeup path used by MP's sleep. Our MP cell avoids `sleep` until fixed.

## M33 HardFault in I2C burst path (proven live+native 2026-10, BLOCKS Pico 2)

M33 Arduino faults deterministically inside Adafruit `display()` I2C
writes; M0 identical-shape passes (native + browser).
`[CPU] HardFault: PC=0x3E380000 LR=0x10007D0F SP=0x20081FC0`
(same PC/LR/SP across sketches; ~447K steps; reboot loop in browser).
Ruled out with evidence: DMA (async-only), mirror ring (4K,
overwrite-oldest), TX-buffer overflow (pointer + bounds-checked),
IRQ numbering (translated), FPU stacking (consistent-basic), scan/ET
probe (GPIO bit-bang, mirror-independent), preemption (fault persists
with IRQ 3 masked), r6/slot (valid at observed hits; single caller).
Load-bearing proof: `LR=0x10007D0F` can only come from a branch at
`0x10007D0B`, where the linked bytes (`0F00D1EF`) encode NO branch —
a M33 Thumb-2 fetch/decode misfire (phantom branch). Suspect area:
ICache tag/index + 32-bit fetch pairing + thumb32 decode (M0+ is
16-bit-heavy and immune). Timer IRQ 19 preempts inside the loop
(handler `alarm_pool_irq_handler` uses FPU `VLDR d8` — check lazy
stacking too, but stacking is consistent-basic today).
Repro (no browser needed): `./build/picoemu /tmp/opencode/m33bis.uf2
-arch m33 -sdd jsmirror:i2c=0,addr=0x3c -timeout 30` (+ `-debug` shows
Exception 19s then the fault; GDB RSP via `-gdb <port>` works for
breakpoints). Note: native needs the CMakeLists `sdd_jsmirror.c`
entry (added) to link.
Already fixed in-tree (proving the harness works): RP2350 I2C
remap in `membus.c` (`i2c_remap_rp2350`, ADC-precedent pattern) —
native raw M33 writes went NACK→`ET:0` with ticks.
Update (same session): preemption fully dead — IRQ 3 masked via ICER
(mask verified through ISER readback `0x4004008`→`0x4004000`), fault
identical (same PC/LR/SP). INTR_MASK reads `0x10` (RX_FULL, benign on
writes). Timer IRQ 19 entries observed at `timer_busy_wait_us`,
`strlen`, `Adafruit_GFX::write`, `ssd1306_commandList`,
`TwoWire::_dma_irq_handler` (entry address — mask=0 there, no-op
return), and twice inside `i2c_write_blocking_internal` itself
(`0x10007CCE`, `0x10007D30`). GDB caveats for whoever continues:
stub skips halted cores (post-fault stops never fire), `$r6` reads
as 0 (use memory reads), conditions unreliable — breakpoints +
auto-continue printing works.

## Further gaps (same agent, P1 — full protocol audit 2026-10)

Our runner (`pico-runner.ts`) wires **no** SPI / ADC / PWM today, and the
stock glue exports no tap for them (verified: `_picoemu_*` surface is
## Further gaps (same agent, P1 — full protocol audit 2026-10)

Our runner (`pico-runner.ts`) wires **no** SPI / ADC / PWM today, and the
stock glue exports no tap for them (verified: `_picoemu_*` surface is
GPIO get/oe/out/raw + `set_gpio`, UART read/write, SD-image load,
USB/WiFi/BT/Eth/W5500, GDB — no `spi/i2c/adc/pwm` beyond this spec's SDD):

3. **SPI slave tap** (P1): per-byte MOSI observe + MISO inject for
   MAX7219/SD-card cells (mirror F1 `onTransfer` + `injectMiso` semantics).
4. **ADC inject** (P1): per-channel voltage set for `analogRead` cells
   (pots, sensors).
5. **PWM/timer-out observe** (P1): frequency+duty readback for servo/LED/
   buzzer cells.
6. PIO programs, I2S audio-out: P2 (no cells written yet; do not block on them).

## Future-component guarantee (signal-level contract)

Components are unbounded (registry already holds I2C sensors, SPI TFT/ePaper,
TM1637 bit-bang, NeoPixel timing, HC-SR04 echo, IR 38 kHz, step/dir drivers,
I2S audio) — so the promise is per **primitive**, not per part. After §1–5,
ANY future component built on these works with zero further engine changes
(only generic runner-bridge mapping, which already exists):

- GPIO out edge + level, GPIO in inject, per-pin analog in, I2C byte both
  directions + ACK/NACK + scan, SPI byte both directions + CS, UART both
  directions, PWM-out freq+duty.
- P2 engine ask (not blocking): per-step cycle/instruction counters so the
  runner can stamp edges in *sim* time — today OneWire/timing uses a
  wall-clock approximation (`arm-runner-base.ts` OneWire decode), which is
  exact only when wall pace == sim pace.

## Constraints

- Additive-only; when `sdd_add` is never called, emulation must be bit-identical to stock 1.0.3.
- Pin the Emscripten version + build script in the repo so the `.wasm` rebuild is reproducible.

## Cross-cutting constraints (sync/SAB — engine side of the contract)

Engines never touch SharedArrayBuffer: each engine runs as a plain
synchronous step function inside its board Worker, and only our
`arm-runner-base.ts` touches SAB (pin bitfields, barrier cells, STEP
collect). Two things the engine must still guarantee so multi-board
lockstep holds:

1. **Reset clears everything, synchronously** — cores, peripherals, pending
   events, and any `stopped`/fault flags. A sticky flag desyncs one board's
   lane forever while the others advance.
2. **Expose a cycle/instruction counter per step** — feeds sim-time edge
   stamps (replacing the runner's wall-clock approximation) and the
   skew/pace accounting. One counter serves both.

## Acceptance (our e2e, already written)

- `tests/e2e/pico-i2c.spec.js`: OLED `vramFill` 3.5–3.7 + LCD2004 `Hello` — green today on the fork, must stay green on first-party build.
- `tests/e2e/pico-mp-i2c.spec.js`: `MP_SCAN: [60]` + `vramFill > 0` via MicroPython `machine.I2C` — currently failing, the scan-ACK path is the suspect if runner-side diagnosis clears.
