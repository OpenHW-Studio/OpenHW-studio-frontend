# micro:bit v2 engine bytes (nRF52833, owner build, committed here)

The micro:bit v2 board runs on the engine owner's `nrf52833-periph-wasm`
build: a **wasm-bindgen pair** (JS glue + `.wasm`) that MUST come from one
build — a mismatched pair misbinds the exported ABI and the board dies with
a confusing "missing export" instead of a clear error.

Three copies of each byte live in this repo, and they are the same build:

| file | md5 | copies |
|---|---|---|
| `nrf52833_periph_wasm.js` (glue) | `112f7ab323f20ba324f47cd4774e2308` | `public/vendor/board-engines/microbit/` (runtime fallback) + `src/worker/engines/microbit/` (bundler path) |
| `nrf52833_periph_wasm_bg.wasm` | `d5a0e574319784def884edddb4fdcffd` | `public/vendor/board-engines/microbit/` + `public/wasm/` |

`src/worker/runners/microbit-runner.ts` resolves them through
`importEngine` (`src/worker/runners/arm-runner-base.ts`): the bundler path
first (`../engines/microbit/nrf52833_periph_wasm.js`), the
`/vendor/board-engines/microbit/…` URL at runtime in the deployed app.

## Provenance (measured 2026-10-20)

Copied verbatim from the engine owner's checkout
`~/Documents/microbit-v2/demo/pkg/` — the committed `nrf52833-periph-wasm`
0.2.0 freeze (owner commit `4a46800` "P164 OpenHW runner gear: PWM readback
+ injection recipes + fixtures + frozen bundle"). The crate source and
`demo/pkg` were last touched by that same commit and the tree was clean, so
the committed pkg IS the current source — no rebuild needed.

The same pair is guarded by a unit test:
`tests/unit/worker/microbit-engine-pair.test.mjs` (sha256 of every copy +
the export list the runner wires).

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
git -C "$HOME/Documents/microbit-v2" status --porcelain

# 2. copy BOTH files in one go into all three copies
#    public/vendor/board-engines/microbit/{*.js,*.wasm}
#    public/wasm/nrf52833_periph_wasm_bg.wasm
#    src/worker/engines/microbit/nrf52833_periph_wasm.js

# 3. prove it
npm run check:engine-bytes
npx vitest run tests/unit/worker/microbit-engine-pair.test.mjs
npm run build && git checkout -- public/version.json

# 4. re-run this engine's cells
npx playwright test tests/e2e/microbit-*.spec.js --workers=1
```
