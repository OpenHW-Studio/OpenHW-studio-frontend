import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TELEMETRY_SCHEMA_VERSION } from '../../../src/worker/registries/component-registry.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '../../..');
const emulatorRoot = '/home/danish1075/Documents/simulator/openhw-studio-emulator/src';

function walkJsTs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsTs(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function importTargets(source) {
  const targets = [];
  const re = /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) targets.push(m[1]);
  return targets;
}

describe('architecture boundaries (plan §5, Phase 4 seed)', () => {
  test('emulator components never import worker runners or registries', () => {
    const dirs = [
      path.join(emulatorRoot, 'components'),
      path.join(emulatorRoot, 'protocol-handlers'),
    ];
    const bad = [];
    for (const dir of dirs) {
      for (const file of walkJsTs(dir)) {
        const src = fs.readFileSync(file, 'utf8');
        for (const target of importTargets(src)) {
          if (/worker\/runners|simulation\.worker|board\.worker|registries\/component-registry/.test(target)) {
            bad.push(`${path.relative(emulatorRoot, file)} -> ${target}`);
          }
        }
      }
    }
    assert.deepEqual(bad, []);
  });

  test('runners never import specific component logic (registry is the bridge)', () => {
    const dir = path.join(frontendRoot, 'src/worker/runners');
    const bad = [];
    for (const file of walkJsTs(dir)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const target of importTargets(src)) {
        // Allowed: emulator root (BaseComponent), the registry bridge,
        // sab/layout, debug, sibling runners, engines.
        if (/emulator\/src\/components\/.+\/(logic|glue|index)$/.test(target)) {
          bad.push(`${path.relative(frontendRoot, file)} -> ${target}`);
        }
      }
    }
    assert.deepEqual(bad, []);
  });

  test('telemetry schema version is declared and stable', () => {
    assert.equal(TELEMETRY_SCHEMA_VERSION, 1);
  });
});
