# Simulation Telemetry API Documentation

This document describes the high-performance telemetry infrastructure integrated into the simulation engine. It is designed for behavioral verification, autograding, and deep diagnostics.

## Core Concepts

### 1. Silent-by-Default Design
Telemetry collection is gated by a `telemetryEnabled` flag. When disabled (default), the simulation runs at maximum speed with zero instrumentation overhead.

### 2. Rich Metrics Extraction
The API provides deep access to component internal states, power profiles, and communication buffers.

## API Methods (Javascript)

### `controller.setTelemetryEnabled(enabled: boolean)`
Enables or disables deep telemetry collection for all components in the simulation.

### Automated Reporting Schedule
You can configure automated reports via `SimulationRunOptions.telemetrySchedule`. By default, these use **`deep`** mode to ensure the grading engine receives the full simulation state.

- `intervalMs`: Generates a report every N milliseconds (min 250ms).
- `atMs`: Generates reports at specific simulation timestamps (in milliseconds).

When a scheduled report is triggered, a `telemetry_snapshot` event is emitted.

### `controller.getRichTelemetrySnapshot(options)`
Returns a comprehensive report of all components.
- **options.mode**:
    - `'standard'`: Returns visual state (pins, attributes, labels). Optimized for UI reflection.
    - `'deep'`: **(Default)** Returns the **FULL** diagnostic report (Complete metrics, heuristics, and I/O signatures). Use this for grading.
    - `'delta'`: Returns an optimized diagnostic report containing only metrics that changed since the last poll.
- **Protocol Signatures**: In `'deep'` mode, includes the last 16 bytes of I2C/SPI transactions for protocol-level verification.

## Event-Based Diagnostics

The telemetry engine can fire real-time **Findings** when heuristics detect anomalies.

### Message Format
```json
{
  "type": "telemetry_finding",
  "boardId": "uno1",
  "componentId": "led1",
  "summary": "OK: No anomalies detected.",
  "severity": "warn"
}
```

## Telemetry Report Structure

```json
{
  "boardId": "uno1",
  "isDelta": true,
  "components": [
    {
      "id": "servo1",
      "type": "wokwi-servo",
      "metrics": {
        "updateFreq": 50.0,
        "timing": { "avgMs": 0.002, "maxMs": 0.01 },
        "ioThroughput": {
          "i2cTransactions": 5,
          "recentI2c": [128, 0, 90]
        }
      },
      "heuristics": {
        "status": "ok",
        "findings": []
      }
    }
  ]
}
```

## Implementation Workflow for Autograding

1. Start simulation with `durationMs`.
2. Enable telemetry: `controller.setTelemetryEnabled(true)`.
3. Periodically poll `getRichTelemetrySnapshot()`.
4. Check `heuristics.status` and `ioThroughput.recentI2c` signatures to verify behavior.
5. Capture final report after simulation stops.
