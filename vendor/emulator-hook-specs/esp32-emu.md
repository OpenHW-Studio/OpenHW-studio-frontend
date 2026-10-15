# esp32-emu — hook spec (for emulator agent)

Package: `esp32-emu 1.1.0` (npm). Our runner: `OpenHW-studio-frontend/src/worker/runners/esp32-runner.ts`.
Status: **blocked at the engine boundary** — the runner wires no I2C/SPI because there is nothing to wire to. This is the highest-value package: it unblocks the entire ESP32 peripheral row.

## What to add

1. **I2C slave tap** (mirror F1 semantics: `stm32f1-runner.ts:144-154` + `bus-bridge.ts:57-128`):
   - Observe: `onStart(addr, read)`, `onWrite(byte)`, `onStop`.
   - Respond: `onRead()` → byte to ACK back to firmware; NACK cleanly at unregistered addresses so `scan()` enumerates only attached models.
   - Registration: attach slave(s) at 7-bit address(es) per I2C peripheral (I2C0/I2C1), callable post-create like F1 (`mcu.i2c0.onStart = …`), not only at construction.
2. **SPI transfer tap** (mirror F1: `mcu.spi1.onTransfer` + `injectMiso`):
   - `onTransfer(bus, txBytes[]) → rxBytes[]`, or split `onTransfer` + `injectMiso(resps[])` — either, but document which; our bridge adapts.
   - Must fire per DR-write during `execute()`, same as F1, so transfer/GPIO ordering matches the proven path.
3. **GPIO-output readback + events** (fixes today's `sampleGpioOut → null` stub, `esp32-runner.ts:160-168`):
   - Fresh core-side level read per pin (output value, not input stimulus), direction + pull readback, and `on('change')`-style output events.
   - `setPinInput` (input-only today) stays as-is; this is the reverse direction.
4. **SAB worker-proxy slots**: extend the `CMD_*` enum (`dist/sab/worker-proxy.js:23-50`) with I2C/SPI/GPIO-out commands so the taps work in the Worker build, not just the main-thread build.

## Constraints

- Additive-only; ESP32 boot + serial + reset + GPIO-input cells pass today (`_onUART`/`pollUart`/`sendUart`/`setPinInput`/`pressResetButton`) — frozen behavior when taps are unregistered.
- No firmware-specific casing: Arduino and MicroPython guests must see identical tap behavior (same registers, same responses).

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

## Further surface (same agent — full protocol audit 2026-10,
verified against `dist/index.d.ts:54-129`)

Already present, runner-unwired (our side after hooks land):

5. **TWAI**: `sendTwaiFrame` + `getTwaiTx` is the ONLY full-duplex peripheral
   in the package — wire first, it proves the tap pattern end to end.
6. **ADC**: `setVoltageMv(mv)` is global (no channel/pin) — extend to
   per-pin/channel ADC inject for `analogRead` cells.
7. **PWM/LEDC-out**: absent — add duty/frequency readback for servo/LED cells.
8. **Touch**: `setTouchInput` (input-only) is enough for button cells — no change.
9. **I2S**: `feedI2SRX` (input-only) exists; TX-side tap is P2.
10. **MMIO backdoor**: `readMmio/writeUint32/readMemory/step/pc` exist —
    acceptable fallback substrate if a native tap is costly for any peripheral above.
11. PIO (n/a on Xtensa), OneWire (via GPIO timing + `setPinInput`, P1),
    SDIO, USB-device: P2 — no cells written yet.

## Future-component guarantee (signal-level contract)

Same invariant as the other specs: after §1–4 + §6–7, any future component
on GPIO / I2C-RW / SPI-duplex / UART / ADC-in / PWM-out / TWAI works with
zero further engine changes. I2C **read** + NACK-at-empty-address are
mandatory (sensor shelf + `scan()`); GPIO-out must broadcast every edge with
direction + pull (keypad/encoder/IRQ lines and the logic-analyzer part all
ride the same broadcast).

## Acceptance (our e2e, to be written after hooks land)

1. ESP32 SSD1306 OLED `vramFill > 0` via I2C (mirrors green F1/Pico cells, same `bus-bridge.ts` underneath).
2. ESP32 MAX7219 digits via SPI (mirrors F1 SPI cell).
3. Firmware-driven GPIO-out LED cell (pin level read back through SAB, no `null`).

Reference for the proven bridge side: `src/worker/bus-bridge.ts` (`createI2CBridge`, `createSPIBridge`, `isSPISelected`/`boardCsSelected`) — the engine only needs to supply the tap events; routing, framing and models already exist.
