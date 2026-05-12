# Grading & Behavioral Audit — Frontend Reference

This document explains the frontend-visible grading data, the meaning of Temporal (behavioral) fidelity, Verified Code Score, and the planned alignment between the UI table and the Rust engine matcher.

**Files touched**
- Shared PNG extractor: `src/utils/projectCompilerUtils.js` (added `extractProjectMetaFromPng`)
- Grading worker: `src/worker/grading-engine.worker.ts` (now uses shared extractor)
- UI telemetry guards: `src/pages/GradingPage.jsx`

---

## 1) Where grading & temporal data live (what the UI reads)
- `GRADING_COMPLETE` message from worker contains `result` — this is the `GradingReport` object returned by the Rust engine.
- Key fields in the report used by the frontend:
  - `score` — total normalized score
  - `spatial_score`, `logic_score`, `behavioral_score` — per-aspect integer % scores
  - `verified_code_score` — engine-provided verified-code % (see section below)
  - `teacher_telemetry` and `student_telemetry` — strings containing JSON arrays (normalized telemetry). The UI parses these with `JSON.parse` and expects objects like `{ events: [...], duration_ms: N }`.
  - `feedback` — array of human-readable diagnostic strings (shown in the Feedback list)
  - `logs` — array of log strings captured during grading
  - `id_mapping` — optional mapping student->teacher component IDs

Location in repo:
- Worker reads PNG metadata using `extractProjectMetaFromPng()` and posts `GRADING_COMPLETE` with `result`.
- UI reads `report.teacher_telemetry` and `report.student_telemetry` to render the Behavioral Diff view.

Notes: the frontend now normalizes missing telemetry (falls back to `{events:[], duration_ms:0}`) so missing/partial traces no longer crash `.map()`.

### Event types used by grading

The grading engine currently reduces all observable runtime behavior into three event families:

- `PinChange` - an electrical edge on a specific pin. This is how the engine sees wiring behavior, output toggles, and low-level board activity.
- `ComponentState` - a component state snapshot. This is how LCD text, LED flags, sensor state, and other high-level component behavior are captured.
- `SerialOutput` - text emitted on the serial port. This acts as a functional trace when a sketch prints status or debug output.

These are enough for the current grading flow because the worker now emits component `state` when `custom` telemetry is empty. In the temporal breakdown, some static pin groups are shown as `pinstate:<component>:pins`; those are synthetic grouping labels, not separate event types.

### Why AI functional/electrical traces can show `silent`

The AI audit is a separate semantic layer from the grading telemetry. It builds:

- a raw trace from the captured events,
- a functional trace from changed component/serial meanings,
- an electrical trace from pin-level transitions,
- and a normalized blend of the functional and electrical traces.

If the normalization step does not produce a usable semantic string, the worker falls back to `silent`. That does **not** mean grading failed. It means the semantic-audit string was empty, while the raw telemetry may still have valid events and the score can still be 100.

### Telemetry coverage check

The worker now records a coverage warning when a component exposes neither custom telemetry nor component state. In a healthy run, `coverage_issues` stays empty. If a new component is added without telemetry coverage, the warning will name the component ID and type so it can be fixed quickly.

### Current grading issue observed in RP2040 + LCD2004 runs

The latest grading logs show that the worker starts correctly and the simulation loop runs, but the behavioral capture still ends with:

- `Components: 2`
- `customMetricKeys: []`
- `Captured 0 events`

That means the grading problem is not the worker startup path; it is the telemetry shape being empty or mismatched at capture time. The worker now tries to normalize telemetry from multiple snapshot shapes (`metrics.custom`, `customTelemetry`, and `_metrics.customTelemetry`), but this issue can still appear if the browser is holding an older worker bundle or if the component snapshot path is not emitting custom fields for the current runtime.

The `ws://localhost:3333/` WebSocket warning is a separate RP2040 GDB bridge connection failure. It is noisy, but it is not what prevents telemetry capture. The real behavioral data path is the component snapshot payload, and the current fix now also falls back to component `state` when `custom` telemetry is empty.

Retest checklist:

1. Start the stack with `start_all.bat`.
2. Open DevTools in the browser.
3. In Network, enable `Disable cache`.
4. Hard-reload the page with `Ctrl+Shift+R`.
5. Re-run grading and confirm the console shows `[WORKER VERSION] grading-engine.worker.ts v3.9-debug`.
6. Confirm the snapshot log now shows non-empty custom telemetry keys for Pico or LCD2004.

If the worker version is correct but `customMetricKeys` is still empty, check the new `stateKeys` field in the log. If `stateKeys` is populated but custom telemetry is still empty, the fallback should still produce events. If both are empty, inspect the component logic classes and `BaseComponent.ts` for missing state updates.

For all supported components, the grading engine is now expected to work with either custom telemetry or component state. The new runtime coverage warning is the guardrail that tells you when a component has neither.

---

## 2) Why `verified_code_score` can be 0
`verified_code_score` is computed in the Rust engine as a weighted combination of code similarity and pin-fidelity:

- Formula (engine):
  - `verified_code_score = round(code_score * 0.70 + pin_fidelity * 0.30)`

- If `code_score` is 0 (no recognizable / comparable code found) and `pin_fidelity` is 0 (no pin-match fidelity), the resulting `verified_code_score` will be 0.

Defensive note: the frontend worker now also recomputes `verified_code_score` from the Rust fields when the result looks stale or zero even though both `code_score` and `pin_fidelity` are positive. That prevents older cached WASM builds from showing `0` for a valid circuit.

Where to inspect in a bundle: open the `grading_report` of the full diagnostic bundle and check:
- `grading_report.code_score`
- `grading_report.pin_fidelity`
- `grading_report.verified_code_score`

If `verified_code_score` is unexpectedly 0, check these common causes:
- Teacher project had no exported code/files in PNG metadata or `projectFiles` field is empty.
- Student submission had no recognizable source files (no `.ino`/`.cpp` etc.) or compilation failed before code analysis step.
- `compare_code_and_blocks()` returned 0 due to differences (engine currently requires some structural similarity).

Quick checks you can run locally:
```powershell
cd OpenHW-studio-frontend
# show git status (are your recent edits committed?)
git status --porcelain
# show last commits
git --no-pager log --oneline -n 5
```

---

## 3) What is "Temporal Fidelity" (engine + UI)
Short definition: Temporal Fidelity measures how closely the *sequence* and *timing* of observable events in the student's simulation matches the teacher's simulation.

- "Temporal" = time-aware. It inspects the sequence (order) and timestamps for events like `PinChange` and `ComponentState`.
- Precision: it is strict about timing and event sequence (so small drifts can lower the score).
- Limitation: too literal matching penalizes acceptable timing drifts.

The UI currently renders a side-by-side Behavioral Diff table. The engine previously used a windowed fuzzy matching algorithm; the proposed plan below aligns the engine exactly with the UI table logic so results are transparent and reproducible.

---

## 4) Proposed Table-Aligned Temporal Strategy (what I'll implement in Rust)
Goal: make engine scoring match the table shown in the UI so a human can understand why the engine produced the score.

A. Group-first approach (match UI):
- Group events by ID (Pin X, or component ID). Each group is compared independently.
- Within each group, perform index-based pairing: teacher event #1 ↔ student event #1, teacher #2 ↔ student #2, etc.
- Silence = Match: if the teacher has no events for a given pin (static pin), mark that pin as 100% matched rather than penalizing.

B. Smart windowing for startup noise:
- Allow a small sliding index window (e.g., ±10 events) when a direct index match doesn't line up (handles extra boot events).
- Also apply a time tolerance (e.g., ±250ms) to allow minor timing drift.

C. Normalization & scaling
- Normalize student times to teacher timeline using `scale = teacher_duration / student_duration` in the engine before comparing (this reduces global clock drift effects).

D. Output structures to return unchanged but include a new `temporal_breakdown` object with per-ID match statistics + the grouped event alignment used to compute behavioral_score.

Expected result:
- Temporal score becomes aligned with the table's visual judgment.
- Pins that are static in teacher will not dilute the score.

---

## 5) UI: Temporal Behavior Section & Table
Current state:
- `GradingPage.jsx` already renders a Behavioral Diff table and a Download Normalized Audit Trace button.

Doced change / recommended improvements:
- Add an explicit **Temporal Behavior** section in the report page (heading + short description).
- Ensure the table uses the same 250ms tolerance and grouping the engine uses (if you accept the engine change above).
- Add a dedicated "Download Normalized Audit Trace" button in that section (already present in the report) which exports the grouped, time-scaled JSON the engine uses.

Download JSON contents (recommended shape):
```json
{
  "explanation": "Normalized student timing scaled to teacher clock.",
  "time_scale_factor": 1.012,
  "teacher_telemetry": { "events": [...], "duration_ms": 10000 },
  "student_telemetry_normalized": { "Pin 13": [{"time_ms": 100, "state": true}, ...], ... }
}
```

This file can be used to reproduce the side-by-side table and to debug mismatches.

---

## 6) AI Semantic Audit tab (Frontend)
The AI Semantic Audit tab will include:
- Side-by-side human-readable AI "story" strings for teacher vs student (already produced as `teacher_ai_str` / `student_ai_str` in some bundles).
- Visual highlighting of semantic mismatches (red for disagreement, green for match), and a breakdown of weights (Functional 85% / Electrical 15%).
- A download button for the AI audit JSON.

Current implementation details:
- The AI worker now emits both raw telemetry traces and the 85/15 normalized traces.
- The normalization is transition-based: it keeps only values that actually change per component key or pin, then builds a raw trace, a functional trace, an electrical trace, and a combined normalized trace.
- The UI renders an audit table with rows for `Raw Trace`, `Functional Trace`, `Electrical Trace`, and `Normalized Trace`.
- The download bundle includes raw traces, functional/electrical traces, normalized traces, and the weighted similarity scores.
- Static values that never change are filtered before embedding generation, so the AI focuses on actual circuit behavior instead of repeated noise.

---

## 7) Next steps & commands I recommend you run locally
- Confirm your working tree is committed before further refactors:
```powershell
cd OpenHW-studio-frontend
git status
# Commit changes if needed
git add .
git commit -m "chore: add grading doc and shared png extractor; harden UI telemetry parsing"
```
- If you'd like, I can implement the Rust engine changes (Table-Alignment + sliding window) next. That requires editing `openhw-studio-grading-engine/src/lib.rs` and adding the `temporal_breakdown` return struct.

---

If you want, I will now:
- implement the Rust `Table-Aligned` matcher (modifying `compare_behavior` in `lib.rs`) and return `temporal_breakdown`, or
- just update the UI to render the `temporal_breakdown` once the engine supplies it.

Tell me which you'd prefer next and I’ll add those steps to the TODO list and start work.
