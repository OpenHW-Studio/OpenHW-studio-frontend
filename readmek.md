# OpenHW Studio Frontend Notes

This file is kept for backward compatibility.

Use the main documentation in README.md for current setup and feature details.

Recent frontend updates are documented there, including:

- Pico dual-source folder defaults (`<boardId>.ino` + `main.py`)
- file disable/enable support with `.disabled` suffix
- duplicate explorer file dedupe on refresh/load
- RP2040 compile fallback to MicroPython when backend core is missing

*   **Simulator Service API**
    *   Utilizes a clean Axios wrapper (`simulatorService.js`) to pipe editor code to the background compilation cluster.
*   **Run/Stop State Transitions**
    *   **Run:** Triggers background compilation, awaits `.hex` generation, and initiates a secure `ws://localhost:8085` emulator handshake.
    *   **Stop:** Gracefully terminates the `wsRef` connection socket and safely garabage-collects the background CPU process.
*   **Dynamic Visual Rendering**
    *   Processes rapid JSON pin updates (60 FPS) streamed down the WebSocket.
    *   Intercepts state mutations to dynamically re-evaluate visual styles.
    *   Causes connected `wokwi-elements` custom HTML tags (like LEDs) to power on or off in exact sync with backend logic.
*   **NeoPixel Matrix Support**
    *   Added `wokwi-neopixel-matrix` to `PIN_DEFS` with `GND`, `VCC`, `DIN`, `DOUT` pin definitions.
    *   Component palette includes two presets: **NeoPixel 8×8** and **NeoPixel 16×16**.
    *   Uses a **ref-based rendering** approach to call `element.setPixel(row, col, {r,g,b})` directly on the Wokwi DOM element — unlike simple LEDs which use HTML attributes.
    *   Sends NeoPixel wiring topology (component ID, Arduino pin, matrix size) to the emulator in the WebSocket `START` message.
    *   Validation rules warn when DIN or GND pins are not connected.
*   **Wokwi Component Glitches Fixed**
    *   Discovered an inherent UI bug where Wokwi LEDs evaluate the `value="0"` attribute as truthy.
    *   Overhauled the `getComponentStateAttrs` engine so the `value` property is actively injected or deleted from the DOM based on physical voltage rules.

---

## 🛠️ Implemented Components Library (v1.2 Expansion)

The following components have been fully integrated into the simulator palette:

### Controllers & Boards
- **Arduino Nano Type-C**: Modernized Nano clone with PE0/PE1 breakouts.
- **Arduino Sensor Shield v5.0**: G-V-S expansion shield for Arduino Uno.

### Actuators & Drivers
- **16-Channel PWM/Servo Pi HAT (PCA9685)**: I2C-based 16-channel motor driver.
- **16-Channel PWM Breakout (PCA9865)**: Daisy-chainable standalone PWM module.
- **L293D Dual H-Bridge**: High-current motor driver IC.
- **A4988 Stepper Driver**: Precise bipolar stepper controller.
- **Biaxial Stepper Motor**: Interactive 4-wire stepper with visual shaft rotation.

### Sensors & Inputs
- **Soil Moisture Sensor**: Analog/Digital soil probe with interactive moisture slider.
- **Nokia 5110 LCD**: 84x48 monochrome graphical display (SPI).
- **Photodiode**: Light-sensitive leakage diode with interactive Lux control.
- **Rotary Encoder**: Incremental encoder with pushbutton.

### Logic & Discrete
- **Digital Logic Suite**: Full set of 74-series style logic gates and D-FlipFlops.
- **8-Channel Logic Analyzer**: Real-time D0-D7 bus monitor.
- **NPN Transistor (BJT)**: TO-92 standard switching component.
- **Rectifier Diode**: 1N4007-style voltage gate.
- **CD74HC4067 Multiplexer**: 16-channel analog/digital MUX.
- **NLSF595 SPI Driver**: Serialization shift register for LEDs.

---
*Generated for the Universal Emulator Integration.*

