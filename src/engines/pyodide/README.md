# Pyodide board engine — Raspberry Pi 3 B+ / 4 B / 5 (peripheral model)

This is the **single committed mirror** of the peripheral engine adopted from
`/home/danish1075/Documents/simulator/sperte/rpi-pyodide` (owner-provided
standalone Raspberry-Pi-on-Pyodide simulator). The files are byte-identical
copies of that directory's `src/` and `py/` trees; `UPSTREAM-README.md` and
`LIBRARIES.md` are the unmodified upstream docs, and `FIDELITY.md` is the
upstream text plus a clearly-marked **OpenHW integration appendix** (below).
The engine JS and all 72 shims remain byte-identical to upstream.

Provenance (recorded 2026-11-28):

| Path here | Upstream source | State |
| --- | --- | --- |
| `src/bridge.js` | `sperte/rpi-pyodide/src/bridge.js` | verbatim |
| `src/peripherals.js` | `sperte/rpi-pyodide/src/peripherals.js` | verbatim |
| `src/analog.js` | `sperte/rpi-pyodide/src/analog.js` | verbatim |
| `src/runtime.js` | `sperte/rpi-pyodide/src/runtime.js` | verbatim (document-only: the worker runner has its own worker-safe loader) |
| `py/**` | `sperte/rpi-pyodide/py/**` | verbatim (72 shim files) |

## Resolution / refresh recipe

Resolution is funnelled like every other board engine:

* `src/worker/runners/arm-runner-base.ts#importEngine` — the only place
  that resolves the Pyodide ESM runtime (`pyodide.mjs`, loaded from the
  version-pinned jsDelivr URL at runtime; vendored fallback path is
  `/vendor/board-engines/pyodide/`).
* `vite.config.js` — the `pyodide/*` aliases point at the committed mirror
  under `src/engines/pyodide/`, so dev, build and deploy all read the same
  bytes. `public/vendor/board-engines/pyodide/` carries the deploy mirror of
  the Python shims (`py/**`) fetched by the runner at boot.

To refresh: `cp -r <upstream>/src <upstream>/py ./` (and the doc files), then
copy `py/` into `public/vendor/board-engines/pyodide/`. Do not edit the
mirrored files in place — patch the upstream source and re-copy, so the
byte-for-byte provenance stays true.

## What this engine is

Real CPython (Pyodide) executing Python shims against deterministic JS
peripheral models: GPIO, I2C (EEPROM 0x50, SSD1306 0x3C, MCP9808 0x18),
SPI, PWM, ADC, UART, 1-Wire, virtual time, and per-board differences
(PWM-capable pins, clocks, temperatures, electrical thresholds).

**It is not an operating-system emulator.** There is no Linux kernel, no
ARM CPU emulation, no boot or device-driver execution. See `FIDELITY.md`
for the exact boundary; this is documented in the board family limits in
`src/worker/boards-registry.ts` and `matrix.md` (repo root).

## OpenHW integration — runner translators (2026-11-28)

`src/worker/runners/rpi-pyodide-runner.ts` adds host↔guest translation without
editing any mirrored engine file. Guest calls are tapped on the bridge object
(I2C, SPI, UART TX); host component state is pumped back into the JS peripheral
models each tick, and a sketch-defined `rpi_poll()` is invoked on each tick so
mid-run host changes can be read with real guest APIs.

| Direction | Host component | Guest API | Proved by |
|---|---|---|---|
| guest → host | `openhw-led` (GPIO), `openhw-ssd1306-oled` (I2C), `openhw-max7219` (SPI), `openhw-usb-device` (UART TX), `openhw-neopixel-matrix` (WS2812), `openhw-servo` (PWM pulse) | `RPi.GPIO`, `smbus`, `spidev`, `uart.UART.write`, `Adafruit_NeoPixel`, `GPIO.PWM` | `tests/e2e/rpi-boards.spec.js`, `rpi-protocols.spec.js` |
| host → guest | `openhw-potentiometer` (ADC5), `openhw-ds18b20` (1-Wire), `openhw-dht22` (DHT waveform), `SERIAL_INPUT` (UART RX) | `MCP3008.read`, `w1_gpio.read_temp`, `Adafruit_DHT.read`, `UART.read/readline` | `tests/e2e/rpi-protocols.spec.js` |

Claimed capabilities (only what a cell proves): `digital-gpio`,
`analog-adc`, `uart`, `onewire`, `i2c-target`, `spi-target`, `pwm`. Per-board
ADC facts (ViH 2.0/2.1 V, pulls 1.8 kΩ/50 kΩ, 10/12-bit profile) are published
as `rpiAdc` metadata on a full-state analogue endpoint and asserted in the
spec. DHT22/NeoPixel are proved but have no capability vocabulary code; camera
is **skipped** (`camera-no-host-component`: no wired host camera model) — see
the registry limits and `matrix.md`. This integration adds no Linux, ARM CPU
or real-time behaviour: no cell claims those.
