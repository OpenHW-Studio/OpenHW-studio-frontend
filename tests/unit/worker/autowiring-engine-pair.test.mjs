import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '../../..');

const BUNDLE_DIR = path.join(frontendRoot, 'src/wasm/autowiring');
const WASM = path.join(BUNDLE_DIR, 'openhw_studio_autowiring_engine_bg.wasm');
const GLUE = path.join(BUNDLE_DIR, 'openhw_studio_autowiring_engine.js');
const BUILD_INFO = path.join(BUNDLE_DIR, 'BUILD_INFO.json');

// The crate lives OUTSIDE this repo (owner folder, see AGENTS.md). The
// checks below that need it are skipped unless the crate carries the
// generated pin table (i.e. the patched crate), so the frontend CI stays
// green on its own — but as soon as the crate is patched, both gates are
// live: the bundle must be the crate's current build, and the generated
// table must match the manifests.
const CRATE = path.resolve(
  process.env.AUTOWIRING_CRATE || path.join(frontendRoot, '../openhw-studio-autowiring'),
);
const CRATE_PKG = path.join(CRATE, 'pkg');
const CRATE_GENERATED = path.join(CRATE, 'src/pins_generated.rs');
const EMU_COMPONENTS = path.join(frontendRoot, '../openhw-studio-emulator/src/components');

const cratePresent = fs.existsSync(CRATE);
const cratePatched = cratePresent && fs.existsSync(CRATE_GENERATED);

// WebCrypto, not node:crypto: the vite alias maps node:crypto to the
// browser stub (it throws by design), and this test runs under vitest
// with that alias active.
async function sha256(file) {
  const buf = fs.readFileSync(file);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
  return Buffer.from(digest).toString('hex');
}

describe('autowiring engine bundle integrity (openhw-studio-autowiring-engine)', () => {
  test('the bundle carries the engine artifacts', () => {
    assert.ok(fs.existsSync(WASM), 'bundled wasm missing');
    assert.ok(fs.existsSync(GLUE), 'bundled glue missing');
    assert.ok(fs.existsSync(BUILD_INFO), 'BUILD_INFO.json missing');
  });

  test('the bundled wasm matches the recorded build checksum', async () => {
    const info = JSON.parse(fs.readFileSync(BUILD_INFO, 'utf8'));
    assert.equal(await sha256(WASM), info.wasm_sha256, 'bundled wasm drifted from BUILD_INFO.json');
    assert.equal(await sha256(GLUE), info.glue_sha256, 'bundled glue drifted from BUILD_INFO.json');
    assert.match(info.wasm_md5, /^[0-9a-f]{32}$/);
    assert.match(info.wasm_sha256, /^[0-9a-f]{64}$/);
    assert.ok(info.rustc, 'BUILD_INFO.json must record the rustc version');
  });

  test('the glue exposes the exports the autowiring worker wires', () => {
    const glue = fs.readFileSync(GLUE, 'utf8');
    const exported = new Set();
    for (const m of glue.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_]+)/gm)) {
      exported.add(m[1]);
    }
    for (const m of glue.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) exported.add(name);
      }
    }
    // src/workers/autowiring.worker.ts imports exactly these.
    for (const name of [
      'default',
      'reset',
      'ingestComponent',
      'generateAutonomousSetup',
      'generateCodeForComponent',
    ]) {
      assert.ok(exported.has(name), `glue is missing export ${name} (mismatched pair?)`);
    }
  });

  test.skipIf(!cratePatched)(
    'the bundled wasm is the crate build (rebuilt-but-not-synced guard)',
    async () => {
      const crateWasm = path.join(CRATE_PKG, 'openhw_studio_autowiring_engine_bg.wasm');
      const crateGlue = path.join(CRATE_PKG, 'openhw_studio_autowiring_engine.js');
      assert.ok(fs.existsSync(crateWasm), `crate pkg wasm missing: ${crateWasm}`);
      assert.ok(fs.existsSync(crateGlue), `crate pkg glue missing: ${crateGlue}`);
      assert.equal(
        await sha256(WASM),
        await sha256(crateWasm),
        'the crate was rebuilt but the frontend bundle was not synced — run `node scripts/sync-autowiring-wasm.mjs`',
      );
      assert.equal(await sha256(GLUE), await sha256(crateGlue), 'glue/wasm pair drifted from the crate build');
    },
  );

  test.skipIf(!cratePatched)(
    'the generated Rust pin table is fresh against the emulator manifests',
    () => {
      const res = spawnSync(
        process.execPath,
        [
          path.join(frontendRoot, 'scripts/gen-autowiring-pins.mjs'),
          '--check',
          '--crate',
          CRATE,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(
        res.status,
        0,
        `generated pin table is stale — run \`node scripts/gen-autowiring-pins.mjs\`\n${res.stdout || ''}${res.stderr || ''}`,
      );
    },
  );

  test.skipIf(!fs.existsSync(EMU_COMPONENTS))(
    'every board manifest is covered by the engine family rules',
    () => {
      const res = spawnSync(
        process.execPath,
        [
          path.join(frontendRoot, 'scripts/gen-autowiring-pins.mjs'),
          '--report',
          '--crate',
          CRATE,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(res.status, 0, `generator failed:\n${res.stderr || ''}`);

      // Read the board list straight from the manifests and make sure the
      // generator classified every single one.
      const boards = [];
      for (const dir of fs.readdirSync(EMU_COMPONENTS)) {
        const mp = path.join(EMU_COMPONENTS, dir, 'manifest.json');
        if (!fs.existsSync(mp)) continue;
        const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
        if (!m.type) continue;
        if (m.board === true || /board/i.test(m.group || '')) boards.push(m.type);
      }
      assert.ok(boards.length >= 30, `expected 30+ board manifests, found ${boards.length}`);
      const report = res.stdout || '';
      for (const kind of boards) {
        assert.ok(report.includes(kind), `board manifest ${kind} is not covered by the engine`);
      }
    },
  );
});
