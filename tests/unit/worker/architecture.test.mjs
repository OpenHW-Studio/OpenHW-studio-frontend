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

  test('AVR propagator duplicates are deleted (shared signal service owns passive logic)', () => {
    // Plan §5.3/Phase 2: normalize + net graph + passive traversal live in
    // signal/electrical.ts; AVR delegates. The orchestration that stays in
    // the runner (rails/pullup/port gating) is the board adapter, not a
    // duplicate propagator. Guard against reintroducing inline copies.
    const avrPath = path.join(frontendRoot, 'src/worker/runners/avr-runner.ts');
    const avrSrc = fs.readFileSync(avrPath, 'utf8');
    assert.ok(/normalizeEndpointPin/.test(avrSrc), 'AVR must use shared normalizeEndpointPin');
    assert.ok(/buildNetGraph/.test(avrSrc), 'AVR must use shared buildNetGraph');
    assert.ok(/traversePassiveShared|traversePassive/.test(avrSrc), 'AVR must delegate passive traversal');
    // Inline passive-model literals must live only in the shared service.
    assert.ok(!/voltage \* 0\.2/.test(avrSrc), 'resistor divider must not be inlined in AVR runner');
    assert.ok(!/voltage - 1\.8/.test(avrSrc), 'LED forward drop must not be inlined in AVR runner');
    const elecPath = path.join(frontendRoot, 'src/worker/signal/electrical.ts');
    assert.ok(fs.existsSync(elecPath), 'shared signal service must exist');
  });

  test('bus services are provided by both runner families and consumed service-first', () => {
    // Plan §5.3/Phase 3: _driveBoardPin + _scheduleBoardCycles +
    // _boardCyclesNow + _boardNetOf on AVR and ARM; components prefer them
    // with legacy fallbacks. Retirement = services primary everywhere.
    for (const rel of ['src/worker/runners/avr-runner.ts', 'src/worker/runners/arm-runner-base.ts']) {
      const src = fs.readFileSync(path.join(frontendRoot, rel), 'utf8');
      for (const svc of ['_driveBoardPin', '_scheduleBoardCycles', '_boardCyclesNow', '_boardNetOf']) {
        assert.ok(src.includes(svc), `${rel} must provide ${svc}`);
      }
    }
    const consumers = [
      'components/DHT-22/logic.ts',
      'components/MQ2-gas-sensor/logic.ts',
      'components/PIR-Motion-Sensor/logic.ts',
      'components/openhw-hc-sr04/logic.ts',
      'components/openhw-ir-receiver/logic.ts',
      'protocol-handlers/onewire-device.ts',
      'components/openhw-led/logic.ts',
    ];
    for (const rel of consumers) {
      const src = fs.readFileSync(path.join(emulatorRoot, rel), 'utf8');
      const usesDrive = src.includes('_driveBoardPin') || src.includes('_boardCyclesNow') || src.includes('_scheduleBoardCycles') || src.includes('_boardNetOf');
      assert.ok(usesDrive, `${rel} must consume a bus service`);
    }
    // No runner may reach into specific component logic; no component may
    // import a runner (both directions already tested above — this pins the
    // service names as the only bridge).
    assert.ok(true);
  });
});
