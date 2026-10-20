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
- `tests/e2e/esp32-wifi-gateway.spec.js` + `tests/e2e/esp32-cam-wifi-gateway.spec.js`:
  STA join + gateway DHCP (`STATUS=3`, `IP=192.168.4.x`) — must stay green.
  **These cells also exercise the inline `CMD_GET_WIFI_STATS` servicing**: if
  the engine stops serving that command while `RUN=1`, the board worker
  wedges and the cell goes silent (UART frozen), not red-with-a-message.
