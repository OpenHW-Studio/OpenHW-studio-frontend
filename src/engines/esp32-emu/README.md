# ESP32 engine SAB bytes (owner build + OpenHW patches, committed here)

This folder is the **single resolution point** for the ESP32 / ESP32-CAM SAB
engine entry points. `vite.config.js` aliases the npm-shaped specifier
`esp32-emu/dist/sab/worker-proxy.js` onto this folder, so:

| consumer | resolves to | bytes |
|---|---|---|
| `vite dev` (http://localhost:5173 / lane ports) | `src/engines/esp32-emu/dist/sab/*` | this folder |
| `npm run build` → `dist/assets/*` (bundled primary) | `src/engines/esp32-emu/dist/sab/*` | this folder |
| runtime fallback `/vendor/board-engines/esp32-emu/dist/sab/worker-proxy.js` | `public/vendor/board-engines/esp32-emu/dist/sab/*` | mirror of this folder |

Both copies are the **same byte set** — keep them in sync (refresh recipe
below). The fallback exists so a bundler-resolution failure still boots an
engine instead of an idle board.

Only these two JS files live here. The engine **wasm** (`esp_engine_wasm.wasm`)
and the **ROM** (`esp32-v3-rom.bin`) are fetched at runtime from
`public/wasm/` + `public/firmware/` — they were already repo-committed.

## Why these bytes are committed (2026-10-20)

The container build (Dockerfile → `.github/workflows/deploy.yml`) checks out
**only this repo + openhw-studio-emulator**. The owner's checkout
(`/home/danish1075/Documents/esp32 emu/dist/`) does not exist there, and a
vite alias to a missing path is a **hard build failure**. That is not
hypothetical: the owner deleted `dist/` mid-session while rebuilding the
engine, and `npm run build` failed with

```
[vite:worker-import-meta-url] Could not load /home/danish1075/Documents/esp32 emu/dist/sab/worker-proxy.js
  (imported by src/worker/runners/arm-runner-base.ts): ENOENT
```

The engine owner's folder is also a moving target (rebuilt every few
minutes), so "dev reads the folder" can never equal "deploy reads a committed
snapshot".

For the engine owner's live build during engine work:

```sh
OPENHW_ENGINE_FROM=owner npm run dev   # aliases back to the owner's dist/sab
```

Never in CI — CI must build from the committed snapshot.

## Provenance (measured 2026-10-20)

Copied **verbatim** from this repo's runtime-fallback mirror
`public/vendor/board-engines/esp32-emu/dist/sab/` (which is the OpenHW
patched mirror of the owner's build; `dist/` == npm `esp32-emu@1.2.0` bytes):

| file | md5 | role |
|---|---|---|
| `worker-proxy.js` | `3c5c1866c73dd81fa45e099bb01487d1` | SAB proxy — spawns `worker-entry.js` relative to itself |
| `worker-entry.js` | `4afe24dd2fc48b74af62007fe0183cb1` | engine worker (CPU + peripherals) |

`worker-proxy.js` resolves its worker with
`new URL("./worker-entry.js", import.meta.url)` — so **both files must sit
side by side**, as they do here and in the mirror.

### OpenHW patches carried by these bytes (do not clobber them)

1. **node:crypto MD5 stub** — the partition-table MD5 path; `node:crypto` has
   no browser build (the custom-CSV partition path is never hit on a
   merged-bin boot, but the module must still load in a worker).
2. **Inline `CMD_GET_WIFI_STATS` while `RUN=1`** ("OPENHW MIRROR PATCH
   (wifi-stats wedge fix)"): the proxy busy-spins for `RESP_DONE`, and while
   `RUN=1` the worker never returns to its command loop — without the inline
   service the runner's `pollNetStats` (every 2s after the first UART flow)
   wedges the board worker on its FIRST call and no UART is ever drained
   again (signature: ROM banner, then silence, engine running unwatched).
   Propose upstream verbatim (engine branch `wifi-fix@a0684ef`).
3. **Inline `CMD_GET_TWAI_TX`** — same wedge class, same inline allow-list.

These are the reason the repo mirror is the source of truth: the owner's
`dist/` copy at the time of the last rebuild did **not** carry the inline
`CMD_GET_WIFI_STATS` service, and the ESP32-CAM 2-board LAN cell was flaky
because of it.

## Engine-byte integrity (READ ONLY check)

```sh
npm run check:engine-bytes
```

It compares the bytes committed here against the owner folder **as it is
right now** and prints `engine | pinned file (md5) | owner file (md5 |
MISSING) | verdict`. Verdicts: `SAME` / `DIFFERENT` (the owner rebuilt —
information, not a failure) / `MISMATCHED PAIR` (a glue+wasm pair changed
inconsistently — the dangerous one) / `NOT BUILT` (the owner has no build
output — this is the ESP32 state today: `dist/` was deleted mid-session) /
`MISSING` (the **repo** side is broken → non-zero exit).

Rules: **read only** (it never copies anything), refresh **only from a
stable owner build**, **always take the proxy + worker from ONE build**,
run the check **before and after** a refresh, and **re-run this engine's
cells** after refreshing. Full write-up: `docs/engine-bytes.md`.

`--repo-only` checks the repo side alone (that is what CI wants —
on CI the owner folders do not exist and the check reports
*owner folder not present (CI)* and still exits 0). `--json` gives
the machine-readable form.

## Refresh recipe (when the owner lands a new engine build)

Take the bytes from the owner's `dist/sab/` **only** when they are a stable
build, and re-apply the three patches above (they are small and marked in
the file). Then:

```sh
OWNER="/home/danish1075/Documents/esp32 emu/dist/sab"
DEST="src/engines/esp32-emu/dist/sab"
MIRROR="public/vendor/board-engines/esp32-emu/dist/sab"
cp "$OWNER/worker-proxy.js" "$DEST/worker-proxy.js"
cp "$OWNER/worker-entry.js" "$DEST/worker-entry.js"
cp "$DEST/worker-proxy.js" "$MIRROR/worker-proxy.js"
cp "$DEST/worker-entry.js" "$MIRROR/worker-entry.js"
md5sum "$DEST"/* "$MIRROR"/*
```

Then re-run the ESP32 cells (`esp32-wifi-gateway`, `esp32-cam-wifi-gateway`,
`esp32-cam-lan`, `esp32-i2c`, `esp32-spi`) before committing.
