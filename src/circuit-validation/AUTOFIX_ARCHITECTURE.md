# Intelligent WASM Auto-Fix Engine Architecture (v2)

## System Flow Diagram (WASM + Worker)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER CLICKS "PREVIEW FIXES"                      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 1. DATA MARSHALING (JS)                            │
                    │    - Extract diagram.json                          │
                    │    - Collect active validation errors              │
                    │    - Send to Web Worker                            │
                    └────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 2. INTELLIGENT PLANNING (WASM Worker)              │
                    │    - Build Circuit Graph (Topological)             │
                    │    - Priority Sorting (Power > Logic > Signal)     │
                    │    - Semantic Pattern Matching                     │
                    │    - Resolve Conflicts (Dependency-Aware)          │
                    └────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 3. GHOST PREVIEW (JS Canvas)                       │
                    │    - Render added components (40% opacity)         │
                    │    - Render ghost wires (glow effects)             │
                    │    - Interactive conflict selection                │
                    └────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 4. USER CONFIRMATION                               │
                    │    - User reviews ghost circuit                    │
                    │    - Clicks "Apply Selected Fixes"                 │
                    └────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────────────────┐
                    │ 5. ATOMIC COMMIT (JS)                              │
                    │    - Merge ghost elements into diagram.json        │
                    │    - Clear validation cache                        │
                    │    - Save history snapshot                         │
                    └────────────────────────────────────────────────────┘
```

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    CIRCUIT FIX ENGINE (WASM)                     │
└──────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌───────────┐       ┌─────────────┐      ┌──────────────┐
    │ GRAPH     │       │ STRATEGIST  │      │ LIFT/LOWER   │
    │ ANALYZER  │       │ (TOPOLOGY)  │      │ BRIDGE (JS)  │
    └───────────┘       └─────────────┘      └──────────────┘
         │                    │                    │
    Topological Sort    Dependency Map       Memory Bridge
    Conflict Detection  Repair Strategy      JSON Serialization
```

## Strategy: Dependency-Aware Fixing

Unlike the legacy heuristic engine, the WASM engine understands **order of operations**:
1.  **Level 1: Infrastructure (Power/Ground)**
    - Missing GND, VCC rails.
    - Reverse polarity correction.
2.  **Level 2: Signal Integrity (Conditioning)**
    - Missing pull-ups/pull-downs.
    - Decoupling capacitors.
3.  **Level 3: Peripheral Logic**
    - SPI/I2C connections.
    - External component wiring.

## Performance Advantage
By offloading the graph traversal and pattern matching to WASM:
- **Zero UI Stutter**: Complex circuit analysis (100+ components) runs in <5ms without blocking the 60fps canvas.
- **Deeper Search**: The engine can simulate "what-if" scenarios for multiple fix combinations before presenting the best one.

## Implementation Details
- **WASM Source**: `openhw-studio-autofix-engine/assembly/index.ts`
- **Frontend Bridge**: `OpenHW-studio-frontend/src/worker/autofix.worker.ts`
- **Ghost Rendering**: Custom `isGhost` prop in `SimulatorPage.jsx` components.

## Multi-Environment Support (CLI/MCP)
The engine is designed to be environment-agnostic. While currently integrated via a Web Worker in the browser, it can be deployed to:
- **CLI**: A Node.js wrapper can instantiate the 'release.wasm' directly to provide command-line circuit repair.
- **MCP**: An AI Model Context Protocol server can use the engine to suggest fixes directly to an AI agent during a coding/design session.
- **CI/CD**: Automated pull-request checks can use the WASM core to flag unfixable violations or suggest repairs before merging.
