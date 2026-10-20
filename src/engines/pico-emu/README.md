# Pico engine bytes (owner build, committed here)

This folder is the **single resolution point** for the Pico / Pico 2 (RP2040 /
RP2350) board engine. `vite.config.js` aliases the npm-shaped specifiers
(`pico-emu/picoemu.wasm.js`, `pico-emu/picoemu.wasm.wasm`) onto this folder, so:

| consumer | resolves to | bytes |
|---|---|---|
| `vite dev` (http://localhost:5173 / lane ports) | `src/engines/pico-emu/*` | this folder |
| `npm run build` → `dist/assets/picoemu.wasm-*.wasm` (bundled primary) | `src/engines/pico-emu/*` | this folder |
| runtime fallback `/vendor/board-engines/pico-emu/picoemu.wasm.js` | `public/vendor/board-engines/pico-emu/picoemu.wasm.js` | mirror of this folder |

The runtime fallback is the **same byte set** — keep both copies in sync
(see refresh recipe below). It exists so a bundler-resolution failure still
boots an engine instead of an idle board.

## Why these bytes are committed (2026-10-20)

The container build (Dockerfile → `.github/workflows/deploy.yml`) checks out
**only this repo + openhw-studio-emulator**. The owner's checkout
(`/home/danish1075/Documents/rp2350/Pico-emu/web`) does not exist there, and a
vite alias to a missing path is a **hard build failure** ("Could not load …").
The same alias also embedded an absolute owner path in the built wasm asset,
so the deployed Pico would have 404'd on its engine.

For the engine owner's live build during engine work, opt out explicitly:

```sh
OPENHW_ENGINE_FROM=owner npm run dev   # aliases back to the owner's folder
```

Never in CI — CI must build from the committed snapshot.

## Provenance (measured 2026-10-20)

Copied **verbatim** from the engine owner's checkout
`/home/danish1075/Documents/rp2350/Pico-emu/web/` (same files, same md5):

| file | md5 | role |
|---|---|---|
| `picoemu.wasm.js` | `c3b784f0a59b151bc698329300a0611e` | emscripten glue (imports the wasm) |
| `picoemu.wasm.wasm` | `0c74dffe5f5458a9062e4f7a13197781` | engine wasm (CPU + peripherals) |

The same two files were already committed in this repo under
`public/vendor/board-engines/pico-emu/picoemu.wasm.js` (glue, md5 equal) and
`public/wasm/picoemu.wasm.wasm` (wasm, md5 equal) — the copies here move them
next to each other so the pair is importable from source.

**Glue + wasm must come from ONE build.** The glue resolves its wasm relative
to itself (`new URL('picoemu.wasm.wasm', import.meta.url)`); the runner
overrides that with `locateFile` + an explicit `wasmBinary` (the `?url` asset
above). A mismatched pair misbinds exports (e.g. `malloc → undefined`, then an
OOB trap) — proven 2026-10-14 by the glue×wasm pairing matrix. Never mix the
folder glue with an npm wasm or vice versa.

`picoemu.wasm.threads.js` / `picoemu.wasm.threads.wasm` (the pthreads build)
are not imported by the runner; they stay in `public/wasm/` + `public/vendor/`.

## Refresh recipe (when the owner lands a new engine build)

```sh
OWNER="/home/danish1075/Documents/rp2350/Pico-emu/web"
DEST="src/engines/pico-emu"
MIRROR="public/vendor/board-engines/pico-emu"
cp "$OWNER/picoemu.wasm.js"   "$DEST/picoemu.wasm.js"
cp "$OWNER/picoemu.wasm.wasm"  "$DEST/picoemu.wasm.wasm"
cp "$OWNER/picoemu.wasm.js"   "$MIRROR/picoemu.wasm.js"     # runtime fallback
cp "$OWNER/picoemu.wasm.wasm" "public/wasm/picoemu.wasm.wasm"
md5sum "$DEST"/* public/wasm/picoemu.wasm.wasm "$MIRROR/picoemu.wasm.js"
```

Keep the glue and the wasm from the SAME build (same mtime/build window).
After refreshing, re-run the Pico cells (`pico-usb`, `pico2-pio-dma`,
`pico-wifi-gateway`, `pico-eth-gateway`) before committing.
