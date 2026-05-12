import assert from 'node:assert/strict';
import {
  endpointAliases,
  getUartPinCandidates,
  getUartSources,
  areBoardsUartConnected,
  areBoardsSoftSerialConnected,
  resolveUartRoute,
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

  const picoUart0 = getUartPinCandidates('rp2040', 'uart0');
  const picoUart1 = getUartPinCandidates('rp2040', 'uart1');
  assert.equal(picoUart0.tx.includes('GP0'), true);
  assert.equal(picoUart1.tx.includes('GP4'), true);
  assert.deepEqual(getUartSources('rp2040'), ['uart0', 'uart1']);

  const links = new Set([
    'A:TX0->B:RX0',
    'A:D1->B:D0',
    'P1:GP4->P2:GP5',
    'P1:GP0->U1:D0',
  ]);
  const areConnected = (a, b) => links.has(`${a}->${b}`);

  const connected = areBoardsUartConnected('A', 'esp32', 'B', 'arduino', areConnected);
  assert.equal(connected, true);

  const disconnected = areBoardsUartConnected('A', 'rp2040', 'B', 'stm32', () => false);
  assert.equal(disconnected, false);

  const picoUart0Disconnected = areBoardsUartConnected('P1', 'rp2040', 'P2', 'rp2040', areConnected, 'uart0');
  assert.equal(picoUart0Disconnected, false);

  const picoUart1Connected = areBoardsUartConnected('P1', 'rp2040', 'P2', 'rp2040', areConnected, 'uart1');
  assert.equal(picoUart1Connected, true);

  const picoRoute = resolveUartRoute('P1', 'rp2040', 'P2', 'rp2040', areConnected, 'uart1');
  assert.equal(picoRoute.connected, true);
  assert.equal(picoRoute.targetSource, 'uart1');

  const picoToUnoRoute = resolveUartRoute('P1', 'rp2040', 'U1', 'arduino', areConnected, 'uart0');
  assert.equal(picoToUnoRoute.connected, true);
  assert.equal(picoToUnoRoute.targetSource, 'uart0');

  const softLinks = new Set([
    'U1:10->U2:11',
    'P1:GP10->P2:GP11',
    'U1:D10->P2:D11',
  ]);
  const areSoftConnected = (a, b) => softLinks.has(`${a}->${b}`);
  assert.equal(areBoardsSoftSerialConnected('U1', 'arduino', 'U2', 'arduino', areSoftConnected), true);
  assert.equal(areBoardsSoftSerialConnected('P1', 'rp2040', 'P2', 'rp2040', areSoftConnected), true);
  assert.equal(areBoardsSoftSerialConnected('U1', 'arduino', 'P2', 'rp2040', areSoftConnected), true);

  console.log('protocol-compliance: PASS');
}

run();
