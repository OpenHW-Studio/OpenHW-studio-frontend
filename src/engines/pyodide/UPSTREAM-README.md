# Raspberry Pi on Pyodide — peripheral simulator

A standalone browser simulator for Raspberry Pi 3 / 4 / 5 **peripheral
programming**. Real CPython (Pyodide 314.0.8, jsDelivr CDN) runs sketches
against Python shims that call deterministic JavaScript device models.
There is no Linux kernel and no ARM CPU emulation — see
[What is not emulated](#what-is-not-emulated).

The page lets you pick a board, load an all-peripherals demo, press **Run
sketch**, and inspect live state. The same page is driven by the browser proof
test, so behaviour is deterministic and inspectable.

## Architecture

```
   index.html  <script type="module">
        |
        v
   src/runtime.js   load Pyodide + numpy; write py/ shims to /home/pyodide;
                    expose window.RPiSim { init, run, reset, state, ... }
        |  window.__rpiBridge
        v
   src/bridge.js    synchronous method table (one call per guest access)
        |
        v
   src/peripherals.js  board profiles, device models, virtual clock, edge log
        ^
        | imports
   py/rpi_sim/*     bridge wrapper, timers, board, system, devices, onewire, uart,
                    config, drivers, sysfs, threads, interrupts, network, electrical
   py/RPi/*, py/gpiozero.py, py/smbus*.py, py/spidev.py, py/serial.py, ...
   56 catalog modules (see LIBRARIES.md)
```

* `src/peripherals.js` owns all state. `reset(board)` rebuilds every model.
  Board profiles enforce real differences (below) rather than just labels.
* `src/runtime.js` creates shim directories on the Pyodide FS recursively and
  puts `/home/pyodide` first on `sys.path`. `ready()` only becomes true after
  shims import and `rpi_sim` loads; `numpy` is loaded from the Pyodide
  distribution at init.
* `py/rpi_sim/_bridge.py` converts JS objects with `to_py()` (never leaking
  `JsProxy` into shims), patches `time.sleep/monotonic/time`, and dispatches
  virtual timers, cooperative threads, edge interrupts and Python GPIO
  callbacks when the clock advances. A reset generation prevents a new sketch
  from consuming a previous sketch's edge history.
* `window.RPiSim.state()` returns a JSON-serialisable snapshot used by both
  the UI and the tests.

## Board differences (enforced)

| | Pi 3 B+ | Pi 4 B | Pi 5 |
| --- | --- | --- | --- |
| SoC | BCM2837 | BCM2711 | BCM2712 + RP1 |
| CPU clock (model) | 1200 MHz | 1500 MHz | 2400 MHz |
| PWM clock | 540 MHz | 540 MHz | 200 MHz |
| PWM-capable GPIO | 12, 13, 18, 19 | 12, 13, 18, 19 | all header GPIO (RP1) |
| I2C buses | 0, 1 | 0, 1 | 0, 1 |
| SPI buses | 0, 1 | 0, 1 (+ optional 2) | 0, 1 |
| SPI max speed (model) | 32 MHz | 125 MHz | 200 MHz |
| CPU temp baseline | 45 C | 50 C | 55 C |
| Onboard LEDs | PWR red, ACT green | PWR red, ACT green | PWR green, ACT green |
| Logic thresholds (Vil / Vih) | 0.8 / 2.0 V | 0.8 / 2.0 V | 0.7 / 2.1 V |
| Pull-up / drive | 1.8 kΩ, 2/4/8 mA | 1.8 kΩ, 2/4/8 mA | 50 kΩ, 2/4/8/12 mA |
| Virtual network | 10.0.0.11 / 192.168.1.11 | 10.0.0.24 / 192.168.1.24 | 10.0.0.42 / 192.168.1.42 |

GPIO is not 5 V tolerant on any board; over-voltage is rejected.

`pwmCreate()` throws on a non-PWM GPIO for Pi 3/4; Pi 5 accepts any valid
GPIO. All of these values appear in `state()` and in
`rpi_sim.board.board_info()`.

Python helpers:

```python
from rpi_sim import board, system
info = board.board_info()
temp = system.cpu_temperature()          # 45 / 50 / 55 C
board.onboard_led("PWR", True)           # returns {color, on}
board.onboard_led("PWR")                 # read back
```

## Fidelity layer (no kernel, no ARM)

See **[FIDELITY.md](FIDELITY.md)** for the full boundary of the model. In short:

* `rpi_sim.config` models `/boot/config.txt`; changing it adds/removes real
  Pyodide-FS device nodes (`/dev/i2c-1`, `/dev/spidev0.0`, `/dev/serial0`) and
  changes the device-tree view. `rpi_sim.drivers` claims those nodes and
  installs register devices in the I2C/SPI models.
* `rpi_sim.sysfs` patches `builtins.open` for a known set of sysfs/proc paths;
  GPIO export/value, thermal temp, I2C device names, `/proc/cpuinfo` and
  `/proc/meminfo` read/write bridge state. Other paths use real `open`.
* `rpi_sim.threads.Thread` and `rpi_sim.interrupts.on_edge` are cooperative:
  they run on virtual-time ticks, never as real threads or IRQs, with
  deterministic ordering.
* `rpi_sim.network` plus the extended `requests`, paho-mqtt, Flask, Zeroconf
  and netifaces shims implement an in-process loopback HTTP/MQTT registry — no
  sockets are opened.
* `rpi_sim.electrical` models voltage, Vil/Vih thresholds, pull-ups, drive
  strength, capacitance-derived slew, settling, over-current, PWM average
  voltage and deterministic ADC dither per board.
* `socket`, Flask, `requests` (including `Session`), MQTT QoS 0/1, camera
  capture and `asyncio.sleep()` are all backed by deterministic models — see
  `FIDELITY.md` for the exact boundary.

## Virtual time, timers and events

`time.sleep(seconds)` advances a virtual millisecond clock instantly (no wall
clock delay). `time.monotonic()` and `time.time()` derive from it. Due timers
are fired **at their exact due time**, so callbacks observe the right clock:

```python
import time
from rpi_sim import timers, _bridge

seen = []
t = timers.repeating(0.3, lambda: seen.append(_bridge.clock_ms()))
time.sleep(1.0)                          # t.count == 3, seen == [300, 600, 900]
```

`RPi.GPIO.add_event_detect(pin, edge, callback=...)` delivers Python callbacks
when edges arrive; callbacks are polled on each virtual clock step and in
`wait_for_edge()`. Edge records carry a virtual timestamp and source
(`guest` or `device`).

## Peripheral coverage

* **GPIO** — direction, level, pull, device-driven levels, edge log with
  timestamps, event detection and `wait_for_edge`.
* **PWM** — board-specific pin policy, frequency, duty, stop.
* **I2C** — EEPROM `0x50`, SSD1306 OLED `0x3c`, MCP9808 `0x18` by default;
  generic register devices can be attached at any address from Python via
  `rpi_sim.devices.I2CRegisterDevice`.
* **SPI** — CE0 register file with auto-increment, CE1 shift register; generic
  `SPIRegisterDevice` for SPI sensor shims.
* **ADC** — MCP3008, 8 channels, host-injectable.
* **UART** — TX buffer, RX injection, pyserial-style `read(n)`, `readline()`.
* **1-Wire** — DS18B20 temperature per GPIO (`rpi_sim.onewire`, `w1_gpio`).
* **DHT** — DHT11/22 host-injected readings.
* **NeoPixel** — WS2812 strip pixels on a GPIO.
* **LCD** — simplified HD44780 text buffer (`RPLCD`, `luma.lcd`).
* **CPU temperature / onboard LEDs** — per-board values, state-visible.

## Library catalog (56 modules)

See **[LIBRARIES.md](LIBRARIES.md)** for the full list with status: 41
board-backed modules, 7 limited shims and 7 Pyodide built-ins. Hardware-facing
shims call the JS bridge; operations that cannot be emulated raise
`NotImplementedError` instead of silently succeeding.

## How to run

```sh
cd rpi-pyodide
npm run serve            # http://127.0.0.1:8090 (or python3 -m http.server 8090)
npm test                 # self-contained proof; starts the server if needed
```

Open <http://127.0.0.1:8090>. A network connection is needed to fetch Pyodide
and numpy from jsDelivr. No `npm install` is required. Playwright is resolved
from `PLAYWRIGHT_PATH` or the sibling OpenHW frontend by default.

## Proof commands

```sh
npm test
node tests/peripherals.cjs
RPI_BASE=http://127.0.0.1:8091 node tests/peripherals.cjs
PORT=8091 npm run serve
```

The proof runs ten sketches per board: all-peripherals, extra peripherals,
the 56-library catalog, fidelity, packet-level network, electrical, concurrency,
camera, device-tree overlays and virtual asyncio. It asserts per-board
differences, timers, callbacks, config/device-tree, sysfs, thread/IRQ ordering,
TCP/UDP/HTTP/MQTT, RC settling and current limits, camera frames and zero page
errors. Expected final line:

```
ALL BOARDS / ALL PERIPHERALS / 56 LIBRARIES / FIDELITY / NETWORK / ELECTRICAL / CONCURRENCY / CAMERA / DTREE / ASYNC / ANALOG PASS
```

## What is not emulated

* **No Linux, no ARM, no kernel/boot, no real device tree blob or C drivers.**
  The config/device-tree/sysfs layer is a small deterministic model on the
  Pyodide filesystem, not a kernel. This is not a machine emulator.
* No real `sysfs`/`/dev/gpiomem`, sockets, filesystem persistence beyond the
  Pyodide FS, `subprocess`, OS threads or hardware interrupts. Threads and
  interrupts are cooperative and run on virtual time.
* Electrical behaviour is a deterministic linear SPICE-like model (ideal
  sources, R/C, PWL diodes), not full SPICE: no transistors, parasitics,
  tolerance corners, RF/EM or real-time analogue accuracy. Sensor models
  follow the shared environment, not real silicon calibration.
* Sensor values are deterministic host-injected register images, not real
  sensor protocols. OLED/LCD models are simplified text/framebuffer buffers.
* Servo and PCA9685 map angles to duty cycles without real pulse hardware.
* Real external HTTP/MQTT/mDNS I/O, TLS, MQTT QoS > 1, real Flask servers and
  test clients still raise `NotImplementedError`. The in-process virtual
  network and `requests.Session` are supported.
* `PIL` is an in-memory pixel subset (PPM-like save only); camera frames are
  deterministic test patterns, not real imagery.
* Time is virtual for `time.sleep/monotonic/time` and `asyncio.sleep`; no wall
  clock is advanced by guest sleeps.
* Pyodide/numpy are CDN-loaded at runtime; offline use needs local copies.
