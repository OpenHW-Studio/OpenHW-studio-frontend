# OpenHW Emulator - Simulation Engine

> The core simulation engine and component registry for the OpenHW Studio platform. It provides AVR CPU emulation (via `avr8js`), circuit validation logic, and shared component manifests.

---

## Overview

The Emulator package is a shared library that defines how components behave and how the simulation runs. It is consumed by both the **Frontend** (as a Web Worker) and can be run as a standalone **Node.js server** for validation or remote simulation services.

### Key Responsibilities:
- **CPU Emulation**: Wraps `avr8js` to simulate ATmega328P (Arduino Uno) at 16MHz.
- **Component Registry**: Defines the JSON manifests for all supported components (LEDs, LCDs, Motors, etc.).
- **Circuit Validation**: Implements a graph-based validation engine to detect wiring errors (e.g., short circuits, missing resistors) before simulation starts.
- **Pin Logic**: Handles the digital and analog signal mapping between the CPU and virtual components.

---

## Project Structure

```
openhw-studio-emulator-danish/
├── src/
│   ├── components/         # Manifests and logic for all virtual components
│   ├── circuit-validation/ # Graph-based wiring safety checker
│   ├── avr/               # AVR CPU orchestration logic
│   ├── server.js          # Standalone WebSocket/HTTP simulation server
│   └── index.ts/js        # Library entry point
├── package.json
└── README.md
```

---

## Usage

### In the Frontend
The frontend links to this package via `npm link` and imports component definitions. The simulation execution loop runs inside a Web Worker (`simulation.worker.ts`) using the logic exported from here.

### Standalone Server
You can run a standalone simulation server that accepts hex files and streams pin states via WebSockets:

```bash
npm install
npm start
```
The server will start on port `8080` (default).

---

## Development & Linking

To use this local package in the frontend during development:

1. **Register the link**:
   ```bash
   cd openhw-studio-emulator-danish
   npm link
   ```

2. **Link from frontend**:
   ```bash
   cd ../OpenHW-studio-frontend-danish
   npm link @openhw/emulator
   ```

---

*Part of the OpenHW Studio platform. See also: [OpenHW-studio-frontend-danish](../OpenHW-studio-frontend-danish) and [openhw-studio-backend-danish](../openhw-studio-backend-danish).*
