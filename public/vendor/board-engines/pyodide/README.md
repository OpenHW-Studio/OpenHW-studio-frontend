# Pyodide board-engine deploy mirror

Runtime mirror of the Python shims (`py/**`) for the Raspberry Pi 3 B+ /
4 B / 5 board runner. The runner fetches these files from
`/vendor/board-engines/pyodide/py/...` and writes them into the Pyodide
filesystem at `/home/pyodide/...` on boot (the standalone engine does the
same with `src/runtime.js`, adapted here for a module Web Worker).

Provenance: byte-identical copy of
`/home/danish1075/Documents/simulator/sperte/rpi-pyodide/py/` taken
2026-11-28. Authoritative committed source and refresh recipe:
`src/engines/pyodide/README.md`. The Pyodide distribution itself is loaded
from the version-pinned jsDelivr URL through
`src/worker/runners/arm-runner-base.ts#importEngine`; it is not vendored.
