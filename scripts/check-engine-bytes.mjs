#!/usr/bin/env node
// scripts/check-engine-bytes.mjs
//
// READ-ONLY integrity check for the engine bytes that ship with this repo.
//
// WHY THIS EXISTS
//   Every board engine runs on bytes that live in TWO places:
//     1. the repo-pinned snapshot  (src/engines/<engine>/ + the runtime
//        mirror public/vendor/board-engines/<engine>/ + public/wasm/*.wasm)
//        — this is what dev, `npm run build`, the deployed bundle and the
//        /vendor runtime fallback all load;
//     2. the engine OWNER's live checkout (a folder outside this repo that
//        the owner rebuilds continuously — the wasm changes every few
//        minutes while CPU work is in flight).
//   A hand-copy can mix a NEW wasm with an OLD glue and break a board
//   silently (the glue resolves its wasm relative to itself; a mismatched
//   pair misbinds exports). This script makes that visible instead of
//   discovering it as a RED cell.
//
// WHAT IT DOES
//   For every engine it compares the committed bytes against the owner
//   folder as it is RIGHT NOW and prints
//        engine | pinned file (md5) | owner folder file (md5 | MISSING) | verdict
//
// VERDICTS
//   SAME           the pinned bytes and the owner bytes are identical.
//   DIFFERENT      both exist, hashes differ (the owner rebuilt). NOT a
//                  failure — the owner is actively rebuilding.
//   MISMATCHED PAIR a glue+wasm pair changed INCONSISTENTLY (the wasm moved
//                  but the glue did not, or vice versa). This is the
//                  dangerous one: it is what a bad hand-copy produces.
//   NOT BUILT      the owner folder is there but has no build output
//                  (e.g. the ESP32 `dist/` was deleted mid-session).
//   MISSING        the REPO-pinned file is absent or unreadable — an
//                  ERROR (the repo side is broken).
//   MIRROR DRIFT   a repo copy of the same byte set drifted away from the
//                  pinned primary (the deploy would load different bytes
//                  than the bundle) — an ERROR (the repo side is broken).
//   OWNER ABSENT   the owner checkout is not on this machine (normal on
//                  CI) — information only, never a failure.
//   N/A (no owner) the engine has no owner build to compare against —
//                  a pure-JS npm package (avr8js) or a repo-only artefact
//                  (the OpenHW Pico fork).
//
// HARD RULES
//   * READ ONLY. This script never writes, copies, moves or deletes
//     anything — not in the repo, not in the owner folders.
//   * It exits non-zero ONLY when the REPO side is broken (a pinned file
//     missing/unreadable, or a repo copy that drifted away from the pinned
//     primary). A DIFFERENT owner folder is INFORMATION, not a failure: the
//     owner is actively rebuilding.
//   * A new engine is ONE entry in the ENGINES array below.
//
// Usage:  node scripts/check-engine-bytes.mjs [--json] [--verbose] [--repo-only]

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

// ─────────────────────────────────────────────────────────────────────────────
// DATA — one entry per engine. A new engine is one entry here.
//
//   ownerRoot   the engine owner's checkout (absolute, or ~/… — expanded).
//               null  -> the engine ships as a plain npm package / is a
//                        repo-only artefact, there is no owner folder to
//                        compare against.
//   ownerBuild  the build output directory inside ownerRoot (relative).
//   groups      one group = a set of files that MUST come from ONE build.
//               group.pair = true marks a glue+wasm pair (version-locked:
//               mixing them breaks the board).
//
//   file.pinned   path (repo-relative) of the committed bytes — the
//                 CANONICAL copy of that byte.
//   file.copies   other repo-relative paths that MUST be byte-identical to
//                 file.pinned (the runtime mirrors / the /vendor fallback /
////                the public/wasm twins). Drift here = the deploy would
//                 load different bytes than the bundle -> repo error.
//   file.owner    path relative to ownerBuild.
// ─────────────────────────────────────────────────────────────────────────────
const ENGINES = [
  {
    id: 'stm32f1-emu',
    label: 'STM32F1 (Blue Pill / F103 / GD32)',
    ownerRoot: '/home/danish1075/Documents/stm32 emu blue pill',
    ownerBuild: 'pkg',
    refreshRecipe: 'src/engines/stm32f1-emu/README.md',
    groups: [
      {
        id: 'wasm-pair',
        pair: true,
        note: 'wasm-bindgen glue + engine wasm — MUST be from one build',
        files: [
          {
            name: 'stm32_bluepill_wasm.js',
            role: 'glue',
            pinned: 'src/engines/stm32f1-emu/pkg/stm32_bluepill_wasm.js',
            copies: ['public/vendor/board-engines/stm32f1-emu/pkg/stm32_bluepill_wasm.js'],
            owner: 'stm32_bluepill_wasm.js',
          },
          {
            name: 'stm32_bluepill_wasm_bg.wasm',
            role: 'wasm',
            pinned: 'src/engines/stm32f1-emu/pkg/stm32_bluepill_wasm_bg.wasm',
            copies: [
              'public/vendor/board-engines/stm32f1-emu/pkg/stm32_bluepill_wasm_bg.wasm',
              'public/wasm/stm32_bluepill_wasm_bg.wasm',
            ],
            owner: 'stm32_bluepill_wasm_bg.wasm',
          },
        ],
      },
      {
        id: 'facades',
        pair: false,
        note: 'wasm-bindgen facade + board facade (call the wasm exports)',
        files: [
          {
            name: 'emulator.js',
            role: 'facade',
            pinned: 'src/engines/stm32f1-emu/pkg/emulator.js',
            copies: ['public/vendor/board-engines/stm32f1-emu/pkg/emulator.js'],
            owner: 'emulator.js',
          },
          {
            name: 'stm32f1.js',
            role: 'facade',
            pinned: 'src/engines/stm32f1-emu/pkg/stm32f1.js',
            copies: ['public/vendor/board-engines/stm32f1-emu/pkg/stm32f1.js'],
            owner: 'stm32f1.js',
          },
        ],
      },
    ],
  },
  {
    id: 'pico-emu',
    label: 'Pico / Pico 2 (RP2040 / RP2350)',
    ownerRoot: '/home/danish1075/Documents/rp2350/Pico-emu',
    ownerBuild: 'web',
    refreshRecipe: 'src/engines/pico-emu/README.md',
    groups: [
      {
        id: 'wasm-pair',
        pair: true,
        note: 'emscripten glue + engine wasm — MUST be from one build',
        files: [
          {
            name: 'picoemu.wasm.js',
            role: 'glue',
            pinned: 'src/engines/pico-emu/picoemu.wasm.js',
            copies: [
              'public/vendor/board-engines/pico-emu/picoemu.wasm.js',
              'src/worker/engines/pico-emu-fork/picoemu.wasm.js',
            ],
            owner: 'picoemu.wasm.js',
          },
          {
            name: 'picoemu.wasm.wasm',
            role: 'wasm',
            pinned: 'src/engines/pico-emu/picoemu.wasm.wasm',
            copies: ['public/wasm/picoemu.wasm.wasm'],
            owner: 'picoemu.wasm.wasm',
          },
        ],
      },
    ],
  },
  {
    id: 'esp32-emu',
    label: 'ESP32 / ESP32-CAM (SAB engine)',
    ownerRoot: '/home/danish1075/Documents/esp32 emu',
    ownerBuild: 'dist/sab',
    refreshRecipe: 'src/engines/esp32-emu/README.md',
    groups: [
      {
        id: 'sab-pair',
        pair: true,
        note: 'SAB proxy + worker entry — MUST be from one build',
        files: [
          {
            name: 'worker-proxy.js',
            role: 'glue',
            pinned: 'src/engines/esp32-emu/dist/sab/worker-proxy.js',
            copies: ['public/vendor/board-engines/esp32-emu/dist/sab/worker-proxy.js'],
            owner: 'worker-proxy.js',
          },
          {
            name: 'worker-entry.js',
            role: 'worker',
            pinned: 'src/engines/esp32-emu/dist/sab/worker-entry.js',
            copies: ['public/vendor/board-engines/esp32-emu/dist/sab/worker-entry.js'],
            owner: 'worker-entry.js',
          },
        ],
      },
    ],
  },
  {
    id: 'esp32-engine-wasm',
    label: 'ESP32 engine wasm + ROM (repo-committed, runtime-fetched)',
    ownerRoot: '/home/danish1075/Documents/esp32 emu',
    ownerBuild: 'src/engine/esp-xtensa',
    refreshRecipe: 'src/engines/esp32-emu/README.md',
    groups: [
      {
        id: 'engine-wasm',
        pair: false,
        note: 'repo copy carries the OpenHW patches — expect DIFFERENT',
        files: [
          {
            name: 'esp_engine_wasm.wasm',
            role: 'wasm',
            pinned: 'public/wasm/esp_engine_wasm.wasm',
            copies: [],
            owner: 'esp_engine_wasm.wasm',
          },
        ],
      },
    ],
    extraOwnerFiles: [
      {
        name: 'esp32-v3-rom.bin',
        role: 'rom',
        pinned: 'public/firmware/esp32-v3-rom.bin',
        ownerRootRelative: 'src/rom/esp32-v3-rom.bin',
      },
    ],
  },
  {
    id: 'stm32f4-emu',
    label: 'STM32F4 (F401 / F407 / F411 / F407VE / F429)',
    ownerRoot: '/home/danish1075/Documents/stm32 F4',
    ownerBuild: 'site',
    refreshRecipe: 'public/vendor/board-engines/stm32f4-emu/README.md',
    groups: [
      {
        id: 'wasm-pair',
        pair: true,
        note: 'wasm-bindgen glue + engine wasm — MUST be from one build',
        files: [
          {
            name: 'site/vendor/stm32_periph_wasm.js',
            role: 'glue',
            pinned: 'public/vendor/board-engines/stm32f4-emu/site/vendor/stm32_periph_wasm.js',
            copies: [],
            owner: 'vendor/stm32_periph_wasm.js',
          },
          {
            name: 'stm32_periph_wasm_bg.wasm',
            role: 'wasm',
            pinned: 'public/wasm/stm32_periph_wasm_bg.wasm',
            copies: ['public/vendor/board-engines/stm32f4-emu/site/vendor/stm32_periph_wasm_bg.wasm'],
            owner: 'vendor/stm32_periph_wasm_bg.wasm',
          },
        ],
      },
      {
        id: 'facades',
        pair: false,
        note: 'emulator facade + board facade + loaders',
        files: [
          {
            name: 'site/emulator.js',
            role: 'facade',
            pinned: 'public/vendor/board-engines/stm32f4-emu/site/emulator.js',
            copies: [],
            owner: 'emulator.js',
          },
          {
            name: 'site/stm32f4.js',
            role: 'facade',
            pinned: 'public/vendor/board-engines/stm32f4-emu/site/stm32f4.js',
            copies: [],
            owner: 'stm32f4.js',
          },
          {
            name: 'site/loaders.js',
            role: 'loader',
            pinned: 'public/vendor/board-engines/stm32f4-emu/site/loaders.js',
            copies: [],
            owner: 'loaders.js',
          },
        ],
      },
    ],
  },
  {
    id: 'nrf52833-periph-wasm',
    label: 'micro:bit v2 (nRF52833)',
    ownerRoot: '~/Documents/microbit-v2',
    ownerBuild: 'demo/pkg',
    refreshRecipe: 'public/vendor/board-engines/microbit/README.md',
    groups: [
      {
        id: 'wasm-pair',
        pair: true,
        note: 'wasm-bindgen glue + engine wasm — MUST be from one build',
        files: [
          {
            name: 'nrf52833_periph_wasm.js',
            role: 'glue',
            pinned: 'public/vendor/board-engines/microbit/nrf52833_periph_wasm.js',
            copies: ['src/worker/engines/microbit/nrf52833_periph_wasm.js'],
            owner: 'nrf52833_periph_wasm.js',
          },
          {
            name: 'nrf52833_periph_wasm_bg.wasm',
            role: 'wasm',
            pinned: 'public/vendor/board-engines/microbit/nrf52833_periph_wasm_bg.wasm',
            copies: ['public/wasm/nrf52833_periph_wasm_bg.wasm'],
            owner: 'nrf52833_periph_wasm_bg.wasm',
          },
        ],
      },
    ],
  },
  {
    id: '8086emu',
    label: 'Retro 8/16-bit (8086 / 8088 / 8085 / 8051 / 6502 / Z80 / rv32)',
    ownerRoot: '~/Documents/8086',
    ownerBuild: 'pkg',
    refreshRecipe: 'public/vendor/board-engines/8086emu/README.md',
    groups: [
      {
        id: 'wasm-pair',
        pair: true,
        note: 'wasm-bindgen glue + engine wasm — MUST be from one build',
        files: [
          {
            name: 'multi_cpu_emu.js',
            role: 'glue',
            pinned: 'public/vendor/board-engines/8086emu/multi_cpu_emu.js',
            copies: ['node_modules/8086emu/multi_cpu_emu.js'],
            owner: 'multi_cpu_emu.js',
          },
          {
            name: 'multi_cpu_emu_bg.wasm',
            role: 'wasm',
            pinned: 'public/wasm/multi_cpu_emu_bg.wasm',
            copies: ['node_modules/8086emu/multi_cpu_emu_bg.wasm'],
            owner: 'multi_cpu_emu_bg.wasm',
          },
        ],
      },
    ],
  },
  {
    id: 'pico-emu-fork',
    label: 'Pico OpenHW fork (jsmirror SDD, I2C runs) — repo-only, built by us',
    ownerRoot: null,
    ownerBuild: null,
    ownerNoneReason: 'repo-only artefact — the fork is built by us from the owner tree and deliberately differs from the owner bytes',
    refreshRecipe: 'src/engines/pico-emu/README.md',
    groups: [
      {
        id: 'fork-wasm',
        pair: true,
        note: 'the fork ships its own wasm (public/wasm/picoemu-fork.wasm.wasm) — deliberately NOT the owner bytes',
        files: [
          {
            name: 'picoemu-fork.wasm.wasm',
            role: 'wasm',
            pinned: 'public/wasm/picoemu-fork.wasm.wasm',
            copies: [],
            owner: null,
          },
        ],
      },
    ],
  },
  {
    id: 'avr8js',
    label: 'AVR (Uno / Mega / Nano / ATtiny85) — pure JS, npm-only',
    ownerRoot: null,
    ownerBuild: null,
    npmPackage: 'avr8js',
    ownerNoneReason: 'pure-JS npm package — the bytes are pinned by package-lock.json, there is no owner build',
    refreshRecipe: 'package.json (package-lock.json pins the bytes)',
    groups: [
      {
        id: 'npm-package',
        pair: false,
        note: 'no owner build (pure-JS npm package): integrity = package-lock',
        files: [
          {
            name: 'node_modules/avr8js/dist/esm/index.js',
            role: 'npm',
            pinned: 'node_modules/avr8js/dist/esm/index.js',
            copies: [],
            owner: null,
            optional: true,
          },
        ],
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────

const VERDICT_RANK = {
  MISSING: 100,          // repo side broken -> failure
  'MIRROR DRIFT': 90,    // repo side inconsistent -> failure
  'MISMATCHED PAIR': 60, // glue/wasm moved inconsistently -> dangerous
  DIFFERENT: 40,         // owner rebuilt -> information
  'NOT BUILT': 30,       // owner has no build output -> information
  SAME: 10,
  'OWNER ABSENT': 5,     // no owner folder on this machine (CI)
  'N/A (no owner)': 1,
}

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

function expandHome(p) {
  if (!p) return p
  if (p === '~') return os.homedir()
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2))
  return p
}

function md5(file) {
  try {
    const buf = fs.readFileSync(file)
    return crypto.createHash('md5').update(buf).digest('hex')
  } catch (e) {
    return null
  }
}

function short(hash) {
  return hash ? hash.slice(0, 8) : 'MISSING'
}

function colorVerdict(v) {
  switch (v) {
    case 'SAME': return `${C.green}${v}${C.reset}`
    case 'DIFFERENT': return `${C.yellow}${v}${C.reset}`
    case 'MISMATCHED PAIR': return `${C.magenta}${v}${C.reset}`
    case 'NOT BUILT': return `${C.yellow}${v}${C.reset}`
    case 'MISSING':
    case 'MIRROR DRIFT': return `${C.red}${v}${C.reset}`
    default: return `${C.dim}${v}${C.reset}`
  }
}

// ── run ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const verbose = argv.includes('--verbose')
const repoOnly = argv.includes('--repo-only')

function ownerBuildAbsOf(engine) {
  if (!engine.ownerRoot || !engine.ownerBuild) return null
  return path.join(expandHome(engine.ownerRoot), engine.ownerBuild)
}

const rows = []          // one per file
const engineResults = []
let repoBroken = false

for (const engine of ENGINES) {
  const ownerRootAbs = engine.ownerRoot ? expandHome(engine.ownerRoot) : null
  const ownerBuildAbs = ownerBuildAbsOf(engine)
  const ownerRootPresent = ownerRootAbs ? fs.existsSync(ownerRootAbs) : false
  const ownerBuildPresent = ownerBuildAbs ? fs.existsSync(ownerBuildAbs) : false

  // Reason the owner side cannot be compared (if any).
  let ownerState = 'present'
  if (!engine.ownerRoot) ownerState = 'npm-only'
  else if (!ownerRootPresent) ownerState = 'absent'
  else if (!ownerBuildPresent) ownerState = 'not-built'
  if (repoOnly) ownerState = 'skipped'

  const groupVerdicts = []

  for (const group of engine.groups) {
    const fileStates = []

    for (const file of group.files) {
      const pinnedAbs = path.resolve(REPO_ROOT, file.pinned)
      const pinnedMd5 = md5(pinnedAbs)
      const copyAbs = (file.copies || []).map((c) => path.resolve(REPO_ROOT, c))
      const copyMd5 = copyAbs.map((c) => md5(c))

      const ownerAbs = ownerBuildAbs && file.owner ? path.join(ownerBuildAbs, file.owner) : null
      const ownerMd5 = ownerAbs ? md5(ownerAbs) : null

      let verdict
      let note = ''

      // 1. repo side first — it is the only side that can fail the run.
      if (!pinnedMd5) {
        if (file.optional) {
          verdict = 'N/A (no owner)'
          note = 'not installed on this machine (npm install not run)'
        } else {
          verdict = 'MISSING'
          note = 'repo-pinned file missing/unreadable'
          repoBroken = true
        }
      } else {
        const missingCopy = copyAbs.find((_, i) => !copyMd5[i])
        const driftedCopy = copyAbs.find((_, i) => copyMd5[i] && copyMd5[i] !== pinnedMd5)
        if (missingCopy) {
          verdict = 'MISSING'
          note = `repo copy missing/unreadable: ${path.relative(REPO_ROOT, missingCopy)}`
          repoBroken = true
        } else if (driftedCopy) {
          verdict = 'MIRROR DRIFT'
          note = `repo copy != pinned primary: ${path.relative(REPO_ROOT, driftedCopy)} (${short(copyMd5[copyAbs.indexOf(driftedCopy)])} vs ${short(pinnedMd5)}) — the deploy would load different bytes`
          repoBroken = true
        } else if (ownerState === 'skipped') {
          verdict = 'SAME (repo-only)'
          note = 'owner comparison skipped (--repo-only)'
        } else if (ownerState === 'npm-only') {
          verdict = 'N/A (no owner)'
          note = engine.ownerNoneReason || 'no owner build to compare'
        } else if (ownerState === 'absent') {
          verdict = 'OWNER ABSENT'
          note = 'owner folder not present (CI)'
        } else if (ownerState === 'not-built') {
          verdict = 'NOT BUILT'
          note = `owner folder present, no build output at ${engine.ownerBuild}/`
        } else if (!file.owner) {
          verdict = 'N/A (no owner)'
          note = 'repo-only artefact (no owner counterpart)'
        } else if (!ownerMd5) {
          verdict = 'NOT BUILT'
          note = 'owner build output incomplete (file missing)'
        } else if (ownerMd5 === pinnedMd5) {
          verdict = 'SAME'
        } else {
          verdict = 'DIFFERENT'
        }
      }

      fileStates.push({ file, verdict, note, pinnedMd5, copyMd5, ownerMd5 })
      rows.push({
        engine: engine.id,
        file: file.name,
        role: file.role || '',
        pinned: file.pinned,
        pinnedMd5,
        copies: file.copies || [],
        copyMd5,
        owner: ownerAbs,
        ownerMd5,
        verdict,
        note,
      })
    }

    // group verdict
    let gv
    const states = fileStates.map((f) => f.verdict)
    const changed = fileStates.filter((f) => f.verdict === 'DIFFERENT')
    const same = fileStates.filter((f) => f.verdict === 'SAME' || f.verdict === 'SAME (repo-only)')
    const missing = fileStates.filter((f) => f.verdict === 'MISSING' || f.verdict === 'MIRROR DRIFT')
    const notBuilt = fileStates.filter((f) => f.verdict === 'NOT BUILT')
    const absent = fileStates.filter((f) => f.verdict === 'OWNER ABSENT')
    const npmOnly = fileStates.filter((f) => f.verdict === 'N/A (no owner)')

    if (missing.length) gv = missing[0].verdict
    else if (notBuilt.length) gv = 'NOT BUILT'
    else if (absent.length) gv = 'OWNER ABSENT'
    else if (npmOnly.length) gv = 'N/A (no owner)'
    else if (group.pair && changed.length && same.length) {
      gv = 'MISMATCHED PAIR'
      const moved = changed.map((f) => f.file.role).join('+')
      const still = same.map((f) => f.file.role).join('+')
      fileStates.forEach((f) => {
        if (!f.note) f.note = `pair moved inconsistently: ${moved} moved, ${still} unchanged`
      })
    } else if (changed.length) gv = 'DIFFERENT'
    else if (same.length === fileStates.length) gv = repoOnly ? 'SAME (repo-only)' : 'SAME'
    else gv = states[0] || 'SAME'

    groupVerdicts.push({ id: group.id, pair: !!group.pair, verdict: gv, files: fileStates })
  }

  // extra owner files (files that live outside the owner build dir)
  for (const extra of engine.extraOwnerFiles || []) {
    const pinnedAbs = path.resolve(REPO_ROOT, extra.pinned)
    const pinnedMd5 = md5(pinnedAbs)
    const ownerAbs = ownerRootAbs ? path.join(ownerRootAbs, extra.ownerRootRelative) : null
    const ownerMd5 = ownerAbs ? md5(ownerAbs) : null
    let verdict
    let note = ''
    if (!pinnedMd5) {
      verdict = 'MISSING'; note = 'repo-pinned file missing/unreadable'; repoBroken = true
    } else if (!engine.ownerRoot) {
      verdict = 'N/A (no owner)'; note = 'no owner folder'
    } else if (repoOnly) {
      verdict = 'SAME (repo-only)'; note = 'owner comparison skipped (--repo-only)'
    } else if (!ownerRootPresent) {
      verdict = 'OWNER ABSENT'; note = 'owner folder not present (CI)'
    } else if (!ownerMd5) {
      verdict = 'NOT BUILT'; note = 'owner file missing'
    } else if (ownerMd5 === pinnedMd5) {
      verdict = 'SAME'
    } else {
      verdict = 'DIFFERENT'
    }
    rows.push({
      engine: engine.id, file: extra.name, role: extra.role || '',
      pinned: extra.pinned, pinnedMd5, copies: [], copyMd5: [],
      owner: ownerAbs, ownerMd5, verdict, note,
    })
  }

  const engineVerdict = groupVerdicts.length
    ? groupVerdicts.slice().sort((a, b) => (VERDICT_RANK[b.verdict] || 0) - (VERDICT_RANK[a.verdict] || 0))[0].verdict
    : 'OWNER ABSENT'

  engineResults.push({
    id: engine.id,
    label: engine.label,
    ownerRoot: engine.ownerRoot ? expandHome(engine.ownerRoot) : null,
    ownerBuild: engine.ownerBuild,
    ownerState,
    verdict: engineVerdict,
    refreshRecipe: engine.refreshRecipe || null,
    groups: groupVerdicts,
  })
}

// ── output ───────────────────────────────────────────────────────────────────
if (asJson) {
  console.log(JSON.stringify({
    repoBroken,
    engines: engineResults,
    rows,
  }, null, 2))
} else {
  const W = 118
  console.log('')
  console.log(`${C.bold}ENGINE BYTE INTEGRITY — repo-pinned bytes vs the owner folder RIGHT NOW${C.reset}`)
  console.log(`${C.dim}read-only; never writes/copies anything. The repo-pinned snapshot is what dev, build,}`)
  console.log(`deploy and the /vendor runtime fallback load. The owner folders are MOVING TARGETS.${C.reset}`)
  console.log('')
  console.log(`${C.dim}${'engine'.padEnd(22)} ${'pinned file'.padEnd(44)} ${'pinned md5'.padEnd(10)} ${'owner md5'.padEnd(10)} verdict${C.reset}`)
  console.log(`${C.dim}${'-'.repeat(W)}${C.reset}`)
  for (const r of rows) {
    const pinned = r.pinned.length > 42 ? '…' + r.pinned.slice(-41) : r.pinned
    const owner = r.ownerMd5
      ? short(r.ownerMd5)
      : (r.verdict === 'OWNER ABSENT' ? '(no owner)'
        : r.verdict === 'N/A (no owner)' ? '(n/a)'
        : r.verdict === 'SAME (repo-only)' ? '(skipped)'
        : 'MISSING')
    const showNote = verbose || (r.note && r.verdict !== 'SAME' && r.verdict !== 'DIFFERENT')
    console.log(
      `${r.engine.padEnd(22)} ${pinned.padEnd(44)} ${short(r.pinnedMd5).padEnd(10)} ${String(owner).padEnd(10)} ${colorVerdict(r.verdict)}` +
      (showNote ? `  ${C.dim}${r.note}${C.reset}` : ''),
    )
  }
  console.log('')
  console.log(`${C.bold}ENGINE VERDICTS${C.reset}`)
  console.log(`${C.dim}${'engine'.padEnd(22)} ${'owner folder'.padEnd(46)} ${'verdict'.padEnd(18)} detail${C.reset}`)
  console.log(`${C.dim}${'-'.repeat(W)}${C.reset}`)
  for (const e of engineResults) {
    const detail = e.groups.map((g) => {
      const note = g.files.map((f) => f.note).filter(Boolean)[0]
      return `${g.id}=${g.verdict}${note ? ` (${note})` : ''}`
    }).join('; ')
    console.log(`${e.id.padEnd(22)} ${String(e.ownerRoot || '(no owner folder)').padEnd(46)} ${colorVerdict(e.verdict).padEnd(18 + C.reset.length + C.bold.length)} ${C.dim}${detail}${C.reset}`)
  }
  console.log('')
  console.log(`${C.bold}REPO SIDE${C.reset}`)
  const pinnedCount = rows.length
  const missingCount = rows.filter((r) => r.verdict === 'MISSING' || r.verdict === 'MIRROR DRIFT').length
  if (missingCount === 0) {
    console.log(`  ${C.green}OK${C.reset} — ${pinnedCount} pinned files present, every repo copy matches its pinned primary.`)
  } else {
    console.log(`  ${C.red}BROKEN${C.reset} — ${missingCount} of ${pinnedCount} pinned files are missing or drifted:`)
    for (const r of rows.filter((x) => x.verdict === 'MISSING' || x.verdict === 'MIRROR DRIFT')) {
      console.log(`    - ${r.engine}: ${r.pinned} (${r.note})`)
    }
  }
  console.log('')
  console.log(`${C.dim}An owner folder that says DIFFERENT / MISMATCHED PAIR / NOT BUILT is INFORMATION,`)
  console.log(`not a failure — the owner rebuilds continuously. Only a broken REPO side fails the run.${C.reset}`)
  console.log('')
}

process.exit(repoBroken ? 1 : 0)
