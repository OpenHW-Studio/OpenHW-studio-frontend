# OpenHW Studio — React Frontend

> The interactive web-based UI for the OpenHW Studio electronics simulation platform. Built with React + Vite, it renders a drag-and-drop circuit editor, streams live simulation state from the emulator, and drives Wokwi web components in real time.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Pages](#pages)
- [Key Features](#key-features)
- [Offline & Storage Features](#offline--storage-features)
- [Setup & Running Locally](#setup--running-locally)
- [Environment & Dependencies](#environment--dependencies)
- [How It Works](#how-it-works)

---

## Overview

OpenHW Studio Frontend is the **visual client** of the simulator platform. It allows users to:

- Design circuits by placing and wiring components on a canvas
- Write and edit Arduino C++ code in a built-in syntax-highlighted editor
- Compile and run simulations powered by the backend compiler and the in-browser Web Worker emulator
- Watch simulation output in real time (LEDs blinking, NeoPixels lighting up, servo movement, etc.)
- Save and load projects locally — **guests included** — using IndexedDB

It connects to one backend service:
- **Compiler Backend** (`http://localhost:5000`) — compiles C++ code to `.hex`

The simulation itself runs entirely **in the browser** via a Web Worker powered by `avr8js`.

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
| JSZip | Client-side ZIP extraction for custom components |
| @babel/standalone | In-browser transpilation of custom component TypeScript/JSX |
| IndexedDB (native) | Project persistence, hex cache, offline upload queue |
| Service Worker (native) | App shell caching for offline support |

---

## Project Structure

```
OpenHW-studio-frontend-danish/
├── index.html                  # App entry HTML
├── vite.config.js              # Vite configuration
├── package.json
└── src/
    ├── main.jsx                # React app bootstrap + Service Worker registration
    ├── App.jsx                 # Route definitions
    ├── index.css               # Global styles
    ├── pages/
    │   ├── LandingPage.jsx     # Public home/landing page
    │   ├── LoginPage.jsx       # Google OAuth login
    │   ├── RoleSelectPage.jsx  # Student / Teacher role selection
    │   ├── SimulatorPage.jsx   # Main circuit editor + simulation runner
    │   ├── admin/              # Admin Portal (Login, Landing, & Dashboard)
    │   ├── StudentDashboard.jsx
    │   └── TeacherDashboard.jsx
    ├── context/
    │   └── AuthContext.jsx     # Global authentication state
    ├── services/
    │   ├── authService.js      # Login, logout, token management (localStorage)
    │   ├── simulatorService.js # POST /api/compile and component API calls
    │   ├── offlineCache.js     # IndexedDB: compiled hex cache + ZIP upload queue
    │   └── projectStore.js     # IndexedDB: full project CRUD (save/load/list/delete)
    ├── worker/
    │   ├── simulation.worker.ts   # Web Worker entry point
    │   └── execute.ts             # AVR CPU execution loop inside worker
    └── components/             # Shared UI components
```

**Static files:**
```
public/
├── sw.js                       # Service Worker (app shell caching, offline routing)
└── _redirects                  # Deployment redirect rules
```

---

## Pages

### `SimulatorPage.jsx`
The core of the application. Responsibilities include:
- **Circuit Canvas** — drag, drop, and wire Wokwi components
- **Code Editor** — write Arduino sketches with syntax highlighting
- **Run/Stop** — triggers compilation → `.hex` delivery → Web Worker `START` message
- **Live State Rendering** — receives `{ type: "state", pins: {...} }` at 60 FPS and updates component visual attributes (LEDs, NeoPixels, etc.)
- **Component Registry** — maps component type names to their imported index definitions from `@openhw/emulator`
- **Project Save/Load** — auto-saves to IndexedDB every 2.5 s; "My Projects" modal for named saves; auto-loads last project on mount
- **Offline resilience** — hex cache survives page refresh; ZIP uploads queue while offline

### `LoginPage.jsx`
Google OAuth 2.0 login page. Decodes JWT and stores user info in `AuthContext`.

### `AdminPage.jsx`
A powerful administrative hub for platform maintenance:
- **3-Column Management**: Independent scrollable panels for Libraries, Pending Submissions, and Installed Components.
- **Review Workflow**: Admins can check submissions with live Transpile feedback, download source ZIPs, or open them in a live Simulator "Test" tab.
- **Real-time Actions**: Approval instantly moves components to the backend; rejection removes specific submissions (unique per upload).
- **Library Manager**: Search and uninstall system-level C++ libraries for the Arduino compiler.

### `LandingPage.jsx`
Public-facing landing page describing the platform.

### `StudentDashboard.jsx` / `TeacherDashboard.jsx`
Role-specific dashboards shown after login.

---

## Key Features

### Real-time Simulation Rendering (60 FPS)
The Web Worker runs the AVR CPU and posts state messages back to the main thread every frame. The frontend maps pin voltages to DOM attribute changes on Wokwi custom HTML elements.

```json
{ "type": "state", "pins": { "D13": true, "D6": false }, "neopixels": [...] }
```

### NeoPixel Matrix Support
- Wires NeoPixel components with `GND`, `VCC`, `DIN`, `DOUT` pins
- Sends matrix topology (component ID, Arduino pin, size) in the Web Worker `START` message
- Calls `element.setPixel(row, col, {r, g, b})` directly on the Wokwi DOM element

### Analog Plotter / Logic Graph
A native high-performance `<canvas>` rendering engine tab traces simulated logic and analog signals. Users can dynamically specify which pins to track.

### Serial Monitor Integration
A built-in terminal streams `AVRUSART` traffic bidirectionally into the `.hex` loop.

### Physical Workspace Controls
The **Arduino Uno Reset Button** is fully interactive inside the workspace SVG visualizer, triggering a targeted `runner.cpu.reset()` reboot in the Web Worker.

### Web Worker Simulation
AVR simulation runs entirely in-browser via `src/worker/execute.ts` inside a Web Worker, keeping the UI thread completely unblocked.

### Zero-Touch Component Sync
The simulator polls the backend every 12 seconds for newly approved community components:
- **Dynamic Injection**: New components are transpiled and injected into the registry and palette without a page refresh.
- **Live Deletion**: If a component is uninstalled from the admin panel, it is purged from all active simulator sessions automatically.
- **Admin "Test" Mode**: An isolated preview mechanism uses `sessionStorage` to test pending components before approval.

### Auth Flow
- Google OAuth → JWT stored in context
- Role selection (Student / Teacher / Admin) → role-specific entry points
- Protected routes via `AuthContext` and `ProtectedRoute` components

---

## Offline & Storage Features

All storage features use the browser-native **IndexedDB API** and **Service Worker API**. No extra npm packages are required, and no backend changes are needed.

### Project Persistence (IndexedDB — `openhw-projects`)

Every circuit is automatically saved to a local IndexedDB database every **2.5 seconds** after any change. This works for both authenticated users and **guest users** with no login required.

| User type | Owner key | What happens |
|---|---|---|
| Guest (no login) | `'guest'` | Projects saved locally, visible under "My Projects" on every visit |
| Authenticated user | `user.email` | Projects saved locally, scoped to that email |

**Buttons added to the header:**
- **Save** — opens a name dialog; pressing Enter or clicking Save commits the name
- **My Projects** — opens a modal listing all saved projects (name, board, components count, last-saved time) with Load and Delete actions
- **New** — starts a blank canvas (current project is preserved in IDB)
- **Project name chip** — shows the current project name in the header; click to rename

**On page load**, the most-recently saved project for the current user (or guest) is automatically restored.

### Compiled Hex Cache (IndexedDB — `openhw-offline`)

Compiled `.hex` results are saved to IndexedDB after every successful compile. On subsequent runs:

1. Check in-memory `lastCompiledRef` (fastest — same session)
2. Check IndexedDB cache (survives page refresh and offline)
3. Compile via `POST /api/compile` (requires network)

This means: **run your simulation offline after compiling at least once while online**.

### Offline ZIP Component Upload Queue (IndexedDB — `openhw-offline`)

If you upload a custom component ZIP while offline:
- The component is injected into the local registry immediately (usable right away)
- The backend submission is queued in IndexedDB
- When the internet is restored, the queue is automatically drained

### Service Worker (`public/sw.js`)

Cached on first load. Strategies:

| Request | Strategy |
|---|---|
| Navigation (`/`, any route) | Network-first → fallback to cached `index.html` |
| JS / CSS / images | Stale-while-revalidate (instant load + background update) |
| CDN scripts (wokwi-elements) | Stale-while-revalidate |
| `/api/*` | Network-only (never cached — hex caching is at the app layer) |

See **[OFFLINE_AND_STORAGE.md](../OFFLINE_AND_STORAGE.md)** for full technical details.

---

## Setup & Running Locally

### Prerequisites
- Node.js 18+
- npm 9+
- The **Compiler Backend** running at `http://localhost:5000`

### Installation

```bash
cd OpenHW-studio-frontend-danish
npm install
```

### Local Development & NPM Linking
During local development, you will want the frontend to immediately see changes you make to the emulator source code, without having to push those changes to GitHub first.

We achieve this using **NPM Symlinks**, which tell the frontend to use the local `openhw-studio-emulator-danish` folder instead of downloading the cached version from GitHub.

To set up your local development links:
```bash
# 1. Register the emulator as a linkable global package
cd openhw-studio-emulator-danish
npm link
cd ..

# 2. Tell the frontend to use the linked local emulator
cd OpenHW-studio-frontend-danish
npm link @openhw/emulator
cd ..
```
*Note: Once deployed to Vercel/Netlify, these local symlinks will be ignored and the remote server will correctly fetch the package directly from GitHub.*

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

The `vite.config.js` aliases `@openhw/emulator` to the local `openhw-studio-emulator-danish/` directory during development, so changes to component source are immediately reflected without reinstalling.

---

## How It Works

```
User writes C++ code
        │
        ▼
POST /api/compile  ──►  Compiler Backend (port 5000)
                                │
                         Returns .hex file
                                │ also cached to IndexedDB
                                ▼
        Frontend sends START + .hex + wiring topology
                                │
                         Web Worker (browser)
                                │
                    Runs AVR CPU at 16 MHz in-browser
                    Streams pin states at 60 FPS
                                │
                                ▼
        Frontend updates Wokwi component DOM attributes
                    (LEDs, NeoPixels, Servo, etc.)
```

---

*Part of the OpenHW Studio platform. See also: [openhw-studio-backend-danish](../openhw-studio-backend-danish) and [openhw-studio-emulator-danish](../openhw-studio-emulator-danish).*