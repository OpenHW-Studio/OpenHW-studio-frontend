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

### Runtime Notes (March 2026)
- RP2040/Pico simulation paths now use validated firmware vector loading to avoid invalid-memory execution loops from malformed firmware payloads.
- Frontend code explorer supports per-file disable/enable via `.disabled` suffix; disabled files are ignored during source selection.

---

## Project Structure

```
openhw-studio-emulator-danish/
├── src/
│   ├── components/         # Manifests and logic for all virtual components (Entry Point)
│   │   └── index.ts        # Library exports
│   ├── circuit-validation/ # Graph-based wiring safety checker
│   ├── avr/               # AVR CPU orchestration logic
│   └── server.js          # Standalone WebSocket/HTTP simulation server
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

## Deployment Note (Vercel & Docker)

When deploying to **Vercel** or other cloud platforms, ensure that you are using the package version from GitHub (e.g., `"@openhw/emulator": "github:OpenHW-Studio/openhw-studio-emulator#develop"`) in your `package.json`.

For **Docker** environments, you can mount the local emulator folder to the container and set the `EMULATOR_PATH` environment variable in your `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - EMULATOR_PATH=/usr/src/openhw-studio-emulator-danish
    volumes:
      - ./openhw-studio-emulator-danish:/usr/src/openhw-studio-emulator-danish
```

---

*Part of the OpenHW Studio platform. See also: [OpenHW-studio-frontend-danish](../OpenHW-studio-frontend-danish) and [openhw-studio-backend-danish](../openhw-studio-backend-danish).*

