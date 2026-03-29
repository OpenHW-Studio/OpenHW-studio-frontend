# ⚙️ OpenHW-Studio: Universal Emulator Backend

> **Role:** A high-speed WebSocket Node.js server that runs the simulated CPU environment for the platform.

---

##  Key Integrations

*   **WebSocket Architecture**
    *   Operates an independent high-speed `ws` server on port `8085`.
    *   Decoupling the CPU from the React frontend guarantees extreme performance scalability.
*   **AVR Core Integration (`avr8js`)**
    *   Instantiates a virtual ATmega328P CPU in raw memory.
    *   Parses and injects incoming `.hex` machine code into the CPU buffer.
    *   Replaced deprecated timer routines with native `AVRTimer` execution loops to prevent crash states.
*   **Hardware Memory Hooks**
    *   Directly intercepts core I/O memory writes to track physical Arduino pins.
    *   Maps `PORTB (0x25)` to `D8-D13`, `PORTC (0x28)` to `A0-A5`, and `PORTD (0x2B)` to `D0-D7`.
    *   Accurately evaluates binary state shifts (e.g., matching PORTB Bit 5 to Pin D13).
*   **WS2812 NeoPixel Protocol Decoder**
    *   Accepts NeoPixel wiring topology (component ID, Arduino pin, matrix dimensions) from the frontend at simulation start.
    *   Maps Arduino pin names (e.g., `D6`) to AVR port addresses and bit masks via `getPinPortMapping()`.
    *   Intercepts port write hooks and decodes WS2812 bit-bang timing: `HIGH > 10 cycles = bit 1`, `LOW > 800 cycles = reset/flush`.
    *   Accumulates 24-bit GRB color bytes per pixel, converts to RGB floats, and stores in `neopixelState`.
    *   Broadcasts decoded pixel data (`neopixels` field) alongside pin states at 60 FPS.
*   **Real-time Output Streaming**
    *   Executes a continuous, non-blocking `setImmediate` instruction loop.
    *   Broadcasts serialized JSON state payloads (e.g., `{"type": "state", "pins": {"D13": true}}`) at ~60 FPS.
*   **Repository Hygiene**
    *   Includes a comprehensive `.gitignore` preventing generated `out.txt` arrays and module dependencies from polluting version control.

---

##  Recent Bug Fixes: The `delay()` & Continuous Glow Issue

We recently resolved a major physics bug where the simulated LED would continuously glow instead of blinking, and `delay()` commands were ignored. The following fixes were applied to `server.js`:

1.  **Fixed CPU Execution Speed:** The `runSimulation` loop was previously using `setImmediate` to run as fast as Node.js allowed, completing a 1000ms delay in less than a millisecond. We implemented a real-time synced `deltaTime` calculation to strictly limit execution to **16,000 cycles per real-time millisecond** (simulating a 16MHz clock).
2.  **Fixed Write Hooks Blocking:** The memory interceptors (`cpu.writeHooks`) for the IO pins were previously ending with `return true;`, which in `avr8js` means "cancel this memory write". This broke internal state tracking. They now correctly `return false;`.
3.  **Enabled Hardware Timers:** The Arduino `delay()` and `millis()` functions rely on internal hardware timers ticking. We explicitly imported `timer0Config`, `timer1Config`, and `timer2Config` and instantiated them with `new AVRTimer()` inside the CPU context. We also added `cpu.tick()` to the execution loop to physically advance these timers alongside the CPU instructions.

*Generated for the Universal Emulator Integration.*

---

## 🧩 Simulator Components Library

The emulator includes a massive suite of interactive, physics-driven hardware components. Each component is fully integrated into the simulation engine with its own physical dimensions, interactive SVG UI, and JavaScript-based electrical behavior logic.

### Displays & Graphics
* **Nokia 5110 Screen (`wokwi-nokia-5110`)**: An 84x48 pixel monochrome LCD. It implements an internal SPI receiver and PCD8544 controller firmware to decode instruction signals and render an active hex framebuffer directly onto the UI.

### Motors & Actuation Drivers
* **L293D Motor Driver (`wokwi-l293d`)**: A dual H-Bridge chip mapping logic enables/disables arrays to output pins for driving analog power.
* **A4988 Stepper Driver (`wokwi-a4988`)**: A bipolar stepper motor driver interpreting `STEP` and `DIR` pin pulses into cyclic phase waveforms.
* **Biaxial Stepper Motor (`wokwi-stepper-motor`)**: A visual 4-wire bipolar motor that calculates coil phase overlaps to physically rotate its SVG shaft in the UI!
* **16-Channel PWM/Servo HAT (`wokwi-pca9685`)**: An Adafruit-style board featuring a custom-built I2C state machine (listening on `0x40`) to translate 12-bit register payloads into explicit duty cycles across 16 motor headers.
* **16-Channel PWM/Servo Breakout (`wokwi-pca9865`)**: A standalone breakout variant of the PCA9685 controller, featuring distinct side-chaining I2C headers and color-coded PWM output banks.

### Boards & Shields
* **Arduino Nano Type-C (`wokwi-arduino-nano`)**: A modernized variant of the Nano featuring a Type-C USB interface and additional breakout pins for `PE0` and `PE1` signal lines.
* **Arduino Sensor Shield v5.0 (`wokwi-arduino-sensor-shield`)**: A massive visual and electrical pass-through shield that splits every Uno pin into dedicated G-V-S header triplets for simplified sensor wiring.

### ICs, Multiplexers & Logic
* **16-Ch Analog Multiplexer (`wokwi-cd74hc4067`)**: Decodes 4-bit binary addressing (`S0-S3`) to bidirectionally route analog voltages between a common signal pin and 16 independent channels.
* **SPI Tri-Color LED Driver (`wokwi-nlsf595`)**: An SPI shift register configured to latch serial bitstreams and drive multi-color outputs.
* **8-Ch Logic Analyzer (`wokwi-logic-analyzer`)**: A specialized debug component that constantly monitors `D0-D7` for edge transitions and visually pulses its activity LED upon bus changes.
* **Digital Logic Gate Suite**: A full collection of high-performance virtual gates including **NOT, AND, OR, NOR, NAND, XOR, XNOR**, plus **2-to-1 Multiplexers** and multiple **D-FlipFlop** variants for advanced digital logic simulation.

### Environmental Sensors & Inputs
* **Rotary Encoder (`wokwi-rotary-encoder`)**: Provides physical interaction inputs mapped to an internal quadrature generator (`CLK` / `DT`) and a pushbutton switch state.
* **Soil Moisture Sensor (`wokwi-soil-moisture-sensor`)**: Translates a generic internal UI moisture variable (0-100%) into inverse analog voltages on `A0` and a digital comparator trigger on `D0`.
* **Photodiode (`wokwi-photodiode`)**: A light sensor logic model that modulates reverse-bias current leakage according to its interactive incident light level.

### Discrete Electrics & Basics
* **NPN Transistor (`wokwi-npn-transistor`)**: Uses simple base-emitter junction saturation logic to bridge Collector voltages across to its Emitter.
* **Diode (`wokwi-diode`)**: Models the standard 0.7V forward-bias path, completely blocking reverse voltages.
* **RGB LED (`wokwi-rgb-led`)**: Fully models dynamic color lighting by computing relative pin voltages to a defined Common-Cathode orientation.
* **Mini & Half Breadboards (`wokwi-breadboard-mini`, `wokwi-breadboard-half`)**: Specialized SVG topologies that implement exact tie-point connection maps for the netlist compiler, including missing power rails on the mini variant!
