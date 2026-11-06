import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '../../..');

const BUNDLE = path.join(frontendRoot, 'src/wasm/autowiring');
const EMU_COMPONENTS = path.join(frontendRoot, '../openhw-studio-emulator/src/components');

const emuPresent = fs.existsSync(EMU_COMPONENTS);

async function loadEngine() {
  const mod = await import(path.join(BUNDLE, 'openhw_studio_autowiring_engine.js'));
  const bytes = fs.readFileSync(path.join(BUNDLE, 'openhw_studio_autowiring_engine_bg.wasm'));
  await (mod.default || mod)({ module_or_path: bytes });
  return mod;
}

// The component directory name does not always match the manifest type
// ("ESP32" vs "openhw-esp32"), so index the manifests by type.
let manifestIndex = null;
function manifestOf(kind) {
  if (!manifestIndex) {
    manifestIndex = new Map();
    for (const dir of fs.readdirSync(EMU_COMPONENTS)) {
      const mp = path.join(EMU_COMPONENTS, dir, 'manifest.json');
      if (!fs.existsSync(mp)) continue;
      try {
        const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
        if (m && m.type) manifestIndex.set(m.type, m);
      } catch {
        /* unreadable manifest */
      }
    }
  }
  const m = manifestIndex.get(kind);
  if (!m) throw new Error(`no manifest for type ${kind}`);
  return m;
}

function pinsOf(m) {
  return (m.pins || []).map((p) =>
    typeof p === 'string'
      ? { id: p, type: '', x: 0, y: 0, signals: null }
      : { id: p.id, type: p.type || '', x: p.x || 0, y: p.y || 0, signals: p.signals || null },
  );
}

/**
 * Drive the engine exactly like the frontend worker does: ingest the board
 * and the component, then ask for an autonomous setup.
 */
function wireUp(engine, boardKind, compKind) {
  engine.reset();
  const boardManifest = manifestOf(boardKind);
  const compManifest = manifestOf(compKind);
  engine.ingestComponent('board1', boardKind, 0, 0, 100, 100, pinsOf(boardManifest));
  engine.ingestComponent('comp1', compManifest.type, 200, 0, 40, 40, pinsOf(compManifest));
  const newComp = { id: 'comp1', type: compManifest.type, x: 200, y: 0, w: 40, h: 40, attrs: {} };
  const plan = engine.generateAutonomousSetup(newComp, compManifest, 'board1', [], false, false);
  return { plan, boardManifest };
}

describe.skipIf(!emuPresent)('autowiring engine wiring (bundled wasm)', () => {
  const cases = [
    ['openhw-arduino-uno', 'openhw-dht22'],
    ['openhw-arduino-mega', 'openhw-dht22'],
    ['openhw-arduino-nano', 'openhw-dht22'],
    ['openhw-pico', 'openhw-dht22'],
    ['openhw-pico-w', 'openhw-dht22'],
    ['openhw-pico-2', 'openhw-dht22'],
    ['openhw-esp32', 'openhw-dht22'],
    ['openhw-esp32-cam', 'openhw-dht22'],
    ['openhw-stm32-bluepill', 'openhw-dht22'],
    ['openhw-stm32f4', 'openhw-dht22'],
    ['openhw-stm32f407ve', 'openhw-dht22'],
    ['openhw-microbit-v2', 'openhw-dht22'],
    ['openhw-8086', 'openhw-dht22'],
    ['openhw-arduino-uno', 'openhw-mq2-gas-sensor'],
  ];

  test('every wire lands on a pin the board actually has', async () => {
    const engine = await loadEngine();
    for (const [boardKind, compKind] of cases) {
      const { plan, boardManifest } = wireUp(engine, boardKind, compKind);
      assert.notEqual(typeof plan, 'string', `${boardKind} + ${compKind}: ${plan}`);
      const boardPins = new Set(pinsOf(boardManifest).map((p) => p.id));
      const dangling = (plan.added_wires || [])
        .map((w) => String(w.to))
        .filter((to) => to.startsWith('board1:'))
        .map((to) => to.slice('board1:'.length))
        .filter((pin) => !boardPins.has(pin));
      assert.deepEqual(
        dangling,
        [],
        `${boardKind} + ${compKind}: engine wired pins the board does not have`,
      );
    }
  });

  test('the signal pin is wired on every board (no silent "CRITICAL" skip)', async () => {
    const engine = await loadEngine();
    for (const [boardKind, compKind] of cases) {
      const { plan } = wireUp(engine, boardKind, compKind);
      assert.notEqual(typeof plan, 'string', `${boardKind} + ${compKind}: ${plan}`);
      const critical = (plan.reasoning || []).filter((r) => String(r).startsWith('CRITICAL'));
      assert.deepEqual(
        critical,
        [],
        `${boardKind} + ${compKind}: engine reported a critical wiring failure`,
      );
      const signalWires = (plan.added_wires || []).filter((w) => String(w.from).startsWith('comp1:'));
      assert.ok(
        signalWires.length >= 2,
        `${boardKind} + ${compKind}: expected at least power + signal wires, got ${signalWires.length}`,
      );
    }
  });

  test('the Uno ground wire lands on a real ground pin', async () => {
    // Regression: the Uno manifest spells its grounds gnd_1..gnd_3 while
    // the engine used to wire "GND", which the board does not have.
    const engine = await loadEngine();
    const { plan, boardManifest } = wireUp(engine, 'openhw-arduino-uno', 'openhw-dht22');
    const boardPins = new Set(pinsOf(boardManifest).map((p) => p.id));
    const gndWire = (plan.added_wires || []).find((w) => String(w.from) === 'comp1:GND');
    assert.ok(gndWire, 'no ground wire was produced');
    const target = String(gndWire.to);
    if (target.startsWith('board1:')) {
      assert.ok(boardPins.has(target.slice('board1:'.length)), `dangling ground wire: ${target}`);
    }
  });
});
