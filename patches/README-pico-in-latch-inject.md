# pico-emu — IN-latch inject export

**Patch file:** `pico-in-latch-inject.patch` (applies to the owner's
`src/picoemu_wasm.c` + `build_wasm.sh`).

**Goal:** let the host write a level into the **guest-visible IN latch**, so an
external signal (button, sensor, 1-Wire slave, IR receiver, EXTI source) is
observable by the guest.

**Why this is the highest-leverage ask in the project:** one export unblocks
four columns on **both** Pico boards (GPIO-in, 1-Wire/DHT22, IR, EXTI).

## Root cause (file:line, owner tree @ `b83786f` + working-tree changes)

* `src/picoemu_wasm.c:374` — `picoemu_set_gpio(pin, val)` calls
  `gpio_set_pin()`, which writes **`gpio_state.gpio_out`** (the OUT latch)
  only.
* `src/gpio.c:676` — `gpio_set_pin()` writes the OUT latch and runs the edge
  detector on the *effective* level, which for an input pin is the IN latch →
  the host write is invisible to the guest.
* `src/gpio.c:725` — `gpio_get_pin()` returns the *effective* level:
  the OUT latch for pins the guest drives, the **IN latch** otherwise
  (`gpio_effective_pins()`).
* `src/gpio.c` `gpio_reset()` sets `gpio_state.gpio_in = 0xFFFFFFFF`,
  i.e. every input idles **HIGH**.

Consequence: a host that pushes an external level only ever writes the OUT
latch, which the guest ignores while the pin is an input. The IN latch stays
at the reset default, so `digitalRead()` returns 1 forever and
`attachInterrupt()` never fires. The engine already owns the right entry
point — `gpio_set_input_pin()` (`src/gpio.c:748`, declared in
`include/gpio.h:109`) — which updates the IN latch, runs the edge detector
(`gpio_detect_events`) and signals the NVIC (`gpio_check_irq`), exactly like
a real pad transition. **No export reaches it**, so the only route today is
the devtools script path (`_picoemu_script_load` → `script_poll` →
`gpio_set_input_pin`, `src/devtools.c:696`), which is a debugging facility,
not an API.

## The patch

* `src/picoemu_wasm.c` — new export `picoemu_set_gpio_input(pin, val)` that
  forwards to `gpio_set_input_pin()` (edge + IRQ, like a real pad), plus
  `picoemu_inject_gpio_level(pin, val)` that forwards to the existing
  `gpio_inject_level()` (silent level force, for open-drain slaves).
* `build_wasm.sh` — add `"_picoemu_set_gpio_input","_picoemu_inject_gpio_level"`
  to `$EXPORTS`.

## Acceptance test (measured)

Built the patched tree **outside the engine repo**
(`/tmp/opencode/picobuild`, emsdk 6.0.9, the pinned toolchain) and ran the
`inlatch` firmware (prints every change of `digitalRead(GP7)`):

```
boot serial: "INLATCH:BEGIN\r\nINLATCH:1"
guest-visible GP7 after boot = 1
has _picoemu_set_gpio_input = function
after _picoemu_set_gpio_input(7,0): level=0 serial="INLATCH:0"
after _picoemu_set_gpio_input(7,1): level=1 serial="INLATCH:1"
```

Same firmware on the **unpatched** engine (repo bytes, md5
`0c74dffe5f5458a9062e4f7a13197781`): `_picoemu_set_gpio_input` does not
exist; the only reachable route is the devtools script path, and with it
`GP7` reads **1** (stuck at the reset default) until the script path is used.

## How the frontend consumes it (already shipped in `pico-runner.ts`)

`PicoRunner.setGpioInput()` prefers the new export and falls back to the
devtools script path when the engine build predates the patch:

```ts
const direct = self.mod?._picoemu_set_gpio_input;
if (typeof direct === 'function') { direct.call(self.mod, n, high ? 1 : 0); return; }
self.injectGpioInputLevel(n, high);   // script fallback: "0ms: gpio<n> <level>"
```

The fallback works on the current repo bytes (proved headlessly: script load
`0ms: gpio7 0` → guest-visible GP7 = 0), so the GPIO-in / EXTI cells are
green **before** the engine patch lands. The patch is still the right fix:
the script path re-allocates the whole event table on every load
(`src/devtools.c:632` `script_init` leaks the previous array), so a
1-Wire/DHT bit-bang stream pays ~18 kB per edge — the direct export has no
such cost.

## End-to-end (this repo)

`tests/e2e/pico-gpio-in.spec.js` — needle `PICO_IN_LEVEL:0` (M0+) /
`PICO2_IN_LEVEL:0` (M33). The frontend prefers `_picoemu_set_gpio_input`
when the engine provides it and falls back to the script path otherwise, so
the cell passes on both engine builds.
