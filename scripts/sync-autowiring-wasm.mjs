#!/usr/bin/env node
// sync-autowiring-wasm.mjs — build the OpenHW autowiring engine (Rust →
// wasm) and sync it into the frontend bundle, with a recorded checksum.
//
// WHY: the frontend bundles a COPY of the crate's wasm output. That copy
// used to be synced BY HAND, so "the crate was rebuilt but the bundle was
// not" could (and did) ship silently. This script makes the flow
// reproducible and checkable:
//
//   node scripts/sync-autowiring-wasm.mjs            # build + copy + record
//   node scripts/sync-autowiring-wasm.mjs --no-build # copy an existing pkg
//   node scripts/sync-autowiring-wasm.mjs --check    # CI gate: bundle == pkg
//
// The crate lives outside this repo (see AGENTS.md: the engines are owner
// folders). Override the location with --crate <path> or the
// AUTOWIRING_CRATE environment variable.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(__dirname, '..');
const BUNDLE_DIR = path.join(FRONTEND, 'src/wasm/autowiring');

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const NO_BUILD = argv.includes('--no-build');
const crateArg = argv.indexOf('--crate');
const CRATE = path.resolve(
  crateArg >= 0 && argv[crateArg + 1]
    ? argv[crateArg + 1]
    : process.env.AUTOWIRING_CRATE || path.resolve(FRONTEND, '../openhw-studio-autowiring'),
);
// Where the artifact BELONGS. Defaults to the crate we built from; use
// --record-crate when building from a scratch copy but shipping the
// canonical crate's bundle.
const recordArg = argv.indexOf('--record-crate');
const RECORD_CRATE = path.resolve(
  recordArg >= 0 && argv[recordArg + 1] ? argv[recordArg + 1] : CRATE,
);

const PKG_DIR = path.join(CRATE, 'pkg');
const BUILD_INFO = path.join(BUNDLE_DIR, 'BUILD_INFO.json');

// The files wasm-pack emits that the frontend actually bundles.
const BUNDLED = [
  'openhw_studio_autowiring_engine.js',
  'openhw_studio_autowiring_engine_bg.wasm',
  'openhw_studio_autowiring_engine.d.ts',
  'openhw_studio_autowiring_engine_bg.wasm.d.ts',
  'package.json',
  'LICENSE_APACHE',
  'LICENSE_MIT',
];

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: CRATE, ...opts });
  if (res.status !== 0) {
    console.error(`\n${cmd} ${args.join(' ')} failed (exit ${res.status})`);
    process.exit(res.status || 1);
  }
}

function toolVersion(cmd, args) {
  try {
    const res = spawnSync(cmd, args, { encoding: 'utf8' });
    return (res.stdout || res.stderr || '').trim().split('\n')[0];
  } catch {
    return 'unknown';
  }
}

if (!fs.existsSync(CRATE)) {
  console.error(`autowiring crate not found: ${CRATE}`);
  console.error('Pass --crate <path> or set AUTOWIRING_CRATE.');
  process.exit(1);
}

if (!NO_BUILD) {
  console.log(`Building ${CRATE} (wasm-pack build --target web --release)…`);
  // CARGO_TARGET_DIR keeps the build cache out of the (large) crate tree;
  // CARGO_NET_OFFLINE lets a vendored registry build without network.
  run('wasm-pack', ['build', '--target', 'web', '--release'], {
    env: {
      ...process.env,
      CARGO_NET_OFFLINE: process.env.CARGO_NET_OFFLINE || 'true',
      CARGO_TARGET_DIR: process.env.CARGO_TARGET_DIR || '/tmp/autowire-target',
    },
  });
}

if (!fs.existsSync(PKG_DIR)) {
  console.error(`crate pkg output missing: ${PKG_DIR} (run without --no-build)`);
  process.exit(1);
}

// ── Check mode: the bundle must be byte-identical to the crate build ─────
if (CHECK) {
  const problems = [];
  for (const name of BUNDLED) {
    const src = path.join(PKG_DIR, name);
    const dst = path.join(BUNDLE_DIR, name);
    if (!fs.existsSync(src)) {
      problems.push(`crate pkg is missing ${name}`);
      continue;
    }
    if (!fs.existsSync(dst)) {
      problems.push(`bundle is missing ${name}`);
      continue;
    }
    if (md5(src) !== md5(dst)) {
      problems.push(`${name} drifted: crate ${md5(src)} != bundle ${md5(dst)}`);
    }
  }
  if (fs.existsSync(BUILD_INFO)) {
    const info = JSON.parse(fs.readFileSync(BUILD_INFO, 'utf8'));
    const wasm = path.join(BUNDLE_DIR, 'openhw_studio_autowiring_engine_bg.wasm');
    if (fs.existsSync(wasm) && info.wasm_md5 && md5(wasm) !== info.wasm_md5) {
      problems.push(`bundle wasm does not match BUILD_INFO.json (${md5(wasm)} != ${info.wasm_md5})`);
    }
  } else {
    problems.push('BUILD_INFO.json missing from the bundle');
  }
  if (problems.length) {
    console.error('autowiring wasm bundle is STALE:');
    for (const p of problems) console.error(`  - ${p}`);
    console.error('Fix: node scripts/sync-autowiring-wasm.mjs');
    process.exit(1);
  }
  console.log('autowiring wasm bundle matches the crate build.');
  process.exit(0);
}

// ── Sync mode: copy the crate build into the bundle ───────────────────────
fs.mkdirSync(BUNDLE_DIR, { recursive: true });
const copied = [];
for (const name of BUNDLED) {
  const src = path.join(PKG_DIR, name);
  if (!fs.existsSync(src)) {
    console.error(`crate pkg is missing ${name}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(BUNDLE_DIR, name));
  copied.push(name);
}

const wasmMd5 = md5(path.join(BUNDLE_DIR, 'openhw_studio_autowiring_engine_bg.wasm'));
const glueMd5 = md5(path.join(BUNDLE_DIR, 'openhw_studio_autowiring_engine.js'));
const wasmSha = sha256(path.join(BUNDLE_DIR, 'openhw_studio_autowiring_engine_bg.wasm'));
const glueSha = sha256(path.join(BUNDLE_DIR, 'openhw_studio_autowiring_engine.js'));

const prev = fs.existsSync(BUILD_INFO) ? JSON.parse(fs.readFileSync(BUILD_INFO, 'utf8')) : null;
const relCrate = path.relative(FRONTEND, RECORD_CRATE) || RECORD_CRATE;
const info = {
  crate: path.basename(RECORD_CRATE),
  crate_path: relCrate,
  package: 'openhw-studio-autowiring-engine',
  wasm_md5: wasmMd5,
  glue_md5: glueMd5,
  wasm_sha256: wasmSha,
  glue_sha256: glueSha,
  rustc: toolVersion('rustc', ['--version']),
  wasm_bindgen_cli: toolVersion('wasm-bindgen', ['--version']),
  wasm_opt: toolVersion('wasm-opt', ['--version']),
  generator: 'scripts/sync-autowiring-wasm.mjs',
};
// Only rewrite the record when the artifact actually changed, so a
// no-op sync does not churn the tree.
if (
  !prev ||
  prev.wasm_md5 !== info.wasm_md5 ||
  prev.glue_md5 !== info.glue_md5 ||
  prev.wasm_sha256 !== info.wasm_sha256 ||
  prev.crate_path !== info.crate_path ||
  prev.rustc !== info.rustc
) {
  fs.writeFileSync(BUILD_INFO, JSON.stringify(info, null, 2) + '\n');
}

console.log(`Synced ${copied.length} file(s) → ${path.relative(FRONTEND, BUNDLE_DIR)}`);
console.log(`  wasm  md5 ${wasmMd5}`);
console.log(`  glue  md5 ${glueMd5}`);
