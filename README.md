# OpenHW Studio — Universal Emulator

> A high-performance Node.js WebSocket server that runs a virtual ATmega328P (Arduino Uno) CPU in software, streams live pin state at ~60 FPS, and decodes WS2812B NeoPixel signals in real time.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Components Library](#components-library)
- [Key Features](#key-features)
- [WebSocket Protocol](#websocket-protocol)
- [Setup & Running Locally](#setup--running-locally)
- [How the CPU Simulation Works](#how-the-cpu-simulation-works)

---

## Overview

The Universal Emulator is the **simulation engine** of OpenHW Studio. It:

- Accepts a compiled `.hex` file and circuit wiring topology over WebSocket from the frontend
- Instantiates a virtual **ATmega328P** CPU (the chip inside an Arduino Uno) using `avr8js`
- Executes firmware instructions at a simulated **16 MHz clock speed**
- Monitors AVR hardware memory registers to track the live voltage of every I/O pin
- Broadcasts the pin state as JSON to the frontend at **~60 FPS**
- Decodes **WS2812B NeoPixel** bit-bang signals and streams per-pixel RGB color data
- Routes **I2C (TWI)** and **SPI** datagrams faithfully to `BaseComponent` event interfaces.
- Integrates native **Hardware Interrupts (EXTI/PCINT)** and **Internal Pull-Up Resistors** via `AVRIOPort`
- Provides a shared **component definitions library** (`src/components/`) consumed by the frontend

The server runs on **ws://localhost:8085**.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| `ws` | WebSocket server |
| `avr8js` | ATmega328P CPU emulation |
| `intel-hex` | Parsing Intel HEX firmware format |
| TypeScript | Component library type safety |
| MongoDB (via `connectDB.js`) | Optional persistence layer |

---

## Project Structure

```
openhw-studio-emulator-danish/
├── src/
│   ├── server.js               # WebSocket server entry point
│   ├── connectDB.js            # MongoDB connection (optional)
│   └── components/             # Shared component definitions library
│       ├── index.ts            # Exports all component definitions
│       ├── BaseComponent.ts    # Base class/interface for components
│       ├── auth/               # Auth-related component helpers
│       ├── wokwi-arduino-uno/  # Arduino Uno board definition
│       ├── wokwi-led/          # LED component
│       ├── wokwi-resistor/     # Resistor component
│       ├── wokwi-pushbutton/   # Push button component
│       ├── wokwi-power-supply/ # Power supply component
│       ├── wokwi-buzzer/       # Buzzer component
│       ├── wokwi-motor/        # DC Motor component
│       ├── wokwi-motor-driver/ # L298N Motor Driver component
│       ├── wokwi-servo/        # Servo motor component
│       ├── wokwi-potentiometer/         # Rotary potentiometer
│       ├── wokwi-slide-potentiometer/   # Slide potentiometer
│       └── wokwi-neopixel-matrix/       # WS2812B NeoPixel matrix
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
| `manifest.json` | Pin definitions, display name, default dimensions |
| `ui.ts` | SVG/HTML rendering of the component on the canvas |
| `logic.ts` | Simulation behavior (how pins react to state) |
| `index.ts` | Barrel export combining manifest + ui + logic |

The `src/components/index.ts` file re-exports all components and is consumed by the frontend via the `@openhw/emulator` npm workspace package:

```ts
import { wokwiLed, wokwiArduinoUno, wokwiResistor, ... } from "@openhw/emulator/src/components/index.ts";
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

---

## Key Features

### ⚡ Real ATmega328P Emulation

- Loads `.hex` firmware using `intel-hex` parser
- Injects machine code directly into a virtual CPU memory buffer
- Executes AVR instructions via `avr8js` CPU core
- Clock-accurate execution: **16,000 cycles per real millisecond** (16 MHz)

### 🔌 Hardware Register Pin Tracking & Interrupts

We leverage the `avr8js` native `AVRIOPort` definitions (instead of unsafe raw memory hooks) ensuring complete internal logic handling. This enables seamless support for:
- `pinMode(INPUT_PULLUP)` (internal MCU resistors)
- `attachInterrupt(0, ...)` (INT0 / INT1 External Interrupts)
- **PCINT** boundaries seamlessly synced via `updatePhysics()`.

| Register | Address | Arduino Pins |
|---|---|---|
| `PORTB` | `0x25` | D8 – D13 |
| `PORTC` | `0x28` | A0 – A5 |
| `PORTD` | `0x2B` | D0 – D7 |

Each bit in the register maps to an individual pin natively triggering the MCU's internal event loop payload.

### ⏱️ Hardware Timer Support

`delay()` and `millis()` depend on hardware timers. The emulator instantiates all three AVR timer peripherals:

```js
new AVRTimer(cpu, timer0Config);
new AVRTimer(cpu, timer1Config);
new AVRTimer(cpu, timer2Config);
```

`cpu.tick()` is called each cycle to advance timers in lockstep with the CPU.

### 🌈 WS2812B NeoPixel Decoder

The emulator decodes the WS2812B bit-bang protocol entirely in software:

1. Frontend sends NeoPixel topology in the `START` message: `{ componentId, arduinoPin, rows, cols }`
2. `getPinPortMapping()` resolves the pin name (e.g., `"D6"`) to an AVR port address + bit mask
3. A write hook watches for `HIGH > 10 cycles` (bit 1) and `LOW > 800 cycles` (latch/flush)
4. 24-bit GRB bytes are accumulated per pixel, converted to RGB floats, and stored in `neopixelState`
5. Pixel data is broadcast alongside pin states every frame

### 📡 60 FPS State Streaming

A continuous `setImmediate` loop runs the CPU and broadcasts state:

```json
{
  "type": "state",
  "pins": { "D13": true, "D6": false, "A0": false },
  "neopixels": [
    { "id": "matrix1", "pixels": [[{ "r": 1.0, "g": 0.0, "b": 0.0 }, ...], ...] }
  ]
}
```

---

## WebSocket Protocol

### Client → Server

#### `START` message
Sent by the frontend to begin simulation:

```json
{
  "type": "START",
  "hex": ":100000000C945C000C947900...",
  "neopixels": [
    { "componentId": "matrix1", "arduinoPin": "D6", "rows": 8, "cols": 8 }
  ]
}
```

#### `STOP` message
```json
{ "type": "STOP" }
```

### Server → Client

#### `state` message (sent at ~60 FPS)
```json
{
  "type": "state",
  "pins": { "D13": true },
  "neopixels": [...]
}
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

### Start the Emulator Server

```bash
node src/server.js
```

The WebSocket server will be listening at **ws://localhost:8085**

---

## How the CPU Simulation Works

```
Frontend sends START + .hex + wiring
          │
          ▼
intel-hex parser decodes .hex into binary
          │
          ▼
Binary loaded into AVR CPU memory buffer (avr8js)
          │
          ▼
setImmediate loop:
  ├── Execute 16,000 CPU cycles (= 1ms real time)
  ├── cpu.tick() — advance hardware timers
  ├── Write hooks detect PORTB/C/D register changes
  ├── NeoPixel decoder accumulates GRB bit-bang signals
  └── Broadcast { pins, neopixels } JSON to frontend
          │
          ▼
Frontend updates Wokwi component DOM (LEDs, NeoPixels, etc.)
```

---

*Part of the OpenHW Studio platform. See also: [OpenHW-studio-frontend-danish](../OpenHW-studio-frontend-danish) and [openhw-studio-backend-danish](../openhw-studio-backend-danish).*