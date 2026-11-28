# Pyodide board engine — Raspberry Pi 3 B+ / 4 B / 5 (peripheral model)

This is the **single committed mirror** of the peripheral engine adopted from
`/home/danish1075/Documents/simulator/sperte/rpi-pyodide` (owner-provided
standalone Raspberry-Pi-on-Pyodide simulator). `UPSTREAM-README.md` and
`LIBRARIES.md` are the unmodified upstream docs. Since 2026-11-28 the mirrored
`src/*.js` and selected `py/**` shims carry **OpenHW additions** for timed ADC,
UART, 1-Wire, DHT and host-camera drivers; `FIDELITY.md` has a clearly-marked
**OpenHW integration appendix**. All changes are additive and are documented
below — the original upstream files remain available in the owner's folder.

Provenance (recorded 2026-11-28):

| Path here | Upstream source | State |
| --- | --- | --- |
| `src/bridge.js` | `sperte/rpi-pyodide/src/bridge.js` | upstream + timed-driver bridge methods |
| `src/peripherals.js` | `sperte/rpi-pyodide/src/peripherals.js` | upstream + SAR/1-Wire/DHT/camera timing |
| `src/analog.js` | `sperte/rpi-pyodide/src/analog.js` | verbatim (solver used by the S/H model) |
| `src/runtime.js` | `sperte/rpi-pyodide/src/runtime.js` | verbatim (document-only: the worker runner has its own worker-safe loader) |
| `py/**` | `sperte/rpi-pyodide/py/**` | upstream + timed `MCP3008`, `UART`, `w1_gpio`, `Adafruit_DHT`, `_bridge`, `analog` APIs (72 shim files) |

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

To refresh upstream bytes: re-copy `<upstream>/src` and `<upstream>/py`, then
re-apply the additive OpenHW patches listed above (and re-copy `py/` into
`public/vendor/board-engines/pyodide/`). Keep the two mirrors in sync: the
worker loads `src/` via the Vite alias and fetches shims from `public/vendor/`.

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
the mirrored engine's additive driver APIs. Guest calls are tapped on the
bridge object (I2C, SPI, UART TX); host component state is pumped back into the
JS peripheral models each tick, and a sketch-defined `rpi_poll()` is invoked
on each tick so mid-run host changes can be read with real guest APIs.

### Timed driver upgrades (2026-11-28, closing the four remaining limits)

* **ADC** — `peripherals.adcSource/adcConvert` attach a sample/hold capacitor
  to the MNA solver, settle it for the acquisition time, then run an N-bit SAR
  (nearest-code comparison) consuming one clock period per bit on the virtual
  clock. `MCP3008.read()` and `rpi_sim.analog.adc_convert()` expose `code`,
  `conversion_us`, `clock_hz`, `sample_hold_v`, `bits`. BCM profile: 10-bit,
  3.2 MHz, 8 us acquisition (11 us total); RP1 Pi 5: 12-bit, 1 MHz, 4 us
  acquisition (7 us total for the 10-bit MCP3008 shim).
* **UART** — `peripherals.uartConfigSet/uartStats` give a 9600 8N1 framed port
  with 16-byte TX/RX FIFOs, `bitTimeUs = 10e6/baud` (1041.6667 us at 9600),
  overrun flags and a framing-error hook. Both TX writes and RX reads consume
  bit times on the virtual clock; `UART.configure/stats/overrun` and `serial`
  use them.
* **1-Wire / DHT22** — `owReset/owWriteSlot/owReadSlot/owLoadScratchpad` and
  `dhtStart/dhtReply/dhtTiming` drive and schedule real GPIO edges at exact
  virtual microseconds. Guest shims decode the resulting edge log: 480 us
  reset / 240 us presence / 15 us read sampling, and 18 ms start / 80 us
  response / 26-70 us data bits.
* **Camera** — `cameraSetFrame` replaces the internal test pattern with the
  frame supplied by the new `openhw-camera-module` host component;
  `picamera2.capture_array()/capture_file()` consume those bytes.

| Direction | Host component | Guest API | Proved by |
|---|---|---|---|
| guest → host | `openhw-led` (GPIO), `openhw-ssd1306-oled` (I2C), `openhw-max7219` (SPI), `openhw-usb-device` (UART TX), `openhw-neopixel-matrix` (WS2812), `openhw-servo` (PWM pulse) | `RPi.GPIO`, `smbus`, `spidev`, `uart.UART.write`, `Adafruit_NeoPixel`, `GPIO.PWM` | `tests/e2e/rpi-boards.spec.js`, `rpi-protocols.spec.js` |
| host → guest | `openhw-potentiometer` (ADC5), `openhw-ds18b20` (1-Wire), `openhw-dht22` (DHT waveform), `SERIAL_INPUT` (UART RX) | `MCP3008.read`, `w1_gpio.read_temp`, `Adafruit_DHT.read`, `UART.read/readline` | `tests/e2e/rpi-protocols.spec.js` |

Claimed capabilities (only what a cell proves): `digital-gpio`,
`analog-adc`, `uart`, `onewire`, `i2c-target`, `spi-target`, `pwm`. Per-board
ADC facts (ViH 2.0/2.1 V, pulls 1.8 kΩ/50 kΩ, 10/12-bit profile) are published
as `rpiAdc` metadata on a full-state analogue endpoint and asserted in the
spec. DHT22, NeoPixel and camera are proved but have no capability-vocabulary
need code (`dht-neopixel-no-cap-code` limit) — see the registry limits and
`matrix.md`. All previously open limits now have green cells. These are
deterministic virtual-time **models**, not measured silicon timing; there is
no Linux, ARM CPU or real-time behaviour and no cell claims those.
