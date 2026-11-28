import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { buildConformanceMatrix } from '../../../src/worker/conformance-matrix.ts';

const BOARDS = [
  'openhw-arduino-uno',
  'openhw-pico',
  'openhw-esp32',
  'openhw-stm32-bluepill',
  'openhw-8085',
  'openhw-8051',
  'openhw-rv32',
];
const COMPONENTS = [
  'openhw-led',
  'openhw-pushbutton',
  'openhw-ssd1306-oled',
  'openhw-mfrc522',
  'openhw-ds18b20',
  'openhw-servo',
];

function cell(cells, boardType, componentType) {
  const found = cells.find((c) => c.boardType === boardType && c.componentType === componentType);
  assert.ok(found, `missing cell ${boardType}::${componentType}`);
  return found;
}

describe('generated conformance matrix (plan §5.6/§8)', () => {
  test('every cell is explicit; known pairs match verified behavior', () => {
    const cells = buildConformanceMatrix(BOARDS, COMPONENTS);
    assert.equal(cells.length, BOARDS.length * COMPONENTS.length);
    for (const c of cells) {
      assert.ok(['supported', 'unsupported', 'untested'].includes(c.status), c);
      assert.ok(c.reason && c.reason.length > 0, c);
      assert.ok(c.family && c.family.length > 0, c);
      assert.ok(Array.isArray(c.needs), c);
    }

    // Verified live: LED lights on Uno and 8085 (with resistor).
    assert.equal(cell(cells, 'openhw-arduino-uno', 'openhw-led').status, 'supported');
    assert.equal(cell(cells, 'openhw-8085', 'openhw-led').status, 'supported');
    // Verified engine limits: no output readback (ESP32), quasi sink-only
    // (8051), no GPIO model (rv32) — LED sourcing is unsupported with reason.
    const esp = cell(cells, 'openhw-esp32', 'openhw-led');
    assert.equal(esp.status, 'unsupported');
    assert.ok(esp.reason.includes('no-gpio-output-readback'), esp.reason);
    const s51 = cell(cells, 'openhw-8051', 'openhw-led');
    assert.equal(s51.status, 'unsupported');
    assert.ok(s51.reason.includes('quasi-bidirectional-ports'), s51.reason);
    const rv = cell(cells, 'openhw-rv32', 'openhw-led');
    assert.equal(rv.status, 'unsupported');
    assert.ok(rv.reason.includes('no-gpio-model'), rv.reason);
    // I2C OLED needs an i2c-target board.
    assert.equal(cell(cells, 'openhw-arduino-uno', 'openhw-ssd1306-oled').status, 'supported');
    assert.equal(cell(cells, 'openhw-8085', 'openhw-ssd1306-oled').status, 'unsupported');
    // Overrides can mark bench-verified-but-undeclared combinations.
    const withOverride = buildConformanceMatrix(['openhw-arduino-uno'], ['openhw-led'], {
      'openhw-arduino-uno::openhw-led': { status: 'untested', reason: 'bench pending' },
    });
    assert.equal(withOverride[0].status, 'untested');
  });
});
