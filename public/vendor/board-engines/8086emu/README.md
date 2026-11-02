# Retro 8/16-bit engine bytes (8086emu, npm + owner build, committed here)

The retro boards (8086 / 8088 / 8085 / 8051 / 6502 / Z80 / rv32) run on the
`8086emu` engine: a **wasm-bindgen pair** (JS glue + `.wasm`) that MUST come
from one build — the glue resolves its wasm relative to itself and the
facade calls wasm exports by name, so a mismatched pair either fails at
`WebAssembly.instantiate` (missing export) or silently misbinds.

| file | md5 | copies |
|---|---|---|
| `multi_cpu_emu.js` (glue) | `9832e032cb6a3b6da49c660a517e0ad0` | `public/vendor/board-engines/8086emu/` (runtime fallback) + `node_modules/8086emu/` (bundler path, npm `8086emu@1.5.1`) |
| `multi_cpu_emu_bg.wasm` | `fa53c0f2ab4a058e2a8a17c0fc2e8ec7` | `public/wasm/` + `node_modules/8086emu/` |

`src/worker/runners/retro-runner.ts` resolves them through `importEngine`
(`src/worker/runners/arm-runner-base.ts`): the bundler path first
(`8086emu/multi_cpu_emu.js`), the `/vendor/board-engines/8086emu/…` URL at
runtime in the deployed app. The wasm itself is always fetched explicitly
from `/wasm/multi_cpu_emu_bg.wasm` (the glue-URL-relative default breaks
under vite worker bundling — same class of bug as pico-emu's glue).

## Provenance (measured 2026-10-20)

The npm package `8086emu@1.5.1` and the owner's checkout
`~/Documents/8086/pkg/` are byte-identical for both files, and the repo
copies are byte-identical to both.

## Engine-byte integrity (READ ONLY check)

```sh
npm run check:engine-bytes
```

Verdicts: `SAME` / `DIFFERENT` (the owner rebuilt — information, not a
failure) / `MISMATCHED PAIR` (a glue+wasm pair changed inconsistently — the
dangerous one) / `NOT BUILT` / `MISSING` (the **repo** side is broken →
non-zero exit) / `MIRROR DRIFT` (a repo copy drifted away from the pinned
primary).

**State on 2026-10-20: `SAME`** — the owner folder is byte-identical to the
repo snapshot.

Rules: **read only**, refresh **only from a stable owner build**, **always
take glue + wasm from ONE build**, run the check **before and after** a
refresh, and **re-run this engine's cells** after refreshing. Full write-up:
`docs/engine-bytes.md`.

## Refresh recipe (when the owner lands a new engine build)

```sh
# 1. the owner's tree must be CLEAN
git -C "$HOME/Documents/8086" status --porcelain

# 2. copy BOTH files in one go into
#    public/vendor/board-engines/8086emu/multi_cpu_emu.js
#    public/wasm/multi_cpu_emu_bg.wasm
#    (and re-install / re-copy the npm package if the npm shape changed)

# 3. prove it
npm run check:engine-bytes
npm run build && git checkout -- public/version.json

# 4. re-run this engine's cells
npx playwright test tests/e2e/retro-*.spec.js --workers=1
```
