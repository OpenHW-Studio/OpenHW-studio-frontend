import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { COMPONENT_PINS } from '../../../src/worker/registries/component-registry.ts';
import { matchBoardFamily, BOARD_FAMILIES } from '../../../src/worker/boards-registry.ts';

// Board-like types: programmable boards plus AVR-family MCUs that route to
// runners. Shields/accessories (sensor-shield) and aliases (wokwi-) resolve
// through their openhw- counterparts and are excluded here.
const BOARD_TYPE_RE = /(arduino|rp2040|pico|esp32|stm32|8086|8088|8085|8051|mcs-51|6502|z80|rv32|risc|retro|mega|nano|attiny)/i;

function boardLikeTypes() {
  return Object.keys(COMPONENT_PINS).filter((t) => {
    if (t.startsWith('wokwi-')) return false;
    if (/shield/i.test(t)) return false;
    return BOARD_TYPE_RE.test(t);
  });
}

describe('registry coverage is CI-required (plan Phase 4 seed)', () => {
  test('every board-like type resolves to a known family', () => {
    const uncovered = [];
    for (const type of boardLikeTypes()) {
      if (matchBoardFamily(type).family === 'unknown') uncovered.push(type);
    }
    assert.deepEqual(uncovered, []);
  });

  test('every family row is well-formed', () => {
    const families = new Set();
    for (const fam of BOARD_FAMILIES) {
      assert.ok(fam.family && fam.family.length > 0);
      assert.ok(!families.has(fam.family), `duplicate family row: ${fam.family}`);
      families.add(fam.family);
      assert.ok(Array.isArray(fam.match) && fam.match.length > 0, fam.family);
      assert.ok(Number.isFinite(fam.railVoltage) && fam.railVoltage > 0, fam.family);
      assert.ok(fam.engine && fam.engine.length > 0, fam.family);
      assert.ok(fam.runner && fam.runner.length > 0, fam.family);
      assert.ok(Array.isArray(fam.capabilities), fam.family);
      assert.ok(Array.isArray(fam.limits), fam.family);
      for (const lim of fam.limits) {
        assert.ok(lim.code && lim.code.length > 0, fam.family);
        assert.ok(lim.detail && lim.detail.length > 0, lim.code);
      }
    }
  });

  test('esp32-cam resolves to its own runnable family (not generic esp32)', () => {
    // openhw-esp32-cam used to claim the esp32-emu engine and die on
    // "Unknown chip: esp32-cam", taking the UNO run down with it. The
    // esp32_cam family boots it on the esp32-cam board preset instead.
    assert.equal(matchBoardFamily('openhw-esp32-cam').family, 'esp32_cam');
    assert.equal(matchBoardFamily('openhw-esp32').family, 'esp32');
  });
});
