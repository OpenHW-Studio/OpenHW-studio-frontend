# STM32F1 engine bytes (owner build, committed here)

This folder is the **single resolution point** for the STM32F1 (Blue Pill /
F103 / GD32) board engine. `vite.config.js` aliases the npm-shaped
specifiers (`stm32f1-emu`, `stm32f1-emu/emulator`, `stm32f1-emu/pkg/…`) onto
`pkg/` here, so:

| consumer | resolves to | bytes |
|---|---|---|
| `vite dev` (http://localhost:5173 / lane ports) | `src/engines/stm32f1-emu/pkg/*` | this folder |
| `npm run build` → `dist/assets/*` (bundled primary) | `src/engines/stm32f1-emu/pkg/*` | this folder |
| runtime fallback `/vendor/board-engines/stm32f1-emu/pkg/*` | `public/vendor/board-engines/stm32f1-emu/pkg/*` | mirror of this folder |

The runtime fallback is the **same byte set** — keep both copies in sync
(see refresh recipe below). It exists so a bundler-resolution failure still
boots an engine instead of an idle board.

## Provenance (measured 2026-10-20)

Copied verbatim from the engine owner's checkout
`/home/danish1075/Documents/stm32 emu blue pill/pkg/` (package `stm32f1-emu`,
version label 3.3.0, branch `master`). Byte set (md5):

| file | md5 | role |
|---|---|---|
| `pkg/stm32_bluepill_wasm.js` | `43c24f1611785283ee60c220e1a20b3a` | wasm-bindgen glue (imports the wasm) |
| `pkg/stm32_bluepill_wasm_bg.wasm` | `d1e69c2892c10425ddcaad02236d45f2` | engine wasm (CPU + peripherals) |
| `pkg/emulator.js` | `091a074694506948211ac1f80542fb18` | wasm bindings facade |
| `pkg/stm32f1.js` | `f2cff22cba7e34e5fb6e5e574219c485` | board facade (STM32F1 class) |

**Glue + wasm + facade must come from ONE build.** The glue resolves its wasm
relative to itself (`new URL('stm32_bluepill_wasm_bg.wasm', import.meta.url)`)
and the facade calls wasm exports by name; a mismatched pair fails at
`WebAssembly.instantiate` (missing export) or silently misbinds the facade.
This set is self-consistent: the wasm exports 135 symbols including
`instruction_count_now`, `i2c_clear_rx` and `tim_chan_pin`, which the facade
(`emulator.js`) imports, and it delivers pin-change events as
`(port, pin, level, tcount)` quads.

Why these bytes and not the published `stm32f1-emu@3.3.0` npm package: the
npm package is an **older build of the same engine** (glue `7387b216…`, wasm
`ddfbc2a5…`, facade `44845aa9…`, emulator `d2f7fcf3…`). Its wasm exports only
132 symbols and delivers pin events as `(port, pin, level)` triples, so the
runner loses the engine-domain edge stamp (`instructionCountNow`) — the F1
SoftSerial RX path degrades to coarse hunting and the RX loopback cell fails;
the I2C RTC readback cell fails too. With the bytes above both cells are
green. The npm package stays in `package.json` as the package-shape anchor
for the eventual npm flip (see AGENTS.md).

## Refresh recipe (when the owner lands a new engine build)

The owner's checkout is a moving target — the wasm is rebuilt every few
minutes while CPU work is in flight. Refresh deliberately, from a **stable**
build, and keep the pair matched:

```sh
OWNER="/home/danish1075/Documents/stm32 emu blue pill/pkg"
MIRROR="public/vendor/board-engines/stm32f1-emu/pkg"
for f in stm32f1.js emulator.js stm32_bluepill_wasm.js stm32_bluepill_wasm_bg.wasm \
         stm32f1.d.ts emulator.d.ts stm32_bluepill_wasm.d.ts stm32_bluepill_wasm_bg.wasm.d.ts; do
  cp "$OWNER/$f" "src/engines/stm32f1-emu/pkg/$f"
  cp "$OWNER/$f" "$MIRROR/$f"
done
# the public/wasm copy is the legacy node_modules-era location; keep it in
# step too (nothing loads it today, but it is the historical fallback):
cp "$OWNER/stm32_bluepill_wasm_bg.wasm" public/wasm/stm32_bluepill_wasm_bg.wasm
# sanity: the glue/wasm/facade trio must come from ONE build
md5sum src/engines/stm32f1-emu/pkg/*.js src/engines/stm32f1-emu/pkg/*.wasm "$MIRROR"/*.wasm
```

Never copy a wasm from one build over a glue from another. If the owner's
tree is dirty (uncommitted `src/` edits), prefer the committed build
(`git -C "$OWNER" show HEAD:pkg/stm32_bluepill_wasm_bg.wasm`) or wait for a
clean build — the glue is not tracked by the owner's git (it is regenerated
by `wasm-pack`), so the pair must be taken from one on-disk `pkg/` snapshot.

## Cache note

The primary path is bundled by vite, so the wasm is emitted as a **hashed**
asset (`dist/assets/stm32_bluepill_wasm_bg-<hash>.wasm`) — a refreshed wasm
always gets a fresh URL, so the browser can never pair a new glue with an old
wasm. The `/vendor/…` fallback keeps the engine's own unhashed name and is
served with nginx `immutable` caching, so it can lag behind after a refresh;
it is only used when the bundled primary fails to load.
