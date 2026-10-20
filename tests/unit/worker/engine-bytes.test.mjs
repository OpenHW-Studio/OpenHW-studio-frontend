import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const script = path.join(repoRoot, 'scripts/check-engine-bytes.mjs');

// WebCrypto, not node:crypto: the vite alias maps node:crypto to the
// browser stub (it throws by design) and this test runs under vitest with
// that alias active.
async function sha256(buf) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
  return Buffer.from(digest).toString('hex');
}

async function treeHash(dir) {
  const lines = [];
  const walk = async (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        lines.push(`D ${path.relative(dir, p)}`);
        await walk(p);
      } else if (e.isFile()) {
        lines.push(`F ${path.relative(dir, p)} ${await sha256(fs.readFileSync(p))}`);
      }
    }
  };
  await walk(dir);
  return sha256(Buffer.from(lines.join('\n')));
}

function runCheck(env = {}) {
  const out = execFileSync(process.execPath, [script, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return JSON.parse(out);
}

// The repo side is the ONLY side that may fail the run: a missing pinned
// file or a drifted repo copy is a deploy hazard. Everything about the
// owner folders is information — the owners rebuild continuously.
describe('engine byte integrity (check:engine-bytes)', () => {
  test('the repo side is intact: every pinned file exists and every copy matches', () => {
    const res = runCheck();
    assert.equal(res.repoBroken, false, `repo side broken: ${JSON.stringify(res.rows.filter((r) => r.verdict === 'MISSING' || r.verdict === 'MIRROR DRIFT'), null, 2)}`);
    const broken = res.rows.filter((r) => r.verdict === 'MISSING' || r.verdict === 'MIRROR DRIFT');
    assert.equal(broken.length, 0, `broken repo rows: ${broken.map((r) => r.pinned).join(', ')}`);
    for (const row of res.rows) {
      if (row.pinnedMd5 === null) {
        // Only the optional pure-JS npm engine may be absent (npm not run).
        assert.ok(row.pinned.includes('node_modules'), `pinned file missing: ${row.pinned}`);
        continue;
      }
      for (const copy of row.copyMd5) {
        assert.equal(copy, row.pinnedMd5, `repo copy drifted from ${row.pinned}`);
      }
    }
  });

  test('every engine is listed (a new engine must be one line of data)', () => {
    const res = runCheck();
    const ids = res.engines.map((e) => e.id);
    for (const expected of [
      'stm32f1-emu', 'pico-emu', 'esp32-emu', 'stm32f4-emu',
      'nrf52833-periph-wasm', '8086emu', 'avr8js',
    ]) {
      assert.ok(ids.includes(expected), `engine not listed: ${expected}`);
    }
  });

  test('CI degradation: an absent owner folder is reported, never a failure', () => {
    // Point HOME at an empty dir so the `~/Documents/...` owner checkouts
    // (microbit-v2, 8086) do not exist — exactly the CI situation.
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-bytes-ci-'));
    try {
      const res = runCheck({ HOME: fakeHome, USERPROFILE: fakeHome });
      assert.equal(res.repoBroken, false);
      const absent = res.engines.filter((e) => e.verdict === 'OWNER ABSENT');
      assert.ok(absent.length >= 2, `expected the ~-based owners to be absent, got ${JSON.stringify(absent.map((e) => e.id))}`);
      const rows = res.rows.filter((r) => r.verdict === 'OWNER ABSENT');
      assert.ok(rows.length >= 2);
      for (const r of rows) assert.match(r.note, /owner folder not present \(CI\)/);
    } finally {
      fs.rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  test('the check is READ ONLY: the repo tree is byte-identical after a run', async () => {
    const watched = ['src/engines', 'public/vendor', 'public/wasm', 'public/firmware'];
    const before = [];
    for (const d of watched) before.push(await treeHash(path.join(repoRoot, d)));
    execFileSync(process.execPath, [script], { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' });
    const after = [];
    for (const d of watched) after.push(await treeHash(path.join(repoRoot, d)));
    assert.deepEqual(after, before, 'the byte check modified the repo');
  });
});
