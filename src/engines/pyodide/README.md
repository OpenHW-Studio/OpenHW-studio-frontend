# Pyodide board engine — Raspberry Pi 3 B+ / 4 B / 5 (peripheral model)

This is the **single committed mirror** of the peripheral engine adopted from
`/home/danish1075/Documents/simulator/sperte/rpi-pyodide` (owner-provided
standalone Raspberry-Pi-on-Pyodide simulator). The files are byte-identical
copies of that directory's `src/` and `py/` trees plus its documentation;
`UPSTREAM-README.md` / `FIDELITY.md` / `LIBRARIES.md` are the unmodified
upstream docs.

Provenance (recorded 2026-11-28):

| Path here | Upstream source | State |
| --- | --- | --- |
| `src/bridge.js` | `sperte/rpi-pyodide/src/bridge.js` | verbatim |
| `src/peripherals.js` | `sperte/rpi-pyodide/src/peripherals.js` | verbatim |
| `src/analog.js` | `sperte/rpi-pyodide/src/analog.js` | verbatim |
| `src/runtime.js` | `sperte/rpi-pyodide/src/runtime.js` | verbatim (document-only: the worker runner has its own worker-safe loader) |
| `py/**` | `sperte/rpi-pyodide/py/**` | verbatim (72 shim files) |

## Resolution / refresh recipe

Resolution is funnelled like every other board engine:

* `src/worker/runners/arm-runner-base.ts#importEngine` — the only place
  that resolves the Pyodide ESM runtime (`pyodide.mjs`, loaded from the
  version-pinned jsDelivr URL at runtime; vendored fallback path is
  `/vendor/board-engines/pyodide/`).
* `vite.config.js` — the `pyodide/*` aliases point at the committed mirror
  under `src/engines/pyodide/`, so dev, build and deploy all read the same
  bytes. `public/vendor/board-engines/pyodide/` carries the deploy mirror of
  the Python shims (`py/**`) fetched by the runner at boot.

To refresh: `cp -r <upstream>/src <upstream>/py ./` (and the doc files), then
copy `py/` into `public/vendor/board-engines/pyodide/`. Do not edit the
mirrored files in place — patch the upstream source and re-copy, so the
byte-for-byte provenance stays true.

## What this engine is

Real CPython (Pyodide) executing Python shims against deterministic JS
peripheral models: GPIO, I2C (EEPROM 0x50, SSD1306 0x3C, MCP9808 0x18),
SPI, PWM, ADC, UART, 1-Wire, virtual time, and per-board differences
(PWM-capable pins, clocks, temperatures, electrical thresholds).

**It is not an operating-system emulator.** There is no Linux kernel, no
ARM CPU emulation, no boot or device-driver execution. See `FIDELITY.md`
for the exact boundary; this is documented in the board family limits in
`src/worker/boards-registry.ts` and `docs/matrix.md`.
