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

## PROVEN since the first version of this spec (2026-10-20)

Three gaps listed below are now **closed** (cells green):

* **UART RX** — `tests/e2e/microbit-uart-rx.spec.js`. The root cause was
  **our wiring**, not the engine: `ArmEngineHooks.injectUartByte` was never
  implemented by the micro:bit engine, so every byte the host handed us
  (serial console / inter-board UART) was dropped. The runner now queues RX
  bytes (bounded at 256) and drips **one byte per frame**, paced on
  `EVENTS_RXDRDY` (`0x40002108`) — the engine's RXD holds a single byte, so
  a second arrival before the firmware reads RXD latches a real OVERRUN and
  the byte is lost. The byte is also mirrored into the RXD EasyDMA ring
  (`RXD.PTR` + `RXD.AMOUNT`) so DMA-mode firmware receives it too. We never
  early-complete a staged RX DMA transfer (that fires ENDRX with no re-arm
  and the input stalls).
* **SAADC (AIN0)** — `tests/e2e/microbit-saadc.spec.js`. The dead ADC path was
  also **our wiring** in three parts: the runner never populated
  `compAttrById` (so every board-attr path was dead code), the runner had no
  rail power (a component wired to 3V3/GND saw 0 V), and the SAADC pump
  wrote a constant `0x8080` fill. It now converts the sampled pin voltage
  into SAADC counts and writes the sample into RESULT RAM before completing
  the transfer (scale: internal 0.6 V reference, gain 1/6 → 3.6 V full
  scale, 12-bit → 0..4095).
* **PWM0** — `tests/e2e/microbit-pwm.spec.js`, using the owner's P164
  readback gear (`pwm_get_duty` / `pwm_get_freq_hz` /
  `pwm_observe_seq_word`): the runner reads `SEQ[0].PTR` / `SEQ[0].CNT`,
  pulls the compare word from guest RAM, feeds it to `pwm_observe_seq_word`,
  reads the duty/frequency back and pushes the duty to the LED model **on
  that net only** (`PSEL.OUT` → pin), publishing `pwmDutyBp` / `pwmFreqHz`
  on the board telemetry.

## Gaps (engine-side, still open)

- **TWIM1 internal sensors** (temperature, etc.) — not modelled.
- **Capacitive touch** — not modelled.
- **SPI displays** — not modelled.
- **NVMC NVS** — not modelled.
- **PPI / GPIOTE** — not modelled.
- **RNG / TEMP** — not modelled.
- **MicroPython for micro:bit** — no MicroPython image in the pipeline (all
  micro:bit guests are fixed `.bin` firmware today).
- **EASYDMA / memcpy cell** — the DMA path is exercised (UART RX mirror,
  PWM SEQ readback), but there is no dedicated EASYDMA/memcpy proof cell
  yet.
- **OVERRUN pacing** — the runner's one-byte-per-frame drip works around
  the single-byte RXD; a bulk-inject API would remove the workaround.
