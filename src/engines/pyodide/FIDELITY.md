# Fidelity layer — what it models and what it does not

This layer makes the simulator behave more like a configured Raspberry Pi
without emulating Linux or ARM. There is no kernel, no boot sequence, no C
device drivers, and no real hardware. Everything is a deterministic JS model
driven from Python through the bridge, with virtual time.

## Modelled

### `/boot/config.txt`, device tree and drivers

* `config.get()`, `config.set('dtparam=i2c_arm', 'off')`,
  `config.set('dtoverlay=i2c-sensor', True)` and `config.text()` model the
  usual boot configuration. Changing config adds/removes real Pyodide-FS
  device nodes (`/dev/i2c-1`, `/dev/spidev0.0`, `/dev/serial0`) and blocks
  access when a bus is disabled.
* `config.read_device_tree()` returns buses, addresses, pin names, overlays,
  base devices and overlay devices. `rpi_sim.drivers.probe_all()` claims the
  base nodes; `probe_overlays()` claims devices introduced by `dtoverlay=`:
  `i2c-sensor` attaches an I2C register device at `0x41`, `spi-lcd` attaches
  an SPI register device at CE2, `w1-gpio` attaches a DS18B20 on GPIO4, and
  `dht11` attaches a DHT on GPIO4.
* `/proc/device-tree/{model,compatible,serial-number,aliases/*,bus/i2c}` are
  virtual files served from the same description.

### sysfs and proc

* `builtins.open` is patched for a small, explicit set of paths; all other
  paths use the real `open`.
* GPIO export/value/direction/edge, thermal temp, I2C device names,
  `/proc/cpuinfo`, `/proc/meminfo`, `/boot/config.txt` and the device-tree
  files read/write bridge state. `sysfs.reload()` refreshes them.

### Virtual time, threads and interrupts

* `time.sleep()`, `time.monotonic()`, `time.time()` and `asyncio.sleep()` all
  use the same virtual clock. Timers fire at their exact due time.
* `rpi_sim.threads.Thread` supports priorities and round-robin steps on
  virtual time. Generator targets yield at explicit points; a tick advances
  every runnable thread once in `(-priority, start-order)` order. This is
  cooperative scheduling, not OS preemption.
* `rpi_sim.interrupts.on_edge(..., priority=...)` dispatches at stored edge
  timestamps. Handlers are ordered by `(time, -priority, registration)`;
  edges created inside a handler are dispatched nested, with a depth bound.
  `interrupts.critical()` defers dispatch until the block exits.

### Packet-level virtual network

* A `socket.socket`-like shim over JS `net_*` methods supports AF_INET
  TCP/UDP loopback, `bind`/`listen`/`accept`/`connect`/`send`/`recv`,
  `sendto`/`recvfrom`, DNS names (`localhost`, `raspberrypi.local`,
  `pi.local`), SYN/SYN-ACK/ACK handshakes, FIN on close, and deterministic
  retransmit logging.
* A Flask object binds a virtual port; `requests.get/post` and
  `requests.Session` send real HTTP/1.1 bytes through the socket shim and
  read the response. `paho.mqtt.client` supports QoS 0 and QoS 1 with PUBACK;
  Zeroconf registers services and netifaces reads virtual interface addresses.
* Traffic, packets, sockets and connections are exposed in `state().network`.

### Analogue core (deterministic SPICE-like solver)

* `src/analog.js` implements modified nodal analysis with a Gaussian solve,
  backward-Euler capacitor integration and a piecewise-linear diode model
  (constant drop plus on-resistance) iterated to a stable switch state.
  Fixed timestep defaults to 10 us and is configurable.
* Elements: ideal voltage source, resistor, capacitor, diode, switch, VCVS
  and VCCS dependent sources. GPIO
  output/input is built as a Thevenin source with drive-strength-derived
  series resistance, pin capacitance, real pull resistors and rail clamp
  diodes; `state().analog` reports solved node voltages, element currents,
  iteration count and timestep.
* `rpi_sim.analog` exposes `Node`, `Resistor`, `Capacitor`, `Diode`,
  `VoltageSource`, `Switch`, `attach()`, `solve()`, `voltage()`, `current()`,
  and builders `divider`, `rc_lowpass`, `ntc_divider`,
  `photoresistor_divider`. ADC channels convert the solved node voltage
  (10-bit MCP3008, 16-bit ADS1115 helper).

### Behavioural sensors

* A shared environment model (`rpi_sim.environment`) supplies temperature,
  humidity, pressure, illuminance, acceleration, voltage/current and sample
  interval. I2C sensor register maps recompute measurement registers from it
  on read, with sample-rate gating — no preloaded static image.
* DS18B20 implements a real 1-Wire command sequence (READ ROM, MATCH ROM,
  SKIP ROM, CONVERT T with virtual conversion time, READ SCRATCHPAD) and
  `w1_gpio` decodes the scratchpad bytes.
* DHT22 produces a start pulse, response pulse and 40 data bits;
  `Adafruit_DHT` decodes humidity and temperature from that waveform.
* HC-SR04 measures the generated echo pulse and applies a temperature-corrected
  speed of sound.

### Electrical model

* GPIO carries voltage. Vil/Vih decide logic level; host-set pin capacitance
  derives slew time from drive strength; a nominal-current calculation sets
  an over-current flag; settling happens deterministically when the virtual
  clock advances. Pi 3/4 use 3.3 V, Vil 0.8/Vih 2.0, 1.8 kΩ pulls, 2/4/8 mA
  and 20 pF pins; Pi 5 (RP1) uses Vil 0.7/Vih 2.1, 50 kΩ pulls, 2/4/8/12 mA
  and 12 pF pins. Over-voltage is rejected on all boards (not 5 V tolerant).
* PWM average voltage integrates duty over a configurable window. ADC has
  deterministic ±1 LSB dither. `state().electrical` exposes per-pin target,
  settled voltage, slew, capacitance and over-current.

### Camera

* `picamera2.Picamera2.capture_array()` returns a deterministic RGB test
  pattern as a numpy array; `capture_file()` writes the same bytes to the
  Pyodide filesystem. Capture count, dimensions, checksum and the
  board-specific sensor name (OV5647/IMX219/IMX708) are in `state().camera`.

## Still simplified (honestly)

* **No Linux, ARM, kernel, boot firmware, real device-tree blob or C
  drivers.** The config/device-tree/sysfs layer is a small deterministic
  model, not an operating system.
* No real OS threads, preemption at instruction level, IRQ controller or
  interrupt latency. Threads and interrupts are cooperative callbacks on
  virtual time; a long-running callback cannot be preempted.
* No real sockets, packets on a wire, DNS servers, TLS, brokers, HTTP servers
  or mDNS. All network activity is in-process; TLS and external hosts raise
  `NotImplementedError`.
* Electrical behaviour is logic thresholds, RC-style settling and deterministic
  dither — not SPICE. There is no real-time analogue waveform, RC response
  at physical time scales, crosstalk, ESD or current-limit trip behaviour.
* The analogue solver is linear: ideal sources, R, C, switches and piecewise
  diodes only. No transistors, op-amp macromodels, parasitic inductance,
  tolerance/corner variation, noise spectra, RF/EM or physical time-domain
  accuracy beyond deterministic backward Euler at a chosen timestep.
* Sensors follow behavioural register/command models driven by a shared
  environment, not real sensor silicon: no calibration curves, error specs,
  bus arbitration, timing jitter or device-specific quirks.
* OLED/LCD drivers write simplified text/framebuffer buffers; servo/PCA9685
  map angles directly to duty cycles without pulse hardware.
* `PIL` is an in-memory pixel subset (PPM-like save only).
* Filesystem persistence is limited to the Pyodide in-memory FS; nothing is
  written to the host disk except through the test harness.

Proof: `npm test` -> `ALL BOARDS / ALL PERIPHERALS / 56 LIBRARIES / FIDELITY /
NETWORK / ELECTRICAL / CONCURRENCY / CAMERA / DTREE / ASYNC / ANALOG PASS`.

---

## OpenHW integration appendix (2026-11-28) — not upstream text

Everything above is the owner's upstream documentation. This appendix records
what the main OpenHW Studio runner adds on top of it; it does not change any
engine byte or upstream claim.

* **Already modelled upstream, now bridged to host components:** GPIO output,
  I2C EEPROM/SSD1306, SPI register file, PWM duty, ADC register, UART buffer,
  1-Wire scratchpad and DHT waveform. The runner taps the same bridge methods
  and pumps the same JS models — no new physics is claimed.
* **New host↔guest translators** (`rpi-pyodide-runner.ts`): potentiometer
  wiper → MCP3008 channel (10-bit conversion from the host rail voltage),
  host USB-terminal sink ← guest UART TX, `SERIAL_INPUT` → guest UART RX,
  DS18B20 temperature → 1-Wire model, DHT22 register values → waveform model,
  guest NeoPixel pixels → WS2812 framebuffer, guest PWM frequency/duty →
  servo pulse width. A sketch may define `rpi_poll()`; the runner calls it
  each tick so post-boot host changes are observed with real guest read APIs.
* **Claimed capabilities:** `digital-gpio`, `analog-adc`, `uart`, `onewire`,
  `i2c-target`, `spi-target`, `pwm` — each proved by a host telemetry
  assertion in `tests/e2e/rpi-{boards,protocols}.spec.js`.
* **Per-board facts:** Pi 3 B+ / Pi 4 B use ViH 2.0 V, 1.8 kΩ pulls and a
  10-bit ADC profile; Pi 5 (RP1) uses ViH 2.1 V, 50 kΩ pulls and a 12-bit
  profile. These are model parameters, not measured silicon; they are exposed
  to guest `electrical` state and host `rpiAdc` telemetry.
* **Timed drivers (closing the four limits):** ADC now does MNA sample/hold
  acquisition + N-bit SAR with per-bit clock consumption (11 us BCM / 7 us
  RP1 for a 10-bit MCP3008 read); UART is a 9600 8N1 frame with 16-byte FIFOs,
  1041.6667 us bit time, overrun and framing flags; 1-Wire and DHT22 are
  bit-level edge state machines (480/240/15 us and 18 ms/80 us/26-70 us)
  whose replies are supplied by the wired host components at exact virtual
  times; `picamera2` pulls its frame from the `openhw-camera-module` host
  component instead of an internal test pattern. Every one has a green cell
  in `tests/e2e/rpi-protocols.spec.js` (no skips).
* **Still simplified:** all timings are deterministic virtual-time model
  parameters, not measured silicon or real-time waveforms. The SAR uses
  nearest-code quantisation without noise/impedance models; UART has no real
  clock recovery; 1-Wire/DHT decode scheduled edges rather than analog
  thresholds; the servo gets an exact pulse width from guest duty but no real
  pulse-generation hardware; camera frames are deterministic host-supplied
  byte arrays. No Linux, ARM CPU, boot or device-driver execution is claimed.
