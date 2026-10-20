import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { buildConformanceMatrix } from '../../../src/worker/conformance-matrix.ts';
import { BOARD_FAMILIES, matchBoardFamily } from '../../../src/worker/boards-registry.ts';
import { getComponentCapabilities } from '../../../src/worker/registries/component-registry.ts';

describe('micro:bit v2 board family (nRF52833)', () => {
  test('claims the capabilities the runner really implements', () => {
    const fam = matchBoardFamily('openhw-microbit-v2');
    assert.equal(fam.family, 'microbit_v2');
    assert.equal(fam.engine, 'nrf52833-periph-wasm');
    assert.equal(fam.runner, 'runners/microbit-runner.ts');
    for (const cap of ['digital-gpio', 'analog-adc', 'uart', 'i2c-target', 'spi-target']) {
      assert.ok(fam.capabilities.includes(cap), `missing capability ${cap}`);
    }
    // Fixed .bin images only (no backend nRF core, no compiler path).
    assert.deepEqual(fam.firmware, ['fixed-bin']);
  });

  test('the micro:bit family entry is unique', () => {
    const hits = BOARD_FAMILIES.filter((f) => f.family === 'microbit_v2');
    assert.equal(hits.length, 1);
  });

  test('an analog-in component is a supported cell (AIN0 -> SAADC)', () => {
    // openhw-ldr-module has an AO pin -> needs 'analog-in' -> 'analog-adc'.
    const needs = getComponentCapabilities('openhw-ldr-module');
    assert.ok(needs.includes('analog-in'), needs.join(','));
    const cells = buildConformanceMatrix(
      ['openhw-microbit-v2'],
      ['openhw-ldr-module', 'openhw-led', 'openhw-ssd1306-oled'],
    );
    const ldr = cells.find((c) => c.componentType === 'openhw-ldr-module');
    assert.equal(ldr.status, 'supported', ldr.reason);
    const led = cells.find((c) => c.componentType === 'openhw-led');
    assert.equal(led.status, 'supported', led.reason);
    const oled = cells.find((c) => c.componentType === 'openhw-ssd1306-oled');
    assert.equal(oled.status, 'supported', oled.reason);
  });

  test('the potentiometer cell still wants a pwm-in pin (vocabulary artifact)', () => {
    // The pot's SIG pin is classified 'pwm-in' by the shared vocabulary
    // (SIG is in the pwm-in pin list), so the generated cell needs the
    // board's 'pwm' capability. The ANALOG path itself is proven live
    // (tests/e2e/microbit-saadc.spec.js: pot -> AIN0 -> SAADC -> guest).
    const needs = getComponentCapabilities('openhw-potentiometer');
    assert.ok(needs.includes('pwm-in'), needs.join(','));
  });
});
