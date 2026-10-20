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

## Network — the unified-gateway contract (PROVEN 2026-10-20)

There is **no in-emulator WiFi/IP stack any more** — the frontend's fake
DHCP/DNS and the network worker were deleted. The engine is a **station on a
raw-Ethernet bus** and the gateway (`openhw-unified-gateway`, Go) owns the
network: `ws://127.0.0.1:5030/api/network-gateway`, room via `?sessionId=`,
virtual net `192.168.4.0/24`, gateway at `192.168.4.1`, DHCP + gVisor
DNS/NAT. See the docs repo's `architecture/network-bringup.md` for the full
design.

### Net entry points we drive (all live, all proven)

| Entry point | Role |
|---|---|
| `_picoemu_wifi_enable(1)` | enable the CYW43 (nodhcp — DHCP flows to the gateway). Pico W / Pico 2 W |
| `_picoemu_board_eth(1, live=1, spiBus)` | enable the W5500 on SPI0/SPI1 (`boardSpi` attr) |
| `_picoemu_w5500_gw_enable(1)` | join the shared vnet bus (MACRAW socket 0) |
| `_picoemu_eth_set_uplink(1)` | assert the uplink **before the first step** (owner parity with `rp2350/Pico-emu web/cli.js`); `0` on teardown |
| `_picoemu_eth_pop_tx(ptr, max)` | pop one TX Ethernet frame into `ptr` (<=16 pops per tick, 2048-byte buffer) |
| `_picoemu_eth_push_rx(ptr, len)` | hand one RX Ethernet frame to the engine |

Our runner (`src/worker/runners/pico-runner.ts`, `startNetLink` /
`pumpNetLink` / `stopNetLink`) owns the WebSocket
(`src/worker/net/gateway-link.ts`): RX frames are `malloc`'d, copied into
`HEAPU8` and pushed; TX frames are popped per tick and sent. Every call is
`typeof`-guarded, so a renamed export silently disables networking — see the
"no TS types for the net ABI" ask below.

**In progress (not yet proven):** the W6300 carrier uses the same bus and the
same per-tick pump but a different engine board:
`_picoemu_board_eth6300` + `_picoemu_w6300_gw_enable(1)` (engine board
`pico-w6300`, CSn=16/RSTn=22/INTn=15). Proof in flight on lane
`lane/net-6300`; the arduino-pico core has no W6300 board entry yet, so
there is no compile target.

### Proof cells (live, green — the gateway is the evidence)

* `tests/e2e/pico-wifi-gateway.spec.js` — Pico W joins the AP and takes a
  **gateway** DHCP lease (`STATUS=3`, `IP=192.168.4.2`).
* `tests/e2e/pico2-w-wifi-gateway.spec.js` — same on Pico 2 (M33).
* `tests/e2e/pico-wifi-lan.spec.js` — two Pico W boards in one room, TCP
  client<->server echo.
* `tests/e2e/pico-wifi-ap-serve.spec.js` / `pico-wifi-ap2.spec.js` /
  `pico-wifi-ap.spec.js` — a guest **SoftAP** hosts a TCP server and a
  joining STA reaches it (and the reverse direction).
* `tests/e2e/pico-http-gateway.spec.js` — HTTP GET through the gateway NAT
  (200 + body byte-exact).
* `tests/e2e/pico-wifi-dns.spec.js` — `hostByName` through the gateway
  resolver.
* `tests/e2e/pico-eth-gateway.spec.js` / `pico2-eth-gateway.spec.js` — W5500
  full DORA.
* `tests/e2e/pico-ping6-gateway.spec.js` — IPv6 SLAAC (`RA-OK`).

### Gateway expectations (what the engine may rely on)

* The **DHCP lease carries the resolver**: leases advertise the gateway
  resolver `192.168.4.1` alongside `8.8.8.8`, so a lease-based lookup stays
  inside the virtual net.
* A **static-IP guest has no lease and therefore no resolver** — it must set
  one explicitly (`WiFi.setDNS(192.168.4.1)`; proven on Pico W in
  `pico-wifi-lan.spec.js`).
* **Room-aware `.1` arbitration**: if a room member claims `192.168.4.1` as a
  soft AP, the gateway stops answering `.1` ARP requests so the AP answers
  for itself (gateway `main@151927d`). Trade-off: in such a room the
  gateway's own `.1` services (incl. the resolver it advertises) are
  unreachable from that room.
* The **DHCP pool is a global counter** (MAC-keyed, but the counter is shared
  by every room and board on the box and wraps at `.250`) and drifts — never
  rely on a fixed lease number.

### Engine gaps we need fixed (owner)

1. **No TS types for the net ABI.** `_wifi_enable`, `_board_eth`,
   `_w5500_gw_enable`, `_eth_set_uplink`, `_eth_push_rx`, `_eth_pop_tx` are
   called through `any` casts. A rename disables networking silently instead
   of failing loudly. Types (or a version constant) would make it loud.
2. **W5500 at the 200 MHz arch default never completes DHCP**: `begin()` does
   not return because the guest outruns the wall DHCP timers. Our cells pass
   the `tickMHz 125` attr to work around it (same on M0 and M33). Engine-side
   quirk, flagged upstream.
3. **`_picoemu_board_eth(1, live=0, spi)` stalls DHCP** in our runner, even
   though the owner demo uses `live=0`; we run `live=1` (green twice). The
   demo's extra proxy-socket/upload path likely covers the difference.
4. **`softAPConfig` is not honoured**: the SoftAP netif is hardcoded to
   `192.168.4.1`. A guest that asks for a different AP subnet silently gets
   the hardcoded address (this is why `pico-wifi-ap.spec.js` had to be
   repointed at the AP's real address).
5. **W5500 INTn / GPIO21 interrupt path** is not proven: the proven W5500
   cells are polling guests. Expose the interrupt so an INTn-driven guest can
   be proven against the same bus.

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

## Lane/pico findings 2026-10-11 (all headless-proven; runner + specs adapt, owner action noted)

### F1 — SHA-256 CSR map contradicts silicon (BLOCKS the RP2350 HASH cell)

- Engine (`include/devtools.h:539-546`): WDATA_RDY=bit0, SUM_VLD=bit1,
  START=bit31. Silicon (SDK `regs/sha256.h:44-118`): START=bit0,
  WDATA_RDY=bit1, SUM_VLD=bit2 (+ERR=bit4, BSWAP=bit12).
- Effect: the canonical `pico_sha256_*` flow ("abc", BIG_ENDIAN, CPU —
  the SDK's own test shape) configures + writes + STARTs, then
  `sha256_wait_valid_blocking` (silicon bit2) spins forever (serial
  shows READY/STARTRC=0/WRITTEN, never DIGEST).
- Second defect, same peripheral: CSR writes IGNORE the BSWAP bit
  (`devtools.c` `sha256_write`: "BSWAP/DMA_SIZE accepted" but
  `sha256_bswap` never updated — stuck 1). Only pre-swapped word order
  yields the FIPS vector on this build.
- The digest engine itself is PROVEN REAL: same block via direct CSR
  yields `BA7816BF8F01CFEA…F20015AD` = FIPS 180-4("abc").
- Ask: fix the CSR bit positions + honor BSWAP writes. Our e2e cell
  (`pico2-periph` SHA, canonical API) goes green UNCHANGED.

### F2 — no runner→IN-latch inject export (BLOCKS GPIO-in/EXTI/IR-RX/DHT)

- `_picoemu_set_gpio` → `gpio_set_pin` writes the OUT latch only
  (`gpio.c`); the guest-visible IN latch (`SIO_GPIO_IN` reads it raw)
  is never updated (reset default all-HIGH; SIO IN writes ignored by
  design — correct silicon behavior). Every Pico input pin reads
  stuck-at-1: HIGH-only "proofs" pass by luck, LOW is impossible,
  external edges never reach IO_BANK0 (EXTI counts 0), DHT/IR models
  drive into the void.
- The engine HAS the right primitives (`gpio_set_input_pin` fires
  IRQs; `gpio_inject_level` silent) — none exported (103-symbol ABI
  checked: no input/inject/drive export).
- Ask: export one input-inject (e.g. `_picoemu_set_gpio_input` →
  `gpio_set_input_pin`). One export unblocks GPIO-in + EXTI + IR-RX +
  DHT-drive. Our specs assert both levels and stay RED until then
  (deliberately not weakened to HIGH-only).

### F3 — disabled-SM SM_INSTR forced exec dropped (minor, worked around)

- `pio_step` skips disabled SMs before servicing `exec_pending`, so
  `pio_sm_set_consecutive_pindirs` before `pio_sm_set_enabled` is lost
  (OE stays 0; headless: `out15=1 oe15=0`). Our PIO cell works around
  it with `gpio_set_dir(pin,GPIO_OUT)` (harmless on silicon: SIO OE is
  not muxed while function=PIO0) — documented in-spec. No owner action
  strictly needed, but immediate exec on a disabled SM should apply
  synchronously per silicon.

### F4 — repeated bare `_picoemu_reset()` wedges the guest (info only)

- `picoemu_reset` is cores-only. One reset after UF2 load boots fine,
  but repeated mid-execution resets wedge the guest (headless: 198
  resets → 1 boot; serial frozen). The sanctioned repeated-reboot path
  is the WDT TRIGGER bit → `picoemu_watchdog_reboot` (peripherals +
  cores re-init; headless M0: 209 triggers → 209 boots). Our runner now
  uses TRIGGER (see `pollPicoWDT`) — no owner action, recorded so the
  bare-reset limitation is not rediscovered.

### F5 — M33 TRIGGER reboot wipes the RP2350 ROM patch (BLOCKS M33 WDT)

- `picoemu_watchdog_reboot` → `reset_runtime_peripherals()` →
  `rom_init()` restores the RP2040-format ROM image WITHOUT re-applying
  `rom_patch_rp2350_arm()`. Headless proof on M33: ROM magic reads
  `RP v2` pre-reboot, `Mu v1` post-reboot; serial shows exactly one
  boot (BOOT/ARMED/SPIN) then silence — the guest dies on unpatched
  ROM. M0 is unaffected (no patch needed; 209/209 reboots).
- Ask: re-apply `rom_patch_rp2350_arm()` (and verify the M33 SRAM
  overlay + `rp2350_periph` state survive) in `picoemu_watchdog_reboot`.
  Our M33 WDT cells stay RED until then (M0 cells go green on TRIGGER).
