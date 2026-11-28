import assert from 'node:assert/strict';
import {
  endpointAliases,
  getUartPinCandidates,
  getUartSources,
  areBoardsUartConnected,
  areBoardsSoftSerialConnected,
  resolveUartRoute,
  isProgrammableBoardType,
} from '../../../src/worker/protocol-routing.js';
import { describe, test } from 'vitest';

describe('protocol compliance', () => {
  test('protocol compliance', () => {
    assert.equal(isProgrammableBoardType('openhw-arduino-uno'), true);
    assert.equal(isProgrammableBoardType('openhw-arduino-nano'), true);
    assert.equal(isProgrammableBoardType('openhw-pico'), true);
    assert.equal(isProgrammableBoardType('openhw-esp32'), true);
    assert.equal(isProgrammableBoardType('openhw-stm32-bluepill'), true);
    assert.equal(isProgrammableBoardType('openhw-stm32f4'), true);
    assert.equal(isProgrammableBoardType('custom-sensor'), false);
    // Camera board family: promoted to a real board (Esp32Runner boots the
    // cam preset — see protocol-routing.js), so it routes as programmable.
    assert.equal(isProgrammableBoardType('openhw-esp32-cam'), true);

    const aliases = endpointAliases('board1:D1');
    assert.equal(aliases.includes('board1:1'), true);

    // Per-family UART pin tables (routing layer for inter-board UART).
    const uno = getUartPinCandidates('arduino');
    assert.equal(uno.tx.includes('TX0'), true);
    assert.equal(uno.rx.includes('RX0'), true);
    assert.deepEqual(getUartSources('arduino'), ['uart0']);

    const pico = getUartPinCandidates('openhw-pico');
    assert.equal(pico.tx.includes('GP0'), true);
    assert.equal(pico.rx.includes('GP1'), true);

    const esp = getUartPinCandidates('openhw-esp32');
    assert.equal(esp.tx.includes('GPIO1'), true);
    assert.equal(esp.rx.includes('GPIO3'), true);

    const f1 = getUartPinCandidates('openhw-stm32-bluepill');
    assert.equal(f1.tx.includes('PA9'), true);
    assert.equal(f1.rx.includes('PA10'), true);

    const f4 = getUartPinCandidates('openhw-stm32f4');
    assert.equal(f4.tx.includes('PA9'), true);
    assert.equal(f4.rx.includes('PA10'), true);

    const links = new Set([
      'A:TX0->B:RX0',
      'A:D1->B:D0',
    ]);
    const areConnected = (a, b) => links.has(`${a}->${b}`);

    const connected = areBoardsUartConnected('A', 'arduino', 'B', 'arduino', areConnected);
    assert.equal(connected, true);

    const disconnected = areBoardsUartConnected('A', 'arduino', 'B', 'arduino', () => false);
    assert.equal(disconnected, false);

    const unoRoute = resolveUartRoute('A', 'arduino', 'B', 'arduino', areConnected, 'uart0');
    assert.equal(unoRoute.connected, true);
    assert.equal(unoRoute.targetSource, 'uart0');

    const softLinks = new Set([
      'U1:10->U2:11',
    ]);
    const areSoftConnected = (a, b) => softLinks.has(`${a}->${b}`);
    assert.equal(areBoardsSoftSerialConnected('U1', 'arduino', 'U2', 'arduino', areSoftConnected), true);

    // Cross-family UART route: Uno TX0 wired to Pico GP1 (RX).
    const xLinks = new Set(['UNO:TX0->PICO:GP1']);
    const xAreConnected = (a, b) => xLinks.has(`${a}->${b}`);
    const xRoute = resolveUartRoute('UNO', 'openhw-arduino-uno', 'PICO', 'openhw-pico', xAreConnected, 'uart0');
    assert.equal(xRoute.connected, true);
    assert.equal(xRoute.targetSource, 'uart0');

    // Pico TX (GP0) wired to ESP32 RX (GPIO3).
    const peLinks = new Set(['PICO:GP0->ESP:GPIO3']);
    const peConnected = (a, b) => peLinks.has(`${a}->${b}`);
    assert.equal(areBoardsUartConnected('PICO', 'openhw-pico', 'ESP', 'openhw-esp32', peConnected), true);
  });
});
