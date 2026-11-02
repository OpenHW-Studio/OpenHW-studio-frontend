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
* **`scanNetworks()` can hang.** It is a blocking call that intermittently
  never returns on this engine (reproduced 2/5 runs by the coverage lane).
  Cells that need a scan result must scan **after** their proof markers.
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
