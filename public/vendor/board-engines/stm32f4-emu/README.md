# STM32F4 engine bytes (owner build, committed here)

This folder is the **runtime fallback** for the STM32F4 (F401 / F407 / F411 /
F407VE / F429) board engine. `src/worker/runners/stm32f4-runner.ts` resolves
the engine through `importEngine` (`src/worker/runners/arm-runner-base.ts`),
which tries the bundler specifier first and falls back to this folder:

| consumer | resolves to | bytes |
|---|---|---|
| `vite dev` / `npm run build` (bundler path) | `stm32f4-emu/stm32f4` + `stm32f4-emu/vendor` aliased in `vite.config.js` | owner `/home/danish1075/Documents/stm32 F4/site` in dev, `src/engines/stm32f4-emu/` in snapshot/CI |
| runtime fallback `/vendor/board-engines/stm32f4-emu/…` | this folder | **byte-identical mirror** of the owner build |
| engine wasm (both paths) | `/wasm/stm32_periph_wasm_bg.wasm` | `public/wasm/`, byte-identical to the owner wasm |

The owner build was adopted 2026-11-27 (the previous npm pair is retired).
All four bytes below are copied from ONE owner build; the facade is still
byte-identical to npm, but the glue, the wasm and `emulator.js` are newer
and carry translated-block execution plus the fused stack-counter loop.
The runner passes `tb: true, tbMinRun: 600` unless the board has attr
`tb: 'off'`.

## Provenance (measured 2026-11-27)

| file | md5 | role | repo copy | npm copy |
|---|---|---|---|---|
| `site/vendor/stm32_periph_wasm.js` | `5df75c9a6e57312b0b815a897a5d8d0a` | wasm-bindgen glue | here + `src/engines/` | older (`19a96301`) |
| `stm32_periph_wasm_bg.wasm` | `4e50ca2358ceea0f885ee9cdcbae1696` | engine wasm (CPU + peripherals) | `public/wasm/` + here + `src/engines/` | older (`7ef32e3f`) |
| `site/emulator.js` | `3dcca2e2523f0360c47db1ed1aae88ed` | wasm bindings facade (`tb`, gate 600) | here + `src/engines/` | older (`9631b8db`) |
| `site/stm32f4.js` | `1f36d0ed0514a08f9f99e483da40c85d` | board facade (STM32F4 class) | here + `src/engines/` | same |
| `site/loaders.js` | `abd3334f23021ceeaff7a17213910d36` | firmware/SVD loader | here + `src/engines/` | same |

**Glue + wasm + facade must come from ONE build.** The glue resolves its wasm
relative to itself and the facade calls wasm exports by name; a mismatched
pair fails at `WebAssembly.instantiate` (missing export) or silently
misbinds the facade.

## Engine-byte integrity (READ ONLY check)

```sh
npm run check:engine-bytes
```

It compares the bytes committed here against the owner folder
(`~/Documents/stm32 F4/site`) **as it is right now** and prints
`engine | pinned file (md5) | owner file (md5 | MISSING) | verdict`.
Verdicts: `SAME` / `DIFFERENT` (the owner rebuilt — information, not a
failure) / `MISMATCHED PAIR` (a glue+wasm pair changed inconsistently —
the dangerous one) / `NOT BUILT` (the owner has no build output) /
`MISSING` (the **repo** side is broken → non-zero exit) /
`MIRROR DRIFT` (a repo copy drifted away from the pinned primary).

**State on 2026-10-20: `DIFFERENT`** — the owner is mid-rebuild
(glue `2574b1e2`, wasm `578ce844`, `emulator.js` `9f9d7338` — snapshot
20:40; the facade moved twice before that: `c00a11f6` → `2c12466c` →
`9f9d7338` — and the wasm + facade moved again within minutes, now
`214cfc92` / `c2f06681`), but the glue and the wasm moved **together**,
so the pair is still consistent. Do NOT copy anything out of that folder
until the owner says the build is stable. Re-run `npm run check:engine-bytes`
instead of trusting these numbers — the owner folder is a moving target.

Rules: **read only** (it never copies anything), refresh **only from a
stable owner build**, **always take glue + wasm + facade from ONE build**,
run the check **before and after** a refresh, and **re-run this engine's
cells** after refreshing. Full write-up: `docs/engine-bytes.md`.

## Refresh recipe (when the owner lands a new engine build)

```sh
# 1. the owner's build must be CLEAN and STABLE
git -C "$HOME/Documents/stm32 F4" status --porcelain   # empty == stable

# 2. copy the WHOLE set in one go (glue + wasm + facades) into
#    public/vendor/board-engines/stm32f4-emu/site/ AND
#    public/wasm/stm32_periph_wasm_bg.wasm

# 3. prove it
npm run check:engine-bytes      # repo side OK, no MIRROR DRIFT
npm run build && git checkout -- public/version.json
npx vitest run

# 4. re-run this engine's cells (the bytes are what changed)
npx playwright test tests/e2e/stm32f4-*.spec.js --workers=1

# 5. record the new md5s here + in matrix.md
```
