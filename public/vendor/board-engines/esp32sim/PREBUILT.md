# Prebuilt browser WASM (added 2026-11-28)

The upstream browser build is **one unified WASM module**, not one file per chip.
`esp32sim.wasm` contains the S3, C3, C6, classic ESP32, P4 and S31 SoCs; the
chip is selected at `create` time by the `board` field (see `emu.js` and
`wasm/worker.js`). So "the WASM for S3, C3 and C6" is this single artifact.

| file | source | bytes | md5 |
|---|---|---|---|
| `esp32sim.wasm` | `https://mikroverk.github.io/esp32sim/wasm/esp32sim.wasm` | 4,871,168 | `0b72c36ac59be5c3d42ea413905e124c` |
| `worker.js` | `https://mikroverk.github.io/esp32sim/wasm/worker.js` | 13,075 | — |
| `experiments.mjs` | `https://mikroverk.github.io/esp32sim/wasm/experiments.mjs` | 4,093 | — |

Fetched from the Pages site built from this clone's HEAD (`62d99b74`); the
page assets use cache key `v=62d99b74`, the same commit. These files are
generated artifacts, so they are kept next to the Rust `wasm/` crate source
but are not source code. Rebuild with `tools/wasm-build.sh` when the Rust
source changes; do not mix a new wasm with an old `worker.js`.

Boards relevant to a S3/C3/C6 spike (from `emu.js`): `waveshare-lcd4b`,
`waveshare-amoled18-v2`, `atech14`, `esp32s3` defaults for S3; `esp32c3`
(console only) for C3; `esp32c6`, `waveshare-c6-lcd147`, `xiao-esp32c6` for C6.
