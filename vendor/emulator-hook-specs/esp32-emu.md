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

## Signal-level guarantees

- `reset()`-family reinstalls a fresh model synchronously; instruction
  clock is monotonic; DUTY register format is driver `<<4` (tap reports
  integer scale — see LEDC fix).
- v3 pin API (`ledcAttach(pin,freq,res)` + `ledcWrite(pin,duty)`) funnels
  through IDF set+update; the START-only 1/1/0 pattern latches DUTY
  (not a fade) — locked by `test-taps-host.mjs` v3 case.

## Known limits (documented, no runner work)

- ESP32-CAM is NOT a bootable board: `boards-registry.ts` deliberately
  excludes `openhw-esp32-cam` from the esp32 family (camera component
  shell). The runner honors `board:'esp32-cam'` if one ever arrives;
  the engine boots it byte-identically to devkit. A cam board family
  entry is UI-registry ownership.
- No camera/OV2640 tap: I2S-camera DMA plumbing exists engine-side, but
  no SCCB sensor model, no frame source, no SAB camera API.
  (STALE 2026-10-07: engine now ships `Ov2640` + `armCamera`/`pollCameraFrame`
  + `RmtTap` — camera + RMT-DHT cells are ours to write.)
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
