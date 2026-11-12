# Engine bytes — the pinned snapshot, the moving target, and the refresh recipe

Every board engine in OpenHW Studio runs on **bytes**, and every one of those
bytes exists in two places:

| side | where | who owns it | how fast it moves |
|---|---|---|---|
| **repo-pinned snapshot** | `src/engines/<engine>/` + the runtime mirror `public/vendor/board-engines/<engine>/` (+ `public/wasm/*.wasm`) | **this repo** (committed) | only when a human refreshes it on purpose |
| **owner build** | the engine owner's checkout outside this repo (`~/Documents/rp2350/Pico-emu`, `~/Documents/esp32 emu`, `~/Documents/stm32 F4`, `~/Documents/stm32 emu blue pill`, `~/Documents/microbit-v2`, `~/Documents/8086`) | the engine owner | **every few minutes** — the owners rebuild continuously while CPU work is in flight |

**The repo-pinned snapshot is the deploy artifact.** Dev (`vite dev`), the
built bundle (`npm run build` → `dist/assets/*`), the deployed container
(Dockerfile → `.github/workflows/deploy.yml`) and the `/vendor/board-engines/…`
runtime fallback all read the SAME committed files. The owner folders are
**moving targets**: "dev reads the folder" can never equal "deploy reads a
committed snapshot", and an alias to an owner path is a **hard build failure**
in CI (the container checks out only this repo + `openhw-studio-emulator`).

## The failure mode this guards against

The glue resolves its wasm **relative to itself**
(`new URL('<engine>_bg.wasm', import.meta.url)`), and the facade calls wasm
exports by name. A hand-copy that mixes a **new wasm with an old glue**
(or the reverse) misbinds exports: `WebAssembly.instantiate` fails on a
missing export, or — worse — it instantiates and then the board silently
misbehaves (lost edge timestamps, a stuck peripheral, a green-looking cell
that measures the wrong thing).

That is not hypothetical. On 2026-10-20 the shipped app was resolving the
**stale npm `stm32f1-emu` build** (glue `7387b216` / wasm `ddfbc2a5`) instead
of the owner's build, which turned the SoftSerial RX loopback and the I2C RTC
readback cells RED — the engine was blamed for a packaging bug. And TODAY
the STM32F1 owner folder is in exactly that state: **new wasm, old glue**.

## The tool: `npm run check:engine-bytes`

`scripts/check-engine-bytes.mjs` compares the committed bytes against the owner
folder **as it is right now** and prints:

```
engine | pinned file (md5) | owner folder file (md5 or MISSING) | verdict
```

Verdicts:

| verdict | meaning | is it a failure? |
|---|---|---|
| `SAME` | the pinned bytes and the owner bytes are identical | no |
| `DIFFERENT` | both exist, the hashes differ (the owner rebuilt) | **no — information** |
| `MISMATCHED PAIR` | a glue+wasm pair changed **inconsistently** (the wasm moved, the glue did not, or vice versa) | no — but **this is the dangerous one**: it is what a bad hand-copy produces |
| `NOT BUILT` | the owner folder is there but has no build output (e.g. the ESP32 `dist/` was deleted mid-session) | no — information |
| `MISSING` | the **repo-pinned** file is absent or unreadable | **YES — the repo side is broken** |
| `MIRROR DRIFT` | a repo copy of the same byte set drifted away from the pinned primary (the deploy would load different bytes than the bundle) | **YES — the repo side is broken** |
| `OWNER ABSENT` | the owner checkout is not on this machine — normal on CI | no |
| `N/A (no owner)` | pure-JS npm engine (AVR / `avr8js`) or a repo-only artefact (the OpenHW Pico fork) — no owner build to compare | no |

Rules the tool obeys:

- **READ ONLY.** It never writes, copies or modifies anything — not in the
  repo, not in an owner folder. (Proved by a unit test: the watched repo
  trees are byte-identical after a run — `tests/unit/worker/engine-bytes.test.mjs`.)
- It checks **every committed copy** of a byte, not just one: the pinned
  primary, the `/vendor` runtime fallback, the `public/wasm` twin and the
  in-tree engine copy. A drift between two copies of the same byte is
  `MIRROR DRIFT` and fails the run.
- It **degrades gracefully** when an owner folder does not exist (normal on
  CI): it prints *owner folder not present (CI)* and exits 0.
- It exits **non-zero only when the REPO side is broken** (a pinned file
  missing/unreadable, or a drifted copy). A `DIFFERENT` owner folder is
  information, not a failure, because the owner is actively rebuilding.
- The engine list and the pinned/owner paths are **data at the top of the
  file** (`const ENGINES = [...]`), so a new engine is one entry.

Options: `--json` (machine-readable), `--verbose` (per-file notes),
`--repo-only` (check the repo side only — what CI wants).

## Refresh recipe (per engine)

The per-engine recipe lives next to the bytes themselves, in
`src/engines/<engine>/README.md` (and, for the engines that are not
`src/engines/`-shaped, in the same table below). The shared rules:

1. **Refresh only from a STABLE owner build.** The owner folders are rebuilt
   every few minutes; a folder mid-rebuild has a new wasm and a stale glue.
   If the owner's tree is dirty, prefer the committed build
   (`git -C "$OWNER" show HEAD:…`) or wait for a clean build.
2. **Always keep glue + wasm (+ facade) from ONE build.** Copy the whole set
   in one go, never file by file, and never mix an npm wasm with a folder
   glue (or the reverse).
3. **Run `npm run check:engine-bytes` BEFORE the refresh** (to know what you
   are starting from) and **AFTER it** (to prove the new set is consistent
   and that every repo copy still matches its pinned primary).
4. **After refreshing, re-run that engine's cells** — the bytes are the
   thing that changes, so the cells are the proof. A refreshed engine with
   no re-run cell is an unverified engine.
5. Update the md5 table in the engine's README and the **Engine byte status**
   table in `matrix.md`.

### Refresh checklist (copy/paste)

```sh
# 0. where am I?
npm run check:engine-bytes            # BEFORE

# 1. the owner's build must be CLEAN and STABLE
git -C "$OWNER" status --porcelain     # empty output == stable
ls -la "$OWNER"/<build-dir>            # the glue+wasm must have the same mtime

# 2. copy the WHOLE set (glue + wasm + facade) in one go, into
#    src/engines/<engine>/ AND the runtime mirror
#    public/vendor/board-engines/<engine>/ (+ public/wasm/*.wasm)

# 3. prove it
npm run check:engine-bytes            # AFTER  -> repo side OK, no MIRROR DRIFT
npm run build && git checkout -- public/version.json
npx vitest run

# 4. re-run that engine's cells (the bytes are what changed)
npx playwright test tests/e2e/<engine>-*.spec.js --workers=1

# 5. record the new md5s in the engine README + matrix.md
```

## Engine byte status (measured 2026-10-20)

| engine | owner folder | pinned bytes (repo) | owner bytes TODAY | verdict |
|---|---|---|---|---|
| `stm32f1-emu` | `~/Documents/stm32 emu blue pill/pkg` | glue `43c24f16` + wasm `d1e69c28` + facade `091a0746`/`f2cff22c` | glue `43c24f16` + wasm **`641abe52`** + facade `091a0746`/`f2cff22c` | **MISMATCHED PAIR** — the owner rebuilt the wasm only |
| `pico-emu` | `~/Documents/rp2350/Pico-emu/web` | glue `c3b784f0` + wasm `0c74dffe` | glue `c3b784f0` + wasm `0c74dffe` | **SAME** |
| `esp32-emu` | `~/Documents/esp32 emu/dist/sab` | proxy `3c5c1866` + worker `4afe24dd` | **no `dist/` at all** | **NOT BUILT** |
| `esp32` engine wasm | `~/Documents/esp32 emu/src/engine/esp-xtensa` | wasm `d6d17d79` (+ ROM `445981c7`) | wasm `d1c08b41` (ROM `445981c7`) | **DIFFERENT** — the repo copy carries the OpenHW patches on purpose |
| `stm32f4-emu` | `~/Documents/stm32 F4/site` | glue `19a96301` + wasm `9455e31c` + facade `9631b8db`/`1f36d0ed`/`abd3334f` | glue `2574b1e2` + wasm `578ce844` + facade `9f9d7338`/`1f36d0ed`/`abd3334f` | **DIFFERENT** — glue + wasm + `emulator.js` moved together (a consistent rebuild) |
| `nrf52833-periph-wasm` (micro:bit) | `~/Documents/microbit-v2/demo/pkg` | glue `112f7ab3` + wasm `d5a0e574` | glue `112f7ab3` + wasm `d5a0e574` | **SAME** |
| `8086emu` (retro) | `~/Documents/8086/pkg` | glue `9832e032` + wasm `fa53c0f2` | glue `9832e032` + wasm `fa53c0f2` | **SAME** |
| `pico-emu-fork` (OpenHW fork) | — (we build it) | wasm `863559a3` | — | **N/A (no owner)** — deliberately NOT the owner bytes |
| `avr8js` (AVR) | — (pure-JS npm package, no owner build) | `node_modules/avr8js` 0.21.0, pinned by `package-lock.json` | — | **N/A (no owner)** |

Nothing in that table is an error on its own: the owners rebuild. What would
be an error is the **repo** side — a missing pinned file or a drifted copy —
and that is the only thing `check:engine-bytes` fails on.

> The "owner bytes TODAY" column is a **snapshot in time**, not a fact that
> stays true. While that table was being written the STM32F4 owner's
> `site/emulator.js` moved **twice** (`c00a11f6` → `2c12466c` → `9f9d7338`)
> and the wasm moved again (`578ce844` → `214cfc92`) — the owner rebuilds
> every few minutes. That churn is the whole reason the repo-pinned
> snapshot is the deploy artifact and the reason a hand-copy has to take
> glue + wasm + facade from **one** build. Re-run the tool instead of
> trusting a number in a table.

### What each verdict means for the NEXT action

| verdict | what to do |
|---|---|
| `SAME` | nothing — the repo snapshot is the owner's current build |
| `DIFFERENT` | nothing yet. When the owner says "new build landed", refresh the WHOLE set from that build (never one file) |
| `MISMATCHED PAIR` | **do not copy anything out of this folder.** The owner is mid-rebuild; a hand-copy now would ship the bad pair. Ask the owner for a stable build |
| `NOT BUILT` | the owner deleted/never produced the build output. The repo snapshot is the only thing that works — do not delete it |
| `OWNER ABSENT` | normal on CI; nothing to do |

## Where the bytes are resolved

`vite.config.js` → `resolve.alias` is the single resolution point (plus
`src/worker/runners/arm-runner-base.ts` → `importEngine`, which falls back to
the `/vendor/board-engines/…` URL at runtime). Both point at the repo bytes
today; the npm endgame is a root swap in those two places, never a rewrite
across the runners.

Concretely (see `vite.config.js`):

| engine | repo bytes (what dev + build + deploy load) |
|---|---|
| STM32F1 | `src/engines/stm32f1-emu/pkg/*` (glue + wasm + facades) |
| Pico | `src/engines/pico-emu/picoemu.wasm.js` + `.wasm` (+ the OpenHW fork in `src/worker/engines/pico-emu-fork/`) |
| ESP32 | `src/engines/esp32-emu/dist/sab/worker-proxy.js` + `worker-entry.js` |
| STM32F4 | `public/vendor/board-engines/stm32f4-emu/site/*` + `public/wasm/stm32_periph_wasm_bg.wasm` |
| micro:bit | `public/vendor/board-engines/microbit/*` + `src/worker/engines/microbit/*` + `public/wasm/nrf52833_periph_wasm_bg.wasm` |
| Retro (8086) | `public/vendor/board-engines/8086emu/multi_cpu_emu.js` + `public/wasm/multi_cpu_emu_bg.wasm` |
| AVR | the pure-JS `avr8js` npm package (no wasm, no owner build) |
