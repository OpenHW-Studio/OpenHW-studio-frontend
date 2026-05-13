# Web Worker HMR Crash Fix - Documentation

## The Problem: Vite HMR "Poisoning"
During development with Vite and React, the `@vitejs/plugin-react` automatically injects **React Fast Refresh** code into files it processes. This injected code assumes it is running in a standard browser environment and attempts to access global variables like `window`, `document`, and `location`.

Because **Web Workers** run in an isolated thread without these browser globals, they would crash immediately with `Uncaught ReferenceError: window is not defined` as soon as they were loaded. This happened because Vite was incorrectly applying React transformations to worker scripts.

---

## The Solution: Isolation & Polyfilling
We implemented a multi-layered defense to ensure workers remain stable:

### 1. Vite Configuration Update
**File:** `vite.config.js`
- **Change:** Added an `exclude` rule to the `react()` plugin.
- **Why:** This tells Vite to skip React-specific transformations for any files in the `src/worker/` directory or the emulator library.
- **Resilience:** Uses a regex `[\\\/]` to handle both Unix and Windows path separators.

### 2. Inlined Environment Polyfills
**Files:** `simulation.worker.ts`, `grading-engine.worker.ts`, `autofix.worker.ts`, `ai-audit-final.worker.ts`
- **Change:** Added a block of "shim" code at the very top of each worker entry point.
- **Why:** Even with the Vite exclusion, some dependencies or internal Vite logic might still expect these globals. By inlining the polyfills (stubbing `window`, `document`, and React Refresh hooks), we ensure the environment is "safe" before any other logic runs.

### 3. Resilient Error Diagnostics
**File:** `SimulationConsole.jsx`
- **Change:** Refactored `stringifyArg` to handle `ErrorEvent` and generic `Event` objects.
- **Why:** Previously, if a worker crashed, the console would show a useless `{"isTrusted":true}` object. Now, it deep-inspects the event to extract the actual error message, filename, and line number.

**File:** `SimulatorPage.jsx`
- **Change:** Enhanced `worker.onerror` to provide descriptive crash logs.
- **Why:** To ensure the user gets immediate visual feedback in the simulation console if a worker fails to start.

---

## File Summary Table

| File | Change Description | Purpose |
| :--- | :--- | :--- |
| `vite.config.js` | Added `exclude` regex for workers | Prevents React Fast Refresh injection. |
| `src/worker/*.worker.ts` | Inlined `window`/`document` polyfills | Provides safety stubs for missing globals. |
| `SimulationConsole.jsx` | Updated `stringifyArg` logic | Enables detailed logging of `ErrorEvent` objects. |
| `SimulatorPage.jsx` | Improved `worker.onerror` handler | Better UI reporting for worker failures. |

---

## Maintenance Note
If you create a **new** Web Worker in the future, ensure you copy the polyfill block from the top of `simulation.worker.ts` to the top of your new worker file to prevent similar HMR-related crashes.
