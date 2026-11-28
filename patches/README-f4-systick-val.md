# F4 engine patch — `SysTick->VAL` must be a down-counter (sub-millisecond `micros()`)

**Status:** proposed, NOT applied. The engine repo is read-only for this lane;
apply it in the owner's tree, rebuild the wasm, and the F4 1-Wire (DHT22)
cells can go green.

* Target file: `stm32-periph-wasm/src/peripherals/systick.rs`
* Target tree state: the owner's working copy as of 2026-10-20
  (`git apply --check` passes against that file — see "Apply" below).
* Patch: `f4-systick-val-downcounter.patch` (this directory).
* Measured against the **deployed** engine bytes the e2e cells run:
  * glue `public/vendor/board-engines/stm32f4-emu/site/vendor/stm32_periph_wasm.js` — md5 `19a9630175082fab610c8685e8aad7cb` (identical to npm `stm32f4-emu` 1.6.0)
  * wasm `public/wasm/stm32_periph_wasm_bg.wasm` — md5 `9455e31cdbb2295697db81e49ec4119e`
  * (npm ships a different wasm, md5 `7ef32e3f38cc56a19a12581d91d21618`, with the same glue —
    **do not mix the two**.)

## The gap (measured, not guessed)

`SysTick->VAL` (`0xE000E018`) is **not modelled as a free-running
down-counter**. The model latched a toggle and returned `LOAD` on even
reads and `CVR` (0) on odd reads:

```rust
0x08 => {
    self.val_toggle = !self.val_toggle;
    if self.val_toggle { self.cvr } else { self.rvr }
}
```

Silicon (RM0090 §4.4.1 / Cortex-M4 System Timer): `VAL` counts down from
`LOAD` to 0 and reloads at the next tick.

Why that matters: the STM32duino core derives the **sub-millisecond part of
`micros()`** from `SysTick->VAL`
(`libraries/SrcWrapper/src/stm32/clock.c`, `getCurrentMicros()`):

```c
uint32_t getCurrentMicros(void)
{
  uint32_t m0 = HAL_GetTick();
  __IO uint32_t u0 = SysTick->VAL;
  uint32_t m1 = HAL_GetTick();
  __IO uint32_t u1 = SysTick->VAL;
  const uint32_t tms = SysTick->LOAD + 1;
  if (m1 != m0) return (m1 * 1000 + ((tms - u1) * 1000) / tms);
  else          return (m0 * 1000 + ((tms - u0) * 1000) / tms);
}
```

With the toggle model the fraction term is only ever `0` or `1000`, so
`micros()` degenerates into a **1 ms-quantised** clock that alternates
between `m*1000` and `(m+1)*1000`.

### Measured on the deployed bytes (F407, DISCO core, `LOAD = 167999`)

Probe sketch (raw `0xE000E010 + 0x08` reads + `micros()` deltas), run on
`openhw-stm32f4`:

```
SysTick->LOAD            = 167999            (168 MHz / 1000 - 1 — correct)
SysTick->VAL x8          = 0,167999,0,167999,0,167999,0,167999
micros() - micros()      = 0
micros() over delayMicroseconds(500) = 0
micros() over a 200K-iteration busy loop = 8000
```

For reference, the same probe on the F1 Blue Pill (whose DHT22 cell is
also RED) reads `VAL = 0` on every read — i.e. `micros()` is 1 ms
quantised there as well.

### Consequence

Every protocol that times **sub-millisecond slots with `micros()`** is
undecodable on this engine:

| protocol | slot | why it fails |
|---|---|---|
| DHT22 (1-Wire) | 26 µs low / 70 µs high | the guest's slot sampler cannot resolve 26 µs vs 70 µs → the DHT library returns `NaN` on **every** F4 chip (cell `tests/e2e/stm32f4-1wire.spec.js`, all five boards) |
| DS18B20 | 1 µs reset pulse / 15–60 µs read slots | same |
| any `delayMicroseconds(n)` with n < 1000 | — | the busy-wait compares two `micros()` values that never move |

The **host-side delivery is fine**: the runner's one-wire driver
(`dhtFineEngaged` / `stepDhtFine` / `dhtPollInput` in
`src/worker/runners/stm32f4-runner.ts`) already drives the WAKE pulse, the
ACK and the bit stream, and `isTransactionActive()` goes live. The blocker
is purely the guest's time resolution.

## The fix

Model `VAL` as the down-counter it is on silicon, using the engine's own
time base. The engine measures the SysTick period in **retired
instructions** (`nvic.systick_period = LOAD`, `nvic.last_systick_trigger` =
the instruction count of the previous tick), so:

```
VAL = LOAD - (instruction_count - last_systick_trigger)
```

clamped to `[0, LOAD]`, and `0` while `CSR.EN` is clear (the counter does
not run when disabled).

With that, `getCurrentMicros()`'s fraction term
`((LOAD + 1 - VAL) * 1000) / (LOAD + 1)` becomes the true fraction of the
current guest millisecond, so `micros()` is exact in **guest** time — and
since the whole emulator is guest-time driven, `delayMicroseconds(500)`
and a 26 µs/70 µs slot measurement both become meaningful.

Nothing else in the engine changes: `HAL_GetTick()` (`uwTick`) still
advances once per `LOAD` instructions, so `millis()` and the existing pace
accounting are untouched.

## Apply

```bash
cd "stm32 F4"
git apply --check patches/f4-systick-val-downcounter.patch   # passes on the 2026-10-20 tree
git apply       patches/f4-systick-val-downcounter.patch
cargo build --release -p stm32-periph-wasm                   # owner's normal wasm build
# then refresh the deployed pair (glue + wasm MUST version-match):
#   public/vendor/board-engines/stm32f4-emu/site/vendor/stm32_periph_wasm.js
#   public/wasm/stm32_periph_wasm_bg.wasm
```

## Acceptance (our e2e)

1. `tests/e2e/stm32f4-1wire.spec.js` — "reads DHT22 temp + humidity" for
   `openhw-stm32f4` (F407) and the four siblings must print
   `DHT_READ DHT_T:<value> DHT_H:<value>` with the sensor's exact
   24.00 °C / 50.00 % (the value the host-side `openhw-dht22` model
   publishes) instead of `nan`.
2. A `micros()` probe must show a **non-zero** delta between two
   consecutive calls and `≈500` across `delayMicroseconds(500)`.
3. The cells that are already green must stay green — especially
   `tests/e2e/stm32f4-pace.spec.js` (guest-time assertions) and
   `tests/e2e/stm32f4-clock.spec.js` (tickMHz divider + guest millis).

## Related (not part of this patch)

* `micros()` itself is *Arduino-core* code, not engine code. If the owner
  would rather not model `VAL`, the alternative is a guest-side DHT decoder
  that uses a hardware timer for slot timing instead of `micros()` — but the
  engine's TIM input-capture model does not observe external pin edges, so
  that route is closed today.
* The MicroPython STM32 port (`time.sleep_us`) hits the same wall: its
  microsecond sleeps are only as good as `SysTick->VAL`.
