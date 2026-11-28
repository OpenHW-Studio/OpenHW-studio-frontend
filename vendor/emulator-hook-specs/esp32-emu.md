# esp32-emu — hook spec (for simulator runner)

Our runner: `OpenHW-studio-frontend/src/worker/runners/esp32-runner.ts` over
`esp32-emu@1.2.0` (`dist/sab/worker-proxy.js` `SimulatorWorker`, one logical
event fabric with separate delivery lanes; SAB is the observation/transport
plane — same contract as the other ARM runners).

## What to keep stable (used live, green)

1. **Boot**: `init('ESP32', { board, flashSizeMB: 4, mmuPages: 64,
   strapValue: 0x13, budget })` — chipType is ALWAYS `'ESP32'` (the
   worker's only constructor; anything else dies with "Unknown chip").
   The cam preset rides `config.board: 'esp32-cam'`, never chipType.
   Wasm + ROM bytes come from `/wasm/esp_engine_wasm.wasm` +
   `/firmware/esp32-v3-rom.bin` (fetched by the runner, handed in).
2. **UART**: `pollUart()` moves WASM-ring bytes to `_onUART`; `sendUart(ch)`
   injects. TX capture is global (`usart1.onData` + usart2 hook).
3. **I2C**: `attachI2cSlave(bus, addr)` both buses + `pollI2c(bus)` events
   (`start/write/read/stop`) + `pushI2cTx(bus, addr, [bytes])` prestage.
   Sensor over-reads fill `0xFF`; write-pointer + repeated-START reads work.
4. **SPI**: `injectMiso(bus, [])` arms capture-only observation;
   `pollSpiTx(bus)` drains MOSI (user buses 2/HSPI, 3/VSPI).
5. **GPIO-out**: `pollGpioChanges()` edges → `publishGpio` (both Rust
   paths: MMIO loop + matrix). No output readback (`sampleGpioOut`
   returns null by design — documented engine gap).
6. **GPIO-in**: `setPinInput(pin, level)` (async).
7. **ADC**: `setAnalogInput(pin, volts)` per-pin (CMD 37).
8. **LEDC**: `getLedc(ch) → { duty, freq, timer }` (CMD 38, integer-scale
   duty post-1.2.0 16x fix) + `getLedcPin(ch)` (matrix-reg scan, works
   mid-run). Resolution is NOT readable: normalize 8-bit-exact,
   monotonic otherwise.


## Network — the unified-gateway contract (PROVEN 2026-10-20)

**The engine dials the gateway ITSELF.** This is the one engine that does not
use the runner-side `GatewayLink`: the engine's worker entry opens the
WebSocket at boot (`connectGateway`, pre-open buffered) and speaks raw
Ethernet inside the virtual net. The runner only supplies the config and
reads the status back.

* Endpoint: `ws://127.0.0.1:5030/api/network-gateway`
* Room: `?sessionId=<room>`
* Virtual net `192.168.4.0/24`, gateway `192.168.4.1` (also the resolver),
  DHCP + gVisor DNS/NAT.

### What the runner passes and reads

```
init('ESP32', { board, flashSizeMB: 4, mmuPages: 64, strapValue: 0x13, budget,
                [cpuFrequency], wifi: { ssid, bssid, channel, room, gatewayUrl } },
     flash, rom)
```

(`board` is `'esp32'` or `'esp32-cam'` — the cam preset rides `config.board`,
never `chipType`. `cpuFrequency` is present only when a tick divider is set.)

`wifi` comes from the board attrs / run options (`sessionId` → the shared
room; `gatewayUrl` overrides the default endpoint; the engine defaults are
`ESP-GUEST` / ch 6 / `:5030`). The runner then polls `getWifiStats()`
(throttled to 2 s, gated on the first UART flow) and publishes `netUp` /
`netIp` on the board instance.

### THE HOST-SIDE WEDGE — the engine MUST service the stats CMD inline

The earlier red WiFi cell was **not** a guest stall. `getWifiStats()` posts
`CMD_GET_WIFI_STATS`; the SAB proxy busy-spins for `RESP_DONE`, but the
engine only serviced that command in `commandLoop`, **which never turns while
`RUN=1`**. The first stats poll therefore wedged the board worker
permanently: UART frozen, engine running unwatched — the guest looks dead.

* **Engine proposal (owner to merge): branch `wifi-fix`, commit `a0684ef`** —
  "Serve CMD_GET_WIFI_STATS inline while RUN=1". The command is serviced
  inline in `runSimChunk`, mirroring the `processCommand` case verbatim
  (`_syncWifiStatus` + status bridged into `readResp`). Read-only status
  mirror; no silicon behaviour invented.
* Until the owner merges it, the frontend carries the same change in its
  vendor mirror
  (`public/vendor/board-engines/esp32-emu/dist/sab/worker-entry.js`).
* The reported "guest stall at `0x400857b3`" was a **red herring** — literal
  pool data. It never reproduced once the wedge was removed.

**Contract for the engine:** every status command a host may poll while the
guest runs (`CMD_GET_WIFI_STATS`, and by the same argument the adjacent
`GET_LEDC` / `GET_TWAI_TX` blocks) must be serviced inline in the run loop,
not only in `commandLoop`. A host-side poll must never be able to wedge the
board worker.

### Proof cells (live, green)

* `tests/e2e/esp32-wifi-gateway.spec.js` — STA joins the AP and takes a
  **gateway** DHCP lease (`SCAN n=1`, `STATUS=3`, `IP=192.168.4.2`).
* `tests/e2e/esp32-cam-wifi-gateway.spec.js` — the same on the ESP32-CAM
  preset (`STATUS=3`, `IP=192.168.4.x`).

### Gateway expectations

* The **DHCP lease carries the resolver** `192.168.4.1` alongside `8.8.8.8`.
* A **static-IP guest has no lease and therefore no resolver** — it must set
  one explicitly (`WiFi.setDNS(...)`). Proven on Pico W; **not yet proven on
  ESP32**.
* **Room-aware `.1` arbitration**: a room member that claims `192.168.4.1` as
  a soft AP makes the gateway yield that address (gateway `main@151927d`);
  in such a room the gateway's own `.1` services (incl. the resolver it
  advertises) are unreachable from that room.
* The **DHCP pool is a global counter** (MAC-keyed, but the counter is shared
  by every room and board on the box and wraps at `.250`) — never rely on a
  fixed lease number.

### Still open on this engine

* **ESP32-CAM beyond WiFi**: only WiFi + DHCP are proven — no LAN TCP, no
  HTTP through the NAT for the cam preset.
* **`scanNetworks()` can hang when associated.** It works on a fresh STA
  (`SCAN n=1`, ~5 s) but stalls or returns `-2` when called after
  `WiFi.begin()` — see the P6 ask below. Cells that need a scan result scan
  **before** the join.
* `config.wifi` has **no declared shape** in the `.d.ts` — the runner passes
  it untyped, so a rename is silent.

## Owner ask — per-edge GPIO timestamps (P1, measured 2026-11-02)

**The gap.** `pollGpioChanges()` is the only GPIO-output edge channel and it
returns

```ts
pollGpioChanges(): Promise<Array<{ pin: number; level: number }>>
```

— **pin and level, no time**. The runner can therefore say *“GPIO5 went HIGH,
GPIO5 went LOW”* but never *when*. Every component that measures a pulse
width is blind:

* the HC-SR04 trigger (`digitalWrite(5,HIGH); delayMicroseconds(12);
  digitalWrite(5,LOW)`) drains both edges in the same poll, so
  `PulseProtocol.onPinStateChange` computes `durationUs = (t_low − t_high)/16
  = 0` and the model rejected the trigger (frontend now accepts a 0 width as
  “width unknown”, `openhw-studio-emulator` `4119e2d`);
* the ECHO window the model drives back is then scaled by a *guessed*
  steps-per-µs ratio. Measured today on a 25 cm target: `pulseIn(18,HIGH)` =
  **245 µs (4.2 cm)** with the AVR default of 16 steps/µs, and **3097 µs then
  2188 µs (53 cm / 38 cm)** when calibrated from `nanos` over the run —
  the ratio drifts with guest workload, so no stable distance is reachable
  from the frontend side. A calibration was implemented and **reverted** for
  this reason (it also shifts DHT/IR/LCD timing).
* the same gap blocks NEC IR decode (mark/space widths), servo-input decode,
  and any “measure the pulse the guest emitted” cell.

**Ask.** Timestamp each edge, in any monotonic base the runner can convert:

```ts
pollGpioChanges(): Promise<Array<{ pin: number; level: number; nanos: number }>>
// nanos = engine time at the moment the edge was latched (same base as
// `readonly nanos`), strictly monotonic across drains.
```

Contract we rely on:

1. **No coalescing**: both edges of a pulse ≥ 2 µs apart must appear, in
   order, even when the guest took many instructions between them. (Today a
   10–12 µs pulse does deliver two entries — only the time is missing.)
2. **Resolution ≤ 1 µs** (sub-µs welcome); the value may be coarse, but the
   *difference* between two adjacent entries of the same pin must be the real
   elapsed engine time, so a 12 µs trigger measures 12 µs ±10 %.
3. **Monotonic across drains** — one shared base, so an edge drained at
   poll N can be compared with an edge drained at poll N+1 (needed for echo
   windows that straddle a poll).
4. Idle cost stays one ring drain; a **dropped-edge counter**
   (`getGpioEdgeDrops(): number`) would let the runner detect a pump
   overflow instead of silently losing an edge.

A cycle counter instead of `nanos` is fine (`{pin, level, cycles}` with the
counter's own frequency documented) — we convert with
`cyclesPerMicrosecond()` in `esp32-runner.ts`.

**Runner work once delivered** (small, already mapped): `publishGpio` passes a
real stamp into `onPinStateChange(pinId, isHigh, boardCycles)` instead of the
shared poll counter, and `PulseProtocol` stops hard-coding `/16`. No component
changes are needed; the models already take `durationUs`.

**Acceptance cell** (`tests/e2e/esp32-sonar.spec.js`, to be written when the
tap lands): HC-SR04 at `attrs.distance` 25 / 50 / 100 cm must read back
`pulseIn(18,HIGH)` = 1469 / 2938 / 5876 µs ±2 % for three consecutive reads,
and an NEC frame on GPIO from `openhw-ir-remote` must decode to the remote's
ADDR/CMD.

## Owner ask — LEDC duty resolution in `getLedc` (P2, measured 2026-11-02)

`getLedc(ch)` returns `{ duty, freq, timer }` where `duty` is the driver's
**raw count** and the configured resolution (`ledcAttach(pin, freq, res)`) is
not reported anywhere: `native_ledc_*` exports are duty/freq/timer/pin only,
and the LEDC register block reads 0 through `readMmio` (GPIO matrix reads
work, LEDC does not — checked hid 0..10 at `0x3FF590A0`/`0x3FF59008`).

Consequence for a PWM consumer: a duty count alone is ambiguous (192 is 75 %
at 8-bit, 2.3 % at 13-bit). For an RC servo the runner has to *infer* the
resolution from the 0.4–2.6 ms pulse band — exact when the count is large
(16-bit firmware, 4915 → 1500 µs → **92.7°**, working today) and undecidable
for small counts, where the servo must ignore the sample instead of reporting
a wrong angle.

**Ask:** add `res` (bits) — or `dutyMax` — to the `getLedc` reply:

```ts
getLedc(channel: number): Promise<{ duty: number; freq: number; timer: number; res: number }>
```

One line in the WASM facade (`native_ledc_get_res` over the timer config is
enough). Then `esp32-runner.ledcDutyRatio()` returns the exact ratio for
every PWM consumer and the band heuristic can be deleted.

## Owner ask — RMT TX actually transmits, and tap returns the frame (P3, measured 2026-11-02)

NeoPixel (WS2812) is dead on the classic ESP32 because the RMT model never
emits more than one symbol per TX, and the TX capture then reports a word
that was never written by the guest.

Measured with `Adafruit_NeoPixel(8, 4, NEO_GRB+NEO_KHZ800)` (core 2.x
legacy RMT driver, `rmt_config` clk_div 2 → 40 MHz, `rmtWrite` of 192
items):

* every `show()` yields exactly **one** word from `pollRmtTx(0)` (237 shows
  → 237 words over one run), so no frame ever reaches the host;
* a hand-built 6-item burst (`d0 = 100+i*10, l0 = 1, d1 = 50, l1 = 0`)
  returns `words=6`, but the first captured word is `0x00050180`
  (`d0=384, l0=0, d1=5, l1=0`) while the guest wrote `0x00328064`
  (`d0=100, l0=1, d1=50, l1=0`) at the channel's RAM start — the capture
  (and the TX stream) read a different RAM offset than the guest wrote;
* `SimulatorWorker.readMemory(0x3FF56800, 96)` returns an empty array, so
  the host cannot recover the frame from RMT MEM either.

Two concrete defects in `engine-wasm/src/peripherals/common/rmt_rng_math.rs`:

1. `write_conf0()` reads MEM_SIZE with the **v2/S3 CH0CONF0 layout**
   (`(cpu_val >> 24) & 15`). On the classic ESP32 (v1) the field is
   `CONF0[11:8]`, so `mem_size` becomes 0 and `transmit_next()` calls
   `transmit_done()` after the first symbol (`tx_offset=2`, captured
   `nwords = tx_offset/4 + 1 = 1`). That is the one-word-per-show result.
2. `transmit_done()` captures from `mem_start` but the driver writes its
   items through the APB data window (`RMT_CHnDATA`, `+0x400 + ch*4`); the
   two do not agree for channel ≠ 0 (and for ch 0 in the burst test above).

**Ask:**

* MEM_SIZE for the classic (v1) register layout = `CONF0[11:8]`, with the
  v2 layout kept for v2 chips (the `self.config.v2` split already exists);
* capture exactly the words the guest wrote for this TX (same base the
  driver used), i.e. `nwords = tx_offset/4 + 1` from that base;
* lift the **65-word cap** (`core::cmp::min(..., 65)`): a 2-pixel frame is
  49 words, a 3-pixel frame is 73 — anything beyond two LEDs is truncated
  today. 4096 words (the JS queue bound) is enough for a 170-pixel strip;
* optional but cheap: make `SimulatorWorker.pollRmtTx(ch)` return the
  `{ch, items, tickHz}` groups the `RmtTap` class already produces (the
  d.ts promises `number[]` for the worker and groups for the tap). The
  runner normalizes both shapes today, so this is not blocking.

Frontend side is ready and waiting (`src/worker/runners/rmt-neopixel.ts`,
8 unit tests covering both clock rates, WS2811 timings, GRB→RGB and split
frames; wired into `pollRmtTxHost`). No runner change is needed once the
tap returns a real frame.

## Owner ask — pad pull-up and output readback reach `digitalRead` (P4/P5, measured 2026-11-03)

Two pad-model facts make ordinary Arduino input code read wrong on the DevKit.
Both are host-visible from the guest (`digitalRead`) and both are in the pad
model, not the runner.

**P4 — internal pull-up is configured but never drives the input value.**
Circuit: `GPIO4 → pushbutton 1l`, `GND → 2l`, sketch `pinMode(4, INPUT_PULLUP)`
+ `digitalRead(4)`.

* idle (button open) reads **0**, pressed reads **0** — the pin never goes HIGH;
* the same circuit with an **external 10 kΩ to 3V3** reads 1 idle / 0 pressed,
  so the switch, the net and the input pump are all fine.

`gpio_core.rs` has `internal_pull_up` (`PAD_DRIVER`/`FUN_PU`, set by
`pinMode(INPUT_PULLUP)`) and `update()` does fold it into `PinState::PullUp`,
but `set_pin_input_value()` (line 745) only stores `input_value_raw` and then
gates the `input_values` write on
`pins[i].input_value(&self.input_values) != input_value_raw`. With no external
driver the pad keeps reporting `Input`/0, so the raw 0 from the host pump wins
forever.

**Ask:** when a pin has `internal_pull_up` (or `rtc_pull_up`) set and no
external driver is attached, `digitalRead` must follow the pull state (HIGH);
same for pull-down → LOW. That is the silicon behaviour every sketch relies on
(`INPUT_PULLUP` + switch to GND is the default wiring in the Arduino docs).

**P5 — a pin driven as OUTPUT always reads back 0.**
Sketch: `pinMode(2, OUTPUT)` and `Serial.println(digitalRead(2))` alternating
`digitalWrite`. The guest prints `0` for both levels (`esp32-inputs.spec.js`,
cell marked `test.fixme` with this ask). On silicon the pad loopback shows the
driven level.

**Ask:** feed the driven output level into the input register for the same pad
(the GPIO matrix's `gpio_in` mux already selects the pad; the pad value just
needs to be the driven level when `gpio_output`/`open_drain` is active).

Impact while open: `matrix.md` keeps GPIO-in at **FULL for externally pulled
nets** (rails, switch wiper, keypad, joystick) and names these two gaps
instead of papering over them. Workaround used by the cells: external 10 kΩ
pull-up; do not rely on `INPUT_PULLUP` or output readback.

## Owner ask — `scanNetworks()` stalls once the station is associated (P6, measured 2026-11-03)

**What works.** A fresh station scans fine. `WiFi.mode(WIFI_STA);
WiFi.disconnect(); delay(200); WiFi.scanNetworks()` returns `SCAN n=1` in
~5 s wall against the gateway — the engine's internal AP answers, the driver
collects the result. `esp32-wifi-gateway` now asserts `SCAN n>=1` in that
position.

**The gap.** Issue the same call AFTER `WiFi.begin()` + association and it
stalls the guest (no UART for minutes; only `stop()` recovers) or returns
`SCAN n=-2` (`WIFI_SCAN_FAILED`). Reproduced 3x on 2026-11-03 (first run of
`esp32-wifi-gateway`, `esp32-cam-http-gateway`, and a probe that did
mode+disconnect immediately before the scan) on top of the coverage lane's
2/5 earlier. Join, DHCP, ARP and NAT HTTP are unaffected — `STATUS=3` and
`IP=192.168.4.x` are correct on both sides of the stall.

**Where it is not.** The scan RPC in the engine
(`engine-wasm/src/peripherals/common/hosted.rs`: `start_scan()` ->
`on_schedule_scan_complete` -> `complete_scan()`) is **dead code**:
`EspHostedDevice::new()` has no caller anywhere in the crate and
`complete_scan()` has no caller but that never-assigned callback. That module
is not the live path and editing it changes nothing (verified by inspection,
2026-11-03). The live path is the internal AP model
(`peripherals/common/wifi_bridge.rs`, `NativeInternetAP`, 10 Hz beacons from
`native_wifi_ap_send_beacon`), which works pre-join.

**So the defect is in the associated-state path**: either the station stops
receiving beacon/probe frames once connected, or the driver's scan-while-
connected state never gets its completion. Both are engine-side.

**Acceptance.** `WiFi.scanNetworks()` returns in bounded time both before and
after association and reports >= 1 network while the engine's AP is on the
air; the post-join scan then joins `SCAN n>=1` in the cell's assertions.

## Owner ask — speed: no JIT in the pinned bytes, and `cpuFrequency` is not a speed control (P7, measured 2026-11-03)

**Resolved 2026-11-04 — clock presets ship.** The model was ported onto the
pinned baseline and both blockers were root-caused. The app now carries the
rebuilt wasm (`f860d5a7`) with the clock model in both `worker-entry.js`
copies, and the board context menu exposes 160/80/40/20/8 MHz (attr `tickMHz`
→ init `cpuFrequency`).

- “80 MHz never boots” was not the clock. The backend returns an Intel HEX
  artifact and the runner only base64-decoded it, so `atob` threw and the ROM
  sat in download-mode with `flash[0]=ff`, `PC=0x4000fcac`, `inst=1024`,
  `nanos=64000`, zero serial. `intelHexToU8()` now parses `:` images.
- The 8 MHz `delay()` cost was the run-loop yield: `setTimeout(0)` clamps to
  ~4 ms, and a 2 s delay paid ~2,800 yields (~11 s). The loop now yields via
  a MessageChannel macrotask — busy every 512 steps, idle every 2048 — which
  still services worker/WebSocket traffic without the clamp.

Final `esp32-speed` (loops are the firmware's own count per GUEST second;
`delay` is 2000 guest-ms of FreeRTOS ticks):

| preset | loops/guest-s | guest/wall | delay(2000) wall | pace pill |
|---|---|---|---|---|
| 160 (native) | 32.4M | 0.057 | 330 ms | 0.08 |
| 80 | 16.2M | 0.211 | 382 ms | 0.50 |
| 40 | 8.1M | 0.497 | 450 ms | — |
| 20 | 4.05M | 0.960 | 775 ms | — |
| 8 | 1.62M | 2.42 | 1.06 s | 1.23 |

`esp32-pwm` at 8 MHz passes (duty 192 reaches the LED). Scaling is exactly
160/preset; APB 80 MHz and RTC 32.768 kHz stay absolute. The engine patch
stays uncommitted in the owner's repo (`tests/tmp-clk-model.patch`, baseline
`c03f3927`) pending owner sign-off; the app ships only the rebuilt wasm.

**Known engine limitation (pre-existing, not preset-specific).** During idle
fast-forward, `millis()`/esp_timer runs ahead of `xTaskGetTickCount()` (~6x
at 160 MHz; the gap scales as 160/clock). It reproduces on the pinned baseline
at the default clock; `delay()` itself is tick-accurate and was not changed.

The 2026-11-03 investigation below is kept for history.

**Measured (cell `esp32-speed`).** Compute-bound guest code runs at ~0.06x
wall: 32.4M volatile increments per GUEST second (7.4 cycles/iteration at
240 MHz, so the guest clock is honest) but 1.85M per WALL second. `delay()`
waits are fast-forwarded (~1.2x wall), which is why delay-driven sketches
feel real-time. No frontend knob can change this: the ESP32 core is
free-running inside the worker (`stepBudget` only pumps peripherals), so the
runner cannot grant it more cycles per tick.

**The board Clock preset is not a speed control *in this engine*.** `tickMHz`
rides init `config.cpuFrequency`, and the engine applies `nanosMultiplier =
native/target` to the REPORTED SAB nanos only. Its own timebase is fixed:
`recompute_clock()` derives nanos from the cycle counter at 160 MHz whatever
the configured CPU clock, so lowering the preset does not reduce the cycles
executed per guest second — it only changes the number the guest reads back.

That is the opposite of how a faithful emulator does it. `esp32sim`
(mikroverk/esp32sim, `docs/esp32.md` "Clock model") binds bus time to a fixed
240 MHz reference and lets SOC_CLK_SEL/CPUPERIOD_SEL choose 40/80/160/240 MHz,
i.e. the CPU clock decides **how many CPU cycles run per unit of time**. That
is why a lower clock helps there (and in Wokwi): a sketch that pegs the CPU
covers a guest second with `clock` cycles, so a fixed guest-time window (a 10 s
measurement, a 2 s burst) costs 8M cycles/s at 8 MHz vs 240M at 240 MHz — some
30x less wall time for the same guest span, while a fixed instruction count
costs the same either way. Idle already fast-forwards, so delays do not change.
Their speed headline still comes from a JIT ("about 30 times faster than real
time"), not from the clock.

**Re-measured 2026-11-03, after the frontend bug was fixed.** At 40 MHz the
board boots and runs normally (`setup` in 6.2 s vs 5.0 s native, `P-SETUP` and
`P-LOOP` both present). The earlier "zero guest serial at any preset" result was
**not** the engine: the runner injected an `ESP32CLK:div=N` marker into the same
TX queue as UART bytes and counted that queue as proof-of-life, so it stopped
re-posting RUN before the core ever started (PC frozen at `0x40000400`, `inst=0`).
Liveness is now retired instructions only.

With the preset actually running, the numbers settle the question:

| preset | loops/guest-s | loops/wall-s | guest/wall | `delay(2000)` wall |
|---|---|---|---|---|
| native (160) | 32.4M | 1.85M | 0.057 | 1805 ms |
| 40 MHz | 32.4M | 1.85M | 0.057 | 1805 ms |
| 8 MHz | 32.4M | 1.05M | 0.032 | 2479 ms |

Loops per GUEST second is identical at all three presets — the guest's own
`millis()` and timers do not follow `cpuFrequency`, confirming the fixed
160 MHz timebase. What does follow it is the pace pill (EMA of `sim.nanos`:
0.441 at 40 MHz vs 0.081 native), i.e. the reported number moves while the work
done does not. At 8 MHz the misalignment costs ~43% of wall throughput and
`delay()` gets slower, because the idle fast-forward over-advances virtual time
against a counter it cannot actually run slower. **So at the time there was no honest preset
to ship: it would either be a lie (reported time) or a regression (8 MHz).
The attr path stayed dormant and the context menu kept the presets removed
until the resolution above.

**What would make the preset real (engine).** Make the CPU clock decide cycles
per unit time as esp32sim does: one guest second at 8 MHz = 8M cycles, at
240 MHz = 240M. With this host at ~9M instructions/s that turns 0.055× into
~1.1× at 8 MHz. It touches timer/UART/LEDC/ADC timing derivation, so it needs
an owner pass plus a regression sweep, not a frontend knob.

**Implemented on the pinned baseline (2026-11-03, engine worktree).** The model
above now exists as `tests/tmp-clk-model.patch` in the engine repo (untracked,
not committed). It was written against `c03f3927` — the commit whose wasm is the
pinned `d6d17d79`, which rebuilds byte-identically here in 11 s — so it applies
to the bytes this app actually ships. Changes: a `CLK_CPU_HZ` static plus a
`native_set_cpu_hz(hz)` export, `recompute_clock()` divides by the CPU clock
while APB/RTC keep their absolute frequencies, `native_fast_forward()` converts
nanos→cycles at the CPU clock, and the worker sets it from `config.cpuFrequency`
with `nanosMultiplier` removed (that double scale was what moved only the
reported number). Native is unchanged: 32.4M loops/guest-s, delay 1813 ms.

At 8 MHz the model delivers the intended effect: loops per GUEST second 32.4M
→ 1.62M (1/20) and compute-bound code at **1.02 guest-s per wall-s** (0.056
before). Two defects block shipping a preset:

1. `delay(2000)` costs **14.1 s** wall at 8 MHz (1.8 s native): with 8k CPU
   cycles per 1 kHz tick the tick/scheduler work saturates the core, the idle
   fast-forward never runs, so the wall-time win is compute-only.
2. 80 MHz never boots — zero serial in 480 s, `D0`/`D1` absent, while 8 MHz
   boots. Cause not isolated; the boot-time clock-switch poll versus the guest
   timebase is the suspect.

**Superseded 2026-11-04**: the app now ships the patched wasm and exposes the
Clock presets; the engine patch itself is still uncommitted in the owner's
repo. The two blockers above were the Intel HEX artifact and the clamped idle
yield, not the clock model.

**The real lever is the JIT, and it is not in our bytes.** Upstream HEAD ships
the page-JIT tier (CHANGELOG: 230-540 MIPS, `jitBoot` 12M-instruction warmup,
`jitPage` default). The pinned worker (md5 `4afe24dd`, wasm `d6d17d79`)
contains **no `jit` symbol at all** — it predates the tier. A build of owner
HEAD (`npm run build`; worker-entry 11548 lines, wasm `0f54edd2`) does not
reach the worker's `[WASM-INIT] READY` under `esp32-runner.ts`: the runner
logs `[WASM] ESP32 engine (wasm) initialized` and then no serial ever appears.
So the upgrade is an integration pass, not a file swap; the working bytes were
restored unchanged.

**How far the JIT build actually gets (measured 2026-11-03, native clock).**
A probe board with `cmdTrace: '1'` (= the runner's `[ESP32-DIAG]` line) shows
the pinned and HEAD builds side by side:

| | pinned `4afe24dd` / `d6d17d79` | owner HEAD `npm run build` / `0f54edd2` |
|---|---|---|
| peripheral init | all `[WASM] … init OK` | all `[WASM] … init OK` (same) |
| worker `ready` | `[WASM-INIT] READY entering commandLoop` | runner logs `initialized`, so `ready` did arrive |
| guest executes | yes | **yes** — 281–325 boot bytes queued in the UART ring |
| runner pump | ticks keep coming (19+), `alive=true`, `emitted=342` | **one tick**, then silence: `alive=false queued=325 emitted=0 ticks=1` |
| guest serial in UI | `ets … / P-SETUP / P-LOOP` at 4.9 s | **none**, for 90 s |

So the bytes are not broken: the engine's own `tests/test-package-smoke.mjs`
passes on this exact build in Node (bundle boots, core0 PC in ROM). What
differs is the **browser worker's run loop**: it stops servicing timers after
the first chunk, which kills the runner's `setTimeout` pump (that pump is what
moves bytes from the WASM ring to the UI) and with it every later CMD.

**Rejected hypothesis, for the record.** The HEAD build yields through
`MessageChannel` when `setImmediate` is absent (every browser; Node has it,
which is why the smoke test is green). Chrome prioritises MessageChannel tasks
over timers, so this *looked* like the cause. Forcing `_yieldCh = null`
(`yieldMacrotask` → plain `setTimeout(0)`) changed the progress slightly
(325 → 281 queued bytes) but the worker still wedged after one pump tick.
A cooperative-yield scheduling bug would have moved the needle; it did not, so
the stall is **synchronous inside `runSimChunk`** — a JIT-compiled window that
never returns control (or jumps somewhere that spins). That is engine-side.

**Acceptance.** Either (a) the pinned build gains an execution-scale knob that
the governor does not read as time travel, or (b) a JIT build that boots and
runs under `esp32-runner.ts`, proven on `esp32-speed` (guest/wall must rise
well above 0.06) plus `esp32-wifi-gateway` and `esp32-displays`, with the new
md5s recorded in `src/engines/esp32-emu/README.md`.

## Signal-level guarantees

- `reset()`-family reinstalls a fresh model synchronously; instruction
  clock is monotonic; DUTY register format is driver `<<4` (tap reports
  integer scale — see LEDC fix).
- v3 pin API (`ledcAttach(pin,freq,res)` + `ledcWrite(pin,duty)`) funnels
  through IDF set+update; the START-only 1/1/0 pattern latches DUTY
  (not a fade) — locked by `test-taps-host.mjs` v3 case.

## Known limits (documented, no runner work)

- ESP32-CAM **is** a bootable board now (updated 2026-10-20): the
  `boards-registry.ts` entry `family: 'esp32_cam'` exists and
  `openhw-esp32-cam` resolves to it, so the runner boots it on the
  `esp32-cam` preset (4 MB flash + 4 MB PSRAM) instead of dying on
  "Unknown chip: esp32-cam". The WiFi + DHCP cell
  (`tests/e2e/esp32-cam-wifi-gateway.spec.js`) is green. **Beyond WiFi the
  cam preset is not proven**: no LAN TCP, no HTTP through the NAT.
- The camera/OV2640 tap is **wired and green** (the 2026-10-07 "no camera
  tap" note is retired): the engine ships `Ov2640` + `armCamera` /
  `pollCameraFrame`, and our runner-side pump
  (`src/worker/runners/esp32-camera-pump.ts`) drives it. Cell:
  `tests/e2e/esp32-camcell.spec.js` ("ESP32 captures QQVGA frame via OV2640
  model"). `RmtTap` is likewise delivered (RMT-DHT contract below).
- Ticks are ~1/sec in the browser worker and Arduino boot is slow —
  LEDC config lands near the tail; PWM cells need ≥120 s windows.
- Unclaimed-SPI MISO reads 0x0 (fine for write-only devices).
- RMT-DHT contract (delivered engine d5d161b, runner-owned pump):
  firmware drives DHT22 with the RMT peripheral (Arduino HAL
  `rmtInit/rmtWrite/rmtRead`); runner preloads the 42-word sensor
  response on all channels at boot (`injectRmtRx`, pending delivers
  on next RX_EN arm) and re-injects on every captured start pulse
  (`pollRmtTx` match 1100µs-low/30µs-high). Bit-bang DHT is out of
  scope on ESP32 (µs windows vs slow engine) — RMT is THE path.

## Acceptance

- `test-taps-host.mjs` green (154 checks incl. v3 LEDC case);
  `wasm-bench` + `test-wasm-standalone` pass.
- ESP32 cells: devkit hello TX, I2C OLED, SPI MAX7219, ADC pot,
  LEDC LED must stay green.
- Pulse-width cells stay PARTIAL until the per-edge timestamps above land:
  `pulseIn` on an HC-SR04 ECHO is 0 µs / workload-dependent, so the sonar
  cell is not part of the green set yet (`matrix.md`, ESP32 component table).
- `tests/e2e/esp32-wifi-gateway.spec.js` + `tests/e2e/esp32-cam-wifi-gateway.spec.js`:
  STA join + gateway DHCP (`STATUS=3`, `IP=192.168.4.x`) — must stay green.
  **These cells also exercise the inline `CMD_GET_WIFI_STATS` servicing**: if
  the engine stops serving that command while `RUN=1`, the board worker
  wedges and the cell goes silent (UART frozen), not red-with-a-message.
