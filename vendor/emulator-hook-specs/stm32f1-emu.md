# stm32f1-emu — hook spec (for emulator agent)

Our runner: `OpenHW-studio-frontend/src/worker/runners/stm32f1-runner.ts`.
Status: **no changes required** — this package is the reference implementation. This doc pins the contract so it is not regressed.

## What to keep stable (used live, green)

1. **I2C1 observation hooks** (per-bus, post-create, address-independent):
   `mcu.i2c1.onStart / onWrite / onRead / onStop` — plain settable properties observing all I2C1 traffic.
2. **SPI1 transfer tap**: `mcu.spi1.onTransfer(ch, tx[], rx[])` per DR-write, plus `mcu.spi1.injectMiso(resps[])` queuing MISO for the next clocks.
3. **GPIO**: `mcu.gpio.pin(port, n)` with `.read()` (fresh core-side level), `.setInput()`, `.setAnalog()`, and `on('change')` events.
4. **Package virtual devices**: `ext_devices: { i2c_oled, i2c_eeprom }` at create (`stm32f1-runner.ts:326-340`).
5. **UART**: `usart1/usart2.onData` + `.send()`.

## Optional improvement (runner works around it today, engine closed it)

Engine 3.3.0 proves per-batch GPIO-before-transfer ordering
(`test_stm32f1_ordering.mjs` 9/9: pin drain lives inside `step()`).
Our runner pre-publishes core CS + dedups to compensate — stays
compatible (dedup is idempotent), no engine change needed.

GPIO `change` events currently dispatch **after** the `execute()` batch, while `onTransfer` fires **during** it — so CS sampled mid-transfer reads stale. Our runner pre-publishes core CS + dedups to compensate. If cheap: deliver `change` callbacks synchronously as instructions retire, or guarantee post-step GPIO drain runs before the next step's transfer callbacks. Not urgent — do not refactor at the risk of this green path.

## Further gaps (same agent — full protocol audit 2026-10, closed 2026-10-06)

Package classes include DMA/GPIO/GPIOPin/I2C/SPI/STM32F1/USART plus
ADC (`setVoltage`/`setCode`) and TIM (`enabled`/`duty`/`frequency`,
new `TIM.pin(ch)` returning the output pin with live AFIO remap).
Runner wires ADC inject + TIM duty observe; I2C2 remains unwired
(engine has i2c2/i2c3).

1. **ADC inject** (DONE runner-side): per-channel voltage via
   `adc1.setVoltage`; ADC3 completion-number fix landed engine-side.
2. **PWM/timer-out observe** (DONE runner-side for LEDs): `TIM.duty`
   into LED brightness; `TIM.pin(ch)` available for future
   servo-angle routing.
3. **I2C READ is observe-only — bridge-mode sensor reads need
   pre-queued `injectRx`** (engine `i2c.rs`: byte consumed in-Rust at
   DR-read, event pushed after; runner `onRead` return is discarded).
   Runner-side pre-queueing at `onWrite` time is the future sensor
   path; the runner's zero-filled `i2c_eeprom` ACK-sink currently
   answers sensor addresses with sink zeros. Write-only cells
   unaffected.

## Future-component guarantee (signal-level contract)

Same invariant as the Pico spec: after §1–2, any future component on GPIO /
I2C-RW / SPI-duplex / UART / ADC-in / PWM-out works with zero further engine
changes. I2C **read** is mandatory, not optional — every I2C sensor in the
registry (MPU6050, BMP180, ADXL345, DS1307, EEPROM, PCA9685) reads.

## Acceptance

- `tests/e2e/stm32-i2c.spec.js` ("Blue Pill" cells): OLED `vramFill` + LCD `Hello` — must stay green.
- `tests/e2e/stm32-spi.spec.js`: MAX7219 digits — green after runner-side ordering fix; engine changes must not alter transfer/edge counts (today: 10 transfers, 9 GPIO fires).

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
