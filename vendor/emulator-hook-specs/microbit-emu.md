# microbit-emu (nRF52833) hook spec — OpenHW runner contract

Engine: owner first-party folder `/home/danish1075/Documents/microbit-v2`
(`nrf52833-periph-wasm`, frozen v1 JS API per `demo/API.md`). Consumed
from exact paths (AGENTS.md engine-sourcing rule): the runner imports
`src/worker/engines/microbit/nrf52833_periph_wasm.js` (vendored copy of
`demo/pkg/`) + `public/wasm/nrf52833_periph_wasm_bg.wasm`; fixed
firmwares in `public/firmware/microbit/`. Flipping to npm is a root swap
in those two places.

## Lifecycle (runner-owned, `microbit-runner.ts`)

`reset_state()` → `i2c_register_slave("TWIM0", addr)` per discovered
slave (BEFORE init) → `init()` → `WasmCpu(sp, pc, 512K, 128K)` with
SP/PC from the image vectors → `load_firmware(bytes, 0x0)` →
`cpu.step(N)` + `tick_peripherals()` + EASYDMA pump every frame.

## Runner-owned pumps (no engine changes)

- UARTE TX: `uarte_take_txdma` → `mem_read` → `complete_txdma`.
- TWIM0 OLED: `twim_take_txdma` → bytes feed the shared I2C bridge
  (init stream lands in the SSD1306 model); `twim_take_rxdma` →
  model bytes → `mem_write` → `complete_rxdma` (DMA path never
  touches the `i2c_push_rx` polling queue — frozen-v1 contract).
- SPIM2 TX / SPIM3 RX: demo-parity loopback (mem_read/0xFF-fill).
- SAADC: 0x80 mid-scale fill (no ADC cell yet).
- GPIO: edge P0..P20 publish; `gpio_set_input` injects; matrix
  rows/cols feed board telemetry (`matrixLit`).

## Firmware kinds

Fixed `.bin` only (no backend core): board `firmware` attr URL +
`FIXEDBIN:` sentinel (compile bypass in `boardLoopPrologue.js`;
`programmableBoards` gates in `runPreflight.js`, `SimulatorPage.jsx`,
`hardwareUtils.js`, `protocol-routing.js` all include microbit|nrf52).
Images: hello (UARTE0), blinky (P0.21 matrix row + serial),
oled (TWIM0 SSD1306 init + status read), spim23 (SPIM2 TX + SPIM3 RX).

## Gaps (engine-side, filed)

- TWIM1 internal sensors, PWM cells (no fixture), SAADC live volts,
  UART RX inject, OVERRUN pacing — all future; current cells need none.
