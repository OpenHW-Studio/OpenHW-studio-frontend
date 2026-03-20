import assert from 'node:assert/strict';
import {
  endpointAliases,
  getUartPinCandidates,
  areBoardsUartConnected,
  isProgrammableBoardType,
} from './protocol-routing.js';

function run() {
  assert.equal(isProgrammableBoardType('wokwi-arduino-uno'), true);
  assert.equal(isProgrammableBoardType('wokwi-esp32-devkit'), true);
  assert.equal(isProgrammableBoardType('custom-sensor'), false);

  const aliases = endpointAliases('board1:D1');
  assert.equal(aliases.includes('board1:1'), true);

  const esp = getUartPinCandidates('esp32');
  assert.equal(esp.tx.includes('TX0'), true);
  assert.equal(esp.rx.includes('RX0'), true);

  const links = new Set(['A:TX0->B:RX0', 'A:D1->B:D0']);
  const areConnected = (a, b) => links.has(`${a}->${b}`);

  const connected = areBoardsUartConnected('A', 'esp32', 'B', 'arduino', areConnected);
  assert.equal(connected, true);

  const disconnected = areBoardsUartConnected('A', 'rp2040', 'B', 'stm32', () => false);
  assert.equal(disconnected, false);

  console.log('protocol-compliance: PASS');
}

run();
