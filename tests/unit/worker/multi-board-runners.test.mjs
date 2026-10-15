import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createRunnerForBoard } from '../../../src/worker/execute.ts';

const noop = () => {};

function minimalBoard(id, type) {
  return { id, type, attrs: {} };
}

describe('multi-board runners', () => {
  test('execute.ts routes each board family to its runner', async () => {
    const avr = await createRunnerForBoard('openhw-arduino-uno', ':400000000000', [minimalBoard('uno1', 'openhw-arduino-uno')], [], noop, { boardId: 'uno1' });
    assert.equal(avr.boardId, 'uno1');
    avr.stop();

    const pico = await createRunnerForBoard('openhw-pico', '', [minimalBoard('pico1', 'openhw-pico')], [], noop, { boardId: 'pico1' });
    assert.equal(pico.boardId, 'pico1');
    assert.equal(typeof pico.serialRxByteFromSource, 'function');
    pico.stop();

    const esp = await createRunnerForBoard('openhw-esp32', '', [minimalBoard('esp1', 'openhw-esp32')], [], noop, { boardId: 'esp1' });
    assert.equal(esp.boardId, 'esp1');
    esp.stop();

    const f1 = await createRunnerForBoard('openhw-stm32-bluepill', '', [minimalBoard('f1', 'openhw-stm32-bluepill')], [], noop, { boardId: 'f1' });
    assert.equal(f1.boardId, 'f1');
    f1.stop();

    const f4 = await createRunnerForBoard('openhw-stm32f4', '', [minimalBoard('f4', 'openhw-stm32f4')], [], noop, { boardId: 'f4' });
    assert.equal(f4.boardId, 'f4');
    f4.stop();
  }, 120000);

  test('two runners coexist with isolated boardIds (SAB-free)', async () => {
    const states = [];
    const onState = (s) => states.push(s);
    const a = await createRunnerForBoard('openhw-arduino-uno', ':400000000000', [minimalBoard('a', 'openhw-arduino-uno')], [], onState, { boardId: 'a' });
    const b = await createRunnerForBoard('openhw-stm32-bluepill', '', [minimalBoard('b', 'openhw-stm32-bluepill')], [], onState, { boardId: 'b' });
    assert.notEqual(a, b);
    assert.equal(a.boardId, 'a');
    assert.equal(b.boardId, 'b');
    // Serial RX paths don't throw without firmware loaded.
    a.serialRxByte(65);
    b.serialRxByte(66);
    a.stop();
    b.stop();
  }, 120000);
});
