import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  matchBoardFamily,
  boardHasCapability,
  boardHasLimit,
} from '../../../src/worker/boards-registry.ts';
import { getComponentCapabilities } from '../../../src/worker/registries/component-registry.ts';
import {
  allocateStateSab,
  boardSerialOffsets,
  SAB_LAYOUT_VERSION,
  SabStateWriter,
  SabSerialRing,
} from '../../../src/worker/sab/layout.ts';
import {
  readRiver,
  readTelemetryRing,
  drainSerialRingCounted,
  createSabCursor,
} from '../../../src/pages/simulationpage/utils/sabReader.js';

describe('universal HAL registry and river accounting', () => {
  test('board families match specific-before-generic with honest limits', () => {
    assert.equal(matchBoardFamily('openhw-pico-2-w').family, 'pico_2_w');
    assert.equal(matchBoardFamily('openhw-pico-w').family, 'pico_w');
    assert.equal(matchBoardFamily('openhw-pico').family, 'rp2040');
    assert.equal(matchBoardFamily('openhw-esp32').family, 'esp32');
    assert.equal(matchBoardFamily('openhw-8085').family, 'retro_8085');
    assert.equal(matchBoardFamily('openhw-8051').family, 'retro_8051');
    assert.equal(matchBoardFamily('openhw-rv32').family, 'retro_rv32');

    // Output capability is intentionally narrower than input where engines
    // cannot read back driven outputs.
    assert.equal(boardHasCapability('openhw-esp32', 'uart'), true);
    assert.equal(boardHasCapability('openhw-esp32', 'digital-gpio'), false);
    assert.equal(boardHasLimit('openhw-esp32', 'no-gpio-output-readback'), true);
    assert.equal(boardHasCapability('openhw-8051', 'digital-gpio-sink'), true);
    assert.equal(boardHasCapability('openhw-8051', 'digital-gpio'), false);
    assert.equal(boardHasLimit('openhw-rv32', 'no-gpio-model'), true);
    assert.equal(boardHasLimit('openhw-z80', 'z80-output-latch'), true);
    assert.equal(matchBoardFamily('openhw-arduino-mega').family, 'arduino_mega');
    assert.equal(matchBoardFamily('custom-future-board').family, 'unknown');
  });

  test('component capabilities derive from manifest pins', () => {
    assert.deepEqual(
      getComponentCapabilities('openhw-led').sort(),
      ['digital-in', 'digital-out'],
    );
    assert.ok(getComponentCapabilities('openhw-ssd1306-oled').includes('i2c-target'));
    assert.ok(getComponentCapabilities('openhw-mfrc522').includes('spi-target'));
    assert.ok(getComponentCapabilities('openhw-ds18b20').includes('onewire'));
    assert.ok(getComponentCapabilities('openhw-servo').includes('pwm-in'));
    assert.deepEqual(getComponentCapabilities('openhw-image'), []);
  });

  test('river loss accounting never silently drops records', () => {
    const alloc = allocateStateSab(
      ['led1'],
      64,
      [{ boardId: 'b1', boardIdx: 0, pins: ['L0', 'L1'] }],
    );
    const writer = new SabStateWriter(alloc.buffer);
    for (let i = 0; i < 130; i += 1) {
      writer.pushTelemetry(0, 1, i, i + 1, i);
    }
    const tele = readTelemetryRing(alloc.buffer, 0, 10);
    assert.equal(tele.records.length, 10);
    assert.equal(tele.head, 130);
    assert.equal(tele.skipped, 120);

    const ring = new SabSerialRing(alloc.buffer, boardSerialOffsets(alloc, 0).tx);
    for (let b = 1; b <= 5; b += 1) ring.pushByte(b);
    const serial = drainSerialRingCounted(ring.buffer, boardSerialOffsets(alloc, 0).tx, 2);
    assert.deepEqual(serial.bytes, [1, 2]);
    assert.equal(serial.skipped, 3);

    const river = readRiver(alloc.buffer, {
      boardPinMaps: [{ boardId: 'b1', pins: ['L0', 'L1'] }],
      offsets: { led1: 0 },
      cursor: createSabCursor(),
      telemetrySinceHead: tele.head,
      telemetryMax: 10,
      serialRings: [],
    });
    assert.equal(river.header.version, SAB_LAYOUT_VERSION);
    assert.equal(river.pins.b1.bits.length, 1);
    assert.deepEqual(river.frames, []);
    assert.equal(river.telemetry.skipped, 0);
    assert.deepEqual(river.skipped, { telemetry: 0, serial: 0, protocol: 0 });
  });
});
