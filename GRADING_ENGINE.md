# Automated Circuit Grading Engine

This document describes the architecture and workflow of the Automated Grading Engine used in OpenHW Studio. The engine is designed to provide high-fidelity, deterministic feedback on student circuit submissions by comparing them against a teacher's reference.

## Architecture Overview

The grading system consists of three main layers:

1.  **Grading Worker (`grading-worker.ts`)**: A Web Worker that manages the lifecycle of the grading process. It handles background simulation, telemetry collection, and communication with the WASM core.
2.  **Simulation Runner (`execute.ts`)**: The high-performance simulation engine (AVR/RP2040) used to execute the circuit logic.
3.  **Grading Core (Rust/WASM)**: A platform-agnostic engine that performs spatial analysis, graph isomorphism (connectivity check), and behavioral diffing.

---

## The Grading Workflow

### 1. Project Metadata Extraction
The process begins by extracting project metadata (components, connections, and firmware) from the provided inputs.
- If the input is a **PNG**, the engine parses the embedded metadata chunk to recover the original `diagram.json` and compiled HEX.
- The `extract_project_meta` WASM function is used to ensure all attributes (including `attrs` for firmware) are preserved.

### 2. Behavioral Capture
The engine runs two parallel (or sequential) simulations: one for the Teacher's reference and one for the Student's submission.
- **Simulation Duration**: 8 seconds of simulated time.
- **Polling**: The worker polls the simulation runner every 50ms.
- **Telemetry API**: It uses `runner.getRichTelemetrySnapshot({ mode: 'delta' })` to capture only state changes (Pin toggles, LED glow, Serial output).
- **Speed**: The simulation is typically run at `10.0x` speed to provide near-instant results.

### 3. Verification & Scoring
The captured data is passed to the Rust-based grading core, which calculates scores in four categories:

| Category | Description |
| :--- | :--- |
| **Spatial Eye** | Validates component inventory, collisions, and breadboard snapping alignment. |
| **Circuit Logic** | Performs graph isomorphism between the student and teacher netlists. |
| **Verified Behavior** | Diffs the telemetry timelines, looking for functional parity (e.g., "did the LED blink at the right frequency?"). |
| **AI Semantic Match** | Uses AST-based analysis (for code) and categorical weighting to detect intent even if the implementation differs. |

---

## Telemetry API Integration

The worker interacts with the simulation runner via the **Telemetry API**. This is the official way to gather diagnostic data without interfering with the simulation core.

### Delta Mode
```typescript
const snapshot = runner.getRichTelemetrySnapshot({ mode: 'delta' });
```
In `delta` mode, each component returns its metrics only if they have changed since the last call. This keeps the behavioral trace compact and efficient.

### Deep Mode
```typescript
const fullReport = runner.getRichTelemetrySnapshot({ mode: 'deep' });
```
Used at the end of the simulation to get the final "health" state of every component, including power profiles and cumulative metrics.

---

## Troubleshooting & Common Issues

### "Silent" Behavioral Reports
If the behavioral report shows 0ms or no events, verify the following:
- **Firmware HEX**: Check the worker logs for `Hex Length`. If it is 0, the code was not correctly extracted or embedded in the project.
- **Component Update**: Ensure the simulation runner is calling `update()` on all components during its execution loop.

### Low Spatial Scores
Spatial errors are often caused by "floating" components. Components must be snapped to breadboard holes or aligned exactly with the grid to pass the **Spatial Eye** validation.

---

## Development
The Rust core is located in `/openhw-studio-grading-engine`. To update the WASM binary used by the worker:
1.  Run `wasm-pack build` in the rust folder.
2.  Copy the contents of `pkg/` to `OpenHW-studio-frontend/src/wasm/grading/`.
