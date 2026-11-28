# Library catalog

The simulator exposes **56 importable Python module names** on all three
boards. Statuses:

* **board-backed** — calls the JS peripheral bridge (GPIO, I2C, SPI, PWM, ADC,
  UART, timers, 1-Wire, LEDs, board profile). It really changes simulated
  hardware state, but the devices themselves are simplified models.
* **limited shim** — local API only. Real I/O that cannot be emulated raises
  `NotImplementedError` with a clear message; nothing silently succeeds.
* **Pyodide built-in** — provided by CPython/Pyodide, no shim needed. `numpy`
  is loaded from the Pyodide distribution during `RPiSim.init()`.

Every row below is imported and exercised by `npm test` (`LIBRARIES` sketch),
which asserts all 56 names and per-board behaviour.

## Core GPIO / buses

| # | Module | Status | What is exercised |
| --- | --- | --- | --- |
| 1 | `RPi.GPIO` | board-backed | BCM mode, setup/output/input, PWM, edge callbacks |
| 2 | `gpiozero` | board-backed | `LED`, `PWMLED`, `Servo`, `RGBLED`, `InputDevice`, `Button`, `DistanceSensor`, `RotaryEncoder`, `MCP3008` |
| 3 | `pigpio` | board-backed | `pi()` GPIO read/write, `hardware_PWM` |
| 4 | `wiringpi` | board-backed | physical-pin numbering, `pinMode`/`digitalWrite`/`digitalRead` |
| 5 | `periphery` | board-backed | `GPIO`, `I2C`, `SPI`, `PWM` classes |
| 6 | `board` | board-backed | BCM/BOARD pin maps, named pins, `board_info()`, onboard LEDs |
| 7 | `busio` | board-backed | `I2C.readfrom/writeto`, `SPI.write_readinto` |
| 8 | `digitalio` | board-backed | `DigitalInOut` input/output switching |
| 9 | `analogio` | board-backed | `AnalogIn.value/voltage` on the MCP3008 model |
| 10 | `pwmio` | board-backed | `PWMOut` duty cycle and frequency |
| 11 | `smbus` | board-backed | byte/block register transfers |
| 12 | `smbus2` | board-backed | `SMBus` plus `I2C_MSG.write/read` and `i2c_rdwr` |
| 13 | `spidev` | board-backed | `SpiDev.xfer/xfer2` |
| 14 | `serial` | board-backed | `Serial.write/read/readline/in_waiting` over the UART model |
| 15 | `Adafruit_GPIO` | board-backed | `get_platform_name`, GPIO/I2C facades |

## Sensors

| # | Module | Status | What is exercised |
| --- | --- | --- | --- |
| 16 | `Adafruit_DHT` | board-backed | `read`/`read_retry` from the injected DHT model |
| 17 | `w1thermsensor` | board-backed | DS18B20 temperature via the 1-Wire model |
| 18 | `adafruit_bme280` | board-backed | temperature, pressure, humidity registers |
| 19 | `adafruit_bmp280` | board-backed | temperature, pressure registers |
| 20 | `adafruit_sht31d` | board-backed | temperature, humidity registers |
| 21 | `adafruit_mcp9808` | board-backed | temperature register at `0x18` |
| 22 | `adafruit_adxl34x` | board-backed | ADXL345 acceleration registers |
| 23 | `adafruit_mpu6050` | board-backed | MPU-6050 acceleration registers |
| 24 | `adafruit_lis3dh` | board-backed | LIS3DH acceleration registers |
| 25 | `adafruit_pcf8523` | board-backed | BCD RTC registers |
| 26 | `DS1307` | board-backed | RTC datetime over the same register device |
| 27 | `MFRC522` | board-backed (partial) | SPI register read/write; tag protocol raises `NotImplementedError` |
| 28 | `nrf24l01` | board-backed (partial) | SPI register read/write; radio packets raise `NotImplementedError` |
| 29 | `hcsr04` | board-backed | echo edge timestamps -> distance in metres |
| 30 | `ina219` | board-backed | bus voltage / current registers |
| 31 | `bh1750` | board-backed | ambient-light register to lux |

## Displays / actuators

| # | Module | Status | What is exercised |
| --- | --- | --- | --- |
| 32 | `Adafruit_SSD1306` | board-backed | I2C framebuffer writes |
| 33 | `luma.oled` | board-backed | `ssd1306` device display/clear |
| 34 | `luma.lcd` | board-backed | text display buffer |
| 35 | `RPLCD` | board-backed | `CharLCD.write_string`/`clear` |
| 36 | `Adafruit_NeoPixel` | board-backed | per-pixel RGB writes |
| 37 | `neopixel` | board-backed | CircuitPython-style `NeoPixel` item assignment |
| 38 | `adafruit_pca9685` | board-backed | 16-channel PWM duty registers |
| 39 | `PCA9685` | board-backed | uppercase driver alias |
| 40 | `adafruit_motor` | board-backed | `Motor.throttle` via PWM |
| 41 | `adafruit_servokit` | board-backed | `ServoKit.servo[n]` angle via PCA9685 registers |
| 42 | `picamera2` | board-backed | deterministic test-pattern `capture_array`/`capture_file` from the JS camera model |

## App / network

| # | Module | Status | What is exercised |
| --- | --- | --- | --- |
| 43 | `requests` | limited shim (virtual network) | `Request`, `utils`, `Response`, `get`/`post`, `Session` over virtual HTTP; TLS raises `NotImplementedError` |
| 44 | `paho.mqtt.client` | limited shim (virtual network) | `Client`, `MQTTMessage`, QoS 0/1 with PUBACK; QoS > 1 raises `NotImplementedError` |
| 45 | `flask` | limited shim (virtual network) | `Flask`, `route` registered on a virtual socket; real servers/test clients raise `NotImplementedError` |
| 46 | `zeroconf` | limited shim (virtual network) | `ServiceInfo`, virtual service registration; real mDNS raises `NotImplementedError` |
| 47 | `netifaces` | limited shim (virtual network) | `interfaces()` keeps `lo` for compatibility; `ifaddresses`/`gateways` read virtual addresses |
| 48 | `socket` | limited shim (virtual network) | AF_INET TCP/UDP loopback, DNS, handshake/FIN/retransmit; TLS/external I/O raises `NotImplementedError` |
| 49 | `threading` | Pyodide built-in | `Lock()` |
| 50 | `queue` | Pyodide built-in | `Queue.put/get` |
| 51 | `asyncio` | Pyodide built-in | `new_event_loop()` |
| 52 | `logging` | Pyodide built-in | `getLogger()` |

## Data

| # | Module | Status | What is exercised |
| --- | --- | --- | --- |
| 53 | `numpy` | Pyodide built-in (loaded at init) | `array([1,2,3]).sum()` |
| 54 | `PIL` | limited shim | in-memory `Image.new/getpixel/putpixel/tobytes/save` (PPM only) |
| 55 | `json` | Pyodide built-in | `loads` |
| 56 | `csv` | Pyodide built-in | `reader` |

## Simplifications, honestly

* This is **not Linux/ARM emulation**. Python code calls JS models through a
  thin bridge; there is no kernel, device tree, driver stack, ARM CPU or real
  hardware timing.
* Sensor values come from **host-injected register images** (e.g. `BME280`
  attaches a register file with representative bytes). They are deterministic
  fixtures, not real sensor protocols.
* `luma.lcd`, `RPLCD` and OLED drivers write into simplified text/framebuffer
  models; no controller command state machines are emulated.
* `Servo`/`PCA9685` map angles to duty cycles directly; there is no real
  servo pulse hardware model.
* `requests`, MQTT, Flask, Zeroconf, netifaces and `socket` operate on an
  in-process virtual network only. TLS, external hosts, MQTT QoS > 1, real
  servers and mDNS raise `NotImplementedError`.
* `PIL` supports in-memory pixel access and a PPM-like save only — no PNG/JPEG
  codecs, drawing or font rendering.
* `picamera2` produces a deterministic test pattern, not camera imagery.
* Sensor libraries decode behavioural register maps and waveforms driven by
  `rpi_sim.environment`, not real sensor silicon; `rpi_sim.analog` converts
  solved node voltages for ADC front ends.
* All timers and edge callbacks run on the **virtual clock**, advanced by
  `time.sleep()`; there are no real threads or interrupts.

Proof: `npm test` -> `ALL BOARDS / ALL PERIPHERALS / 56 LIBRARIES PASS`.
