# OpenHW Studio — Universal Emulator

> A high-performance component definitions library and in-browser AVR simulation engine. Runs a virtual ATmega328P (Arduino Uno) CPU inside a Web Worker, streams live pin state at ~60 FPS, and decodes WS2812B NeoPixel signals in real time.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Components Library](#components-library)
- [Key Features](#key-features)
- [WebSocket Protocol (Legacy)](#websocket-protocol-legacy)
- [Setup & Running Locally](#setup--running-locally)
- [How the CPU Simulation Works](#how-the-cpu-simulation-works)

---

## Overview

The Emulator package serves two roles in OpenHW Studio:

1. **Shared Component Definitions Library** (`src/components/`) — exports manifests, SVG/React UI renderers, and simulation logic classes for every built-in component. Consumed by the frontend via the `@openhw/emulator` npm workspace alias.

2. **AVR Simulation Engine** (`src/worker/execute.ts` in the frontend) — instantiates a virtual **ATmega328P** CPU using `avr8js`, runs firmware instructions at a simulated 16 MHz clock, and streams pin/component state at ~60 FPS. The simulation runs entirely **inside the browser** as a Web Worker — no separate server process is needed.

The package also includes:
- **Circuit Validation Engine** — graph-based wiring safety checks before simulation starts
- **BaseComponent** abstract class — defines the interface all component logic classes implement
- Support for **I2C (TWI)**, **SPI**, **ADC**, **USART**, and **WS2812B NeoPixel** protocols

---

## Tech Stack

| Technology | Purpose |
|---|---|
| TypeScript | Component library type safety |
| `avr8js` | ATmega328P CPU emulation |
| `intel-hex` | Parsing Intel HEX firmware format |
| React | Component UI renderers (consumed by frontend) |
| Node.js | Optional standalone server (legacy WebSocket mode) |

---

## Project Structure

```
openhw-studio-emulator-danish/
├── src/
│   ├── server.js               # Legacy WebSocket server entry point (not used in main flow)
│   ├── connectDB.js            # MongoDB connection (optional)
│   ├── circuit-validation/     # Physics & Wiring Validation Engine
│   │   ├── engine.js           # Graph-based validation logic
│   │   └── rules/              # Modular safety check definitions
│   └── components/             # Shared component definitions library
│       ├── index.ts            # Exports all component definitions
│       ├── BaseComponent.ts    # Base class/interface for all component logic
│       ├── wokwi-arduino-uno/  # Arduino Uno board definition
│       ├── wokwi-led/          # LED component
│       ├── wokwi-resistor/     # Resistor component
│       ├── wokwi-pushbutton/   # Push button component
│       ├── wokwi-power-supply/ # Power supply component
│       ├── wokwi-buzzer/       # Buzzer component
│       ├── wokwi-motor/        # DC motor component
│       ├── wokwi-motor-driver/ # L298N Motor Driver component
│       ├── wokwi-servo/        # Servo motor component
│       ├── wokwi-potentiometer/         # Rotary potentiometer
│       ├── wokwi-slide-potentiometer/   # Slide potentiometer
│       ├── wokwi-neopixel-matrix/       # WS2812B NeoPixel matrix
│       └── shift_register/     # 74HC595 shift register
├── test_pins.js                # Standalone pin testing script
├── test_ws.js                  # WebSocket connection test script
├── package.json
└── .gitignore
```

---

## Components Library

Each component lives in its own folder under `src/components/` and exports four files:

| File | Purpose |
|---|---|
| `manifest.json` | Pin definitions, display name, group, default dimensions |
| `ui.tsx` | React/SVG rendering of the component on the canvas |
| `logic.ts` | Simulation behaviour (how pins react to state, I2C/SPI callbacks) |
| `validation.ts` | Circuit safety rules checked before simulation starts |
| `index.ts` | Barrel export combining manifest + ui + logic + validation |

The `src/components/index.ts` file re-exports all components and is consumed by the frontend via the `@openhw/emulator` npm workspace package:

```ts
import * as EmulatorComponents from '@openhw/emulator/src/components/index.ts';
```

### Supported Components

| Component | Description |
|---|---|
| `wokwi-arduino-uno` | Main Arduino Uno microcontroller board |
| `wokwi-led` | Standard LED (digital output) |
| `wokwi-resistor` | Passive resistor |
| `wokwi-pushbutton` | Momentary push button (digital input) |
| `wokwi-power-supply` | 5V / GND power rail |
| `wokwi-buzzer` | Piezo buzzer (digital output) |
| `wokwi-motor` | DC motor |
| `wokwi-motor-driver` | L298N dual H-bridge motor driver |
| `wokwi-servo` | Standard servo motor (PWM input) |
| `wokwi-potentiometer` | Rotary analog potentiometer (ADC input) |
| `wokwi-slide-potentiometer` | Slide analog potentiometer (ADC input) |
| `wokwi-neopixel-matrix` | WS2812B addressable RGB LED matrix |
| `shift_register` | 74HC595 8-bit serial-in parallel-out shift register |

### Dynamic Component Management

The emulator supports runtime injection of custom components:
- **Backend Sync**: The frontend polls every 12 seconds for newly approved components and injects them into the browser-side registry without a page refresh.
- **FS Integration**: Admin approval writes component files directly into `src/components/`, making them permanent on the next server restart.
- **Zero-Touch Pipeline**: Community-contributed Wokwi-compatible components can be integrated without manual code changes.
- **Offline ZIP Queue**: Components uploaded while offline are queued in IndexedDB and submitted automatically when connectivity is restored.

### Modular Circuit Validation Engine

Before simulation begins, the **FullCircuitValidator** runs safety checks:
- **Graph-Based Adjacency**: Builds a complete map of every connected pin.
- **Physics Propagation**: Traces paths back to power sources through passive components.
- **Smart Safety Rules**:
  - **Current Limiting**: Detects LEDs connected directly to power without a current-limiting resistor.
  - **Short Circuit Detection**: Identifies direct GND-to-VCC paths.
  - **Pin Conflict**: Warns when multiple outputs drive the same node.
- **Halt on Error**: Returns a list of specific errors displayed in the UI; simulation is blocked until resolved.

---

## Key Features

### Real ATmega328P Emulation

- Loads `.hex` firmware using `intel-hex` parser
- Injects machine code directly into a virtual CPU memory buffer
- Executes AVR instructions via `avr8js` CPU core
- Clock-accurate execution: **16,000 cycles per real millisecond** (16 MHz)

### Hardware Register Pin Tracking & Interrupts

Uses `avr8js` native `AVRIOPort` definitions (not raw memory hooks), enabling:
- `pinMode(INPUT_PULLUP)` (internal MCU resistors)
- `attachInterrupt(0, ...)` (INT0 / INT1 External Interrupts)
- **PCINT** boundaries via `updatePhysics()`

| Register | Address | Arduino Pins |
|---|---|---|
| `PORTB` | `0x25` | D8 – D13 |
| `PORTC` | `0x28` | A0 – A5 |
| `PORTD` | `0x2B` | D0 – D7 |

### Hardware Timer Support

`delay()` and `millis()` depend on hardware timers. All three AVR timer peripherals are instantiated:
```js
new AVRTimer(cpu, timer0Config);
new AVRTimer(cpu, timer1Config);
new AVRTimer(cpu, timer2Config);
```

### WS2812B NeoPixel Decoder

1. Frontend sends NeoPixel topology in the `START` message: `{ componentId, arduinoPin, rows, cols }`
2. `getPinPortMapping()` resolves the pin name to an AVR port address + bit mask
3. A write hook watches for `HIGH > 10 cycles` (bit 1) and `LOW > 800 cycles` (latch/flush)
4. 24-bit GRB bytes are accumulated per pixel, converted to RGB floats, and stored in `neopixelState`
5. Pixel data is broadcast alongside pin states every frame

### 60 FPS State Streaming

A continuous loop runs the CPU and posts state to the main thread:
```json
{
  "type": "state",
  "pins": { "D13": true, "D6": false, "A0": false },
  "neopixels": [
    { "id": "matrix1", "pixels": [[{ "r": 1.0, "g": 0.0, "b": 0.0 }, ...], ...] }
  ]
}
```

### I2C / SPI / ADC / USART

- **TWI (I2C)**: `TWIAdapter` bridges `AVRTWI` events to `BaseComponent.onI2CStart/Byte/Stop/ReadByte`
- **SPI**: `spi.onByte` delegates to components implementing `onSPIByte`
- **ADC**: Reads analog voltages from component `getAnalogVoltage()` return values
- **USART**: Serial output callback for `Serial.print()` output; `serialRx()` for loopback

---

## WebSocket Protocol (Legacy)

`src/server.js` implements a standalone WebSocket server (`ws://localhost:8085`). This was the original architecture. The current frontend uses the Web Worker (`execute.ts`) directly instead, so this server is **no longer required** for normal operation.

### Client → Server

```json
{ "type": "START", "hex": ":100000...", "neopixels": [...] }
{ "type": "STOP" }
```

### Server → Client

```json
{ "type": "state", "pins": { "D13": true }, "neopixels": [...] }
```

---

## Setup & Running Locally

### Prerequisites

- **Node.js 18+**
- **npm 9+**

### Installation

```bash
cd openhw-studio-emulator-danish
npm install
```

### Start the Legacy WebSocket Server (optional)

```bash
node src/server.js
```

The WebSocket server will be listening at **ws://localhost:8085**.

> In the current architecture, the frontend uses the in-browser Web Worker and does not connect to this server. You only need to run it if you are testing the legacy WebSocket integration.

---

## How the CPU Simulation Works

```
Frontend sends START + .hex + wiring
(or hex served from IndexedDB offline cache)
          │
          ▼
intel-hex parser decodes .hex into binary
          │
          ▼
Binary loaded into AVR CPU memory buffer (avr8js)
          │
          ▼
Web Worker run loop (setTimeout-based, 1ms ticks):
  ├── Execute cycles proportional to wall-clock delta (16 MHz)
  ├── cpu.tick() — advance hardware timers
  ├── AVRIOPort callbacks detect PORTB/C/D register changes
  ├── Wire netlist propagates pin state to connected components
  ├── NeoPixel decoder accumulates GRB bit-bang signals
  ├── I2C/SPI/ADC events dispatched to component logic
  └── Broadcast { pins, neopixels, components } to main thread at 60 FPS
          │
          ▼
Frontend updates Wokwi component DOM (LEDs, NeoPixels, etc.)
```

---

*Part of the OpenHW Studio platform. See also: [OpenHW-studio-frontend-danish](../OpenHW-studio-frontend-danish) and [openhw-studio-backend-danish](../openhw-studio-backend-danish).*
