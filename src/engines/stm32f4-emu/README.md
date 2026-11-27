# STM32F4 engine bytes — owner build adopted 2026-11-27

This folder is the **repo-pinned primary** for the STM32F4 (F401 / F407 /
F411 / F407VE / F429) engine. `vite.config.js` aliases the runner's
`stm32f4-emu/...` specifiers here in snapshot/CI mode; dev with the owner
folder present uses `/home/danish1075/Documents/stm32 F4/site` instead.
`public/vendor/board-engines/stm32f4-emu/site/` is the byte-identical runtime
fallback, and `public/wasm/stm32_periph_wasm_bg.wasm` is the runner-fetched
wasm twin. Both are checked by `npm run check:engine-bytes`.

Until 2026-11-27 F4 stayed on the npm pair (`stm32f4-emu@1.6.x`) while the
owner folder was mid-rebuild. The owner build is now stable and carries the
general speed work: the Rust core's fused stack-counter delay loop plus
opt-in translated-block execution. The npm pair is no longer used by this
app (`OPENHW_F4_ENGINE=npm` remains a benchmark-only A/B switch).

## Provenance (measured 2026-11-27, copied from the owner `site/` build)

| file | md5 | role |
|---|---|---|
| `vendor/stm32_periph_wasm.js` | `5df75c9a6e57312b0b815a897a5d8d0a` | wasm-bindgen glue (exposes `tb_translate*`) |
| `vendor/stm32_periph_wasm_bg.wasm` | `4e50ca2358ceea0f885ee9cdcbae1696` | engine wasm (CPU + peripherals, fused loop) |
| `emulator.js` | `3dcca2e2523f0360c47db1ed1aae88ed` | wasm bindings facade (`tb`, `tbMinRun=600`, `tb_direct`) |
| `stm32f4.js` | `1f36d0ed0514a08f9f99e483da40c85d` | board facade (byte-identical to npm) |
| `loaders.js` | `abd3334f23021ceeaff7a17213910d36` | firmware/SVD loader |

The SVD files in `vendor/` and the `.d.ts` files are copied from the same
folder. **Glue + wasm + emulator must come from ONE build** — the glue
resolves its wasm relative to itself and the facade calls wasm exports by
name; mixing an npm wasm with the folder glue (or vice versa) misbinds
exports.

## Translated blocks (`tb`)

`stm32f4-runner.ts` passes `tb: true, tbMinRun: 600` to `createEmulator`
unless the board has attr `tb: 'off'|'0'|'false'`. The owner's own web app
also enables `tb` by default; 600 is their measured gate default on a quiet
box. `tb_direct` is left at the engine default (auto) so the shared-memory
translation path is used where the glue exposes it.

## Refresh recipe

1. `npm run check:engine-bytes` before and after — the repo side must be
   `SAME` with no `MIRROR DRIFT`.
2. Copy the **whole** owner `site/` build in one go into this folder, the
   `public/vendor/board-engines/stm32f4-emu/site/` mirror and
   `public/wasm/stm32_periph_wasm_bg.wasm` (never file by file).
3. `npm run build && git checkout -- public/version.json`, then re-run F4
   cells (`npx playwright test tests/e2e/stm32f4-*.spec.js --workers=1`).
4. Update the md5 tables here, in `docs/engine-bytes.md` and in `matrix.md`.
