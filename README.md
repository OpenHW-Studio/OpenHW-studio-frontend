# OpenHW Studio — React Frontend

> The interactive web-based UI for the OpenHW Studio electronics simulation platform. Built with React + Vite, it renders a drag-and-drop circuit editor, streams live simulation state from the emulator, and drives Wokwi web components in real time.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Pages](#pages)
- [Key Features](#key-features)
- [Setup & Running Locally](#setup--running-locally)
- [Environment & Dependencies](#environment--dependencies)
- [How It Works](#how-it-works)

---

## Overview

OpenHW Studio Frontend is the **visual client** of the simulator platform. It allows users to:

- Design circuits by placing and wiring components on a canvas
- Write and edit Arduino C++ code in a built-in syntax-highlighted editor
- Compile and run simulations powered by the backend compiler and emulator
- Watch simulation output in real time (LEDs blinking, NeoPixels lighting up, servo movement, etc.)

It connects to two separate backend services:
- **Compiler Backend** (`http://localhost:5000`) — compiles C++ code to `.hex`
- **Emulator WebSocket** (`ws://localhost:8085`) — streams live CPU/pin state at ~60 FPS

---

## Tech Stack

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite 5 | Build tool and dev server |
| React Router DOM | Client-side routing |
| Axios | HTTP requests to compiler backend |
| avr8js | AVR CPU emulation (used in Web Worker) |
| intel-hex | Parsing `.hex` firmware files |
| Prism.js | Syntax highlighting in code editor |
| react-simple-code-editor | Embedded code editor component |
| @react-oauth/google | Google OAuth login |
| jwt-decode | Decoding JWT auth tokens |
| @openhw/emulator | Shared component definitions (workspace package) |

---

## Project Structure

```
OpenHW-studio-frontend-danish/
├── index.html                  # App entry HTML
├── vite.config.js              # Vite configuration
├── package.json
└── src/
    ├── main.jsx                # React app bootstrap
    ├── App.jsx                 # Route definitions
    ├── index.css               # Global styles
    ├── pages/
    │   ├── LandingPage.jsx     # Public home/landing page
    │   ├── LoginPage.jsx       # Google OAuth login
    │   ├── RoleSelectPage.jsx  # Student / Teacher role selection
    │   ├── SimulatorPage.jsx   # Main circuit editor + simulation runner
    │   ├── StudentDashboard.jsx
    │   └── TeacherDashboard.jsx
    ├── context/
    │   └── AuthContext.jsx     # Global authentication state
    ├── services/
    │   ├── authService.js      # Login, logout, token management
    │   └── simulatorService.js # POST /api/compile to backend
    ├── worker/
    │   ├── simulation.worker.ts   # Web Worker entry point
    │   └── execute.ts             # AVR CPU execution loop inside worker
    └── components/             # Shared UI components
```

---

## Pages

### `SimulatorPage.jsx`
The core of the application. Responsibilities include:
- **Circuit Canvas** — drag, drop, and wire Wokwi components
- **Code Editor** — write Arduino sketches with syntax highlighting
- **Run/Stop** — triggers compilation → `.hex` delivery → WebSocket START to emulator
- **Live State Rendering** — receives `{ type: "state", pins: {...} }` JSON at 60 FPS and updates component visual attributes (e.g., LED on/off, NeoPixel colors)
- **Component Registry** — maps component type names to their imported index definitions from `@openhw/emulator`

### `LoginPage.jsx`
Google OAuth 2.0 login page. Decodes JWT and stores user info in `AuthContext`.

### `LandingPage.jsx`
Public-facing landing page describing the platform.

### `StudentDashboard.jsx` / `TeacherDashboard.jsx`
Role-specific dashboards shown after login.

---

## Key Features

### 🔴 Real-time Simulation Rendering (60 FPS)
The frontend opens a WebSocket to the emulator (`ws://localhost:8085`). Every frame, the emulator sends a JSON state payload describing pin voltages and NeoPixel colors. The frontend maps this to DOM attribute changes on Wokwi custom HTML elements.

```json
{ "type": "state", "pins": { "D13": true, "D6": false }, "neopixels": [...] }
```

### 🌈 NeoPixel Matrix Support
- Wires NeoPixel components with `GND`, `VCC`, `DIN`, `DOUT` pins
- Sends matrix topology (component ID, Arduino pin, size) in the WebSocket `START` message
- Calls `element.setPixel(row, col, {r, g, b})` directly on the Wokwi DOM element

### 📊 Analog Plotter / Logic Graph
- The Code Editor pane now includes a native high-performance **`<canvas>` rendering engine** tab to trace simulated logic and analog signals.
- Users can dynamically specify which pins to track out of the simulation data stream.

### 💬 Serial Monitor Integration
- A built-in terminal stream handles natively piping `AVRUSART` traffic backwards and forwards into the `.hex` loop.

### 🔄 Physical Workspace Controls
- The **Arduino Uno Reset Button** is fully interactive inside the workspace SVG visualizer, triggering a targeted web-worker core `runner.cpu.reset()` reboot.

### 💡 Wokwi LED Fix
Wokwi LEDs incorrectly treat `value="0"` as truthy. The frontend's `getComponentStateAttrs` engine **injects or deletes** the `value` DOM property based on actual voltage rather than setting it to `"0"`.

### ⚙️ Web Worker Simulation
AVR simulation can also run in-browser via `src/worker/execute.ts` inside a Web Worker, keeping the UI thread unblocked.

### 🔒 Auth Flow
- Google OAuth → JWT stored in context
- Role selection (Student / Teacher) → role-specific dashboard
- Protected routes via `AuthContext`

---

## Setup & Running Locally

### Prerequisites
- Node.js 18+
- npm 9+
- The **Compiler Backend** running at `http://localhost:5000`
- The **Emulator** running at `ws://localhost:8085`

### Installation

```bash
# From the monorepo root (recommended)
cd c:\Users\Danish\Documents\simulator
npm install

# Or from this folder directly
cd OpenHW-studio-frontend-danish
npm install
```

### Start Development Server

```bash
npm run dev
```

The app will be available at **http://localhost:5173**

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## Environment & Dependencies

The frontend relies on the shared `@openhw/emulator` workspace package for component type definitions. This is resolved automatically by the npm workspace at the monorepo root. Make sure you run `npm install` from the root (`simulator/`) directory.

---

## How It Works

```
User writes C++ code
        │
        ▼
POST /api/compile  ──►  Compiler Backend (port 5000)
                                │
                         Returns .hex file
                                │
                                ▼
        Frontend sends START + .hex + wiring topology
                                │
                         ws://localhost:8085
                                │
                         Emulator Backend
                                │
                    Streams pin states at 60 FPS
                                │
                                ▼
        Frontend updates Wokwi component DOM attributes
                    (LEDs, NeoPixels, Servo, etc.)
```

---

*Part of the OpenHW Studio platform. See also: [openhw-studio-backend-danish](../openhw-studio-backend-danish) and [openhw-studio-emulator-danish](../openhw-studio-emulator-danish).*