// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunnerForBoard } from '../src/worker/execute.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_DEFAULT_UF2 = path.join(
  WORKSPACE_ROOT,
  'openhw-studio-backend-danish',
  'data',
  'firmware',
  'pico-micropython-uart0.uf2'
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toUf2PayloadFromFile(uf2Path: string): string {
  const raw = fs.readFileSync(uf2Path);
  return `UF2BASE64:${raw.toString('base64')}`;
}

const userScript = [
  'from machine import Pin',
  'import time',
  '',
  'led = Pin(15, Pin.OUT)',
  '',
  'print("RP2040_MICROPY_BOOT_OK")',
  '',
  'for i in range(40):',
  '    led.value(i % 2)',
  '    print("RP2040_MICROPY_TICK", i, "led", i % 2)',
  '    time.sleep_ms(120)',
  '',
  'print("RP2040_MICROPY_DONE")',
].join('\n');

const sleepCompatPrelude = [
  '# OPENHW_RP2040_SLEEP_COMPAT',
  'def _openhw_sleep_ms(ms):',
  '    ms = int(ms)',
  '    if ms <= 0:',
  '        return',
  '    for _ in range(ms * 500):',
  '        pass',
  '',
].join('\n');

const scriptSource = `${sleepCompatPrelude}${userScript
  .replace(/\btime\.sleep_ms\s*\(/g, '_openhw_sleep_ms(')
  .replace(/\bsleep_ms\s*\(/g, '_openhw_sleep_ms(')}\n`;

const normalized = String(scriptSource || '')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .split('\n')
  .map((line) => line.replace(/\u0004/g, ''))
  .join('\n');
const rawPayload = `\u0001${normalized}\n\u0004`;

const components = [
  {
    id: 'pico1',
    type: 'wokwi-raspberry-pi-pico',
    attrs: { env: 'micropython', builder: 'arduino-pico' },
  },
  {
    id: 'led1',
    type: 'wokwi-led',
    attrs: { color: 'red' },
  },
];
const wires = [
  { from: 'pico1:GP15', to: 'led1:A' },
  { from: 'pico1:GND', to: 'led1:K' },
];

let serialText = '';
let stateCount = 0;
let injected = false;
let lastActiveUart = -1;
let lastUsbReady = false;
let lastTx = 0;
let lastRx = 0;
let gp15Toggles = 0;
let lastGp15 = null;

const runner = createRunnerForBoard(
  'wokwi-raspberry-pi-pico',
  toUf2PayloadFromFile(BACKEND_DEFAULT_UF2),
  components,
  wires,
  (msg) => {
    if (msg?.type === 'serial') {
      serialText += String(msg.data || '');
      if (!injected && serialText.includes('>>>')) {
        injected = true;
        try {
          const runnerAny = runner as any;
          if (Array.isArray(runnerAny?.serialBuffer)) {
            runnerAny.serialBuffer.length = 0;
          }
          runner.serialRx(rawPayload);
        } catch {
          // no-op
        }
      }
    }
    if (msg?.type === 'state' && msg?.pins) {
      stateCount += 1;
      const gp15 = !!msg.pins.GP15;
      if (lastGp15 === null) {
        lastGp15 = gp15;
      } else if (lastGp15 !== gp15) {
        gp15Toggles += 1;
        lastGp15 = gp15;
      }
    }
    if (msg?.type === 'debug' && msg?.category === 'rp2040-runtime') {
      const m = msg.metrics || {};
      lastActiveUart = Number(m.activeUart ?? lastActiveUart);
      lastUsbReady = !!m.usbCdcReady;
      lastTx = Number(m.serialTxBytes || lastTx);
      lastRx = Number(m.serialRxBytes || lastRx);
    }
  },
  {
    boardId: 'pico1',
    serialBaudRate: 115200,
    debugEnabled: true,
    debugIntervalMs: 300,
  }
);

// No Ctrl-C probe timer: wait for boot prompt and inject once.

await sleep(10000);

try {
  runner.stop();
} catch {
  // no-op
}

const compact = serialText.replace(/\r/g, '');
const hasBoot = compact.includes('RP2040_MICROPY_BOOT_OK');
const hasDone = compact.includes('RP2040_MICROPY_DONE');
const hasSyntax = compact.includes('SyntaxError');

console.log(
  'hasBoot=',
  hasBoot,
  'hasDone=',
  hasDone,
  'hasSyntax=',
  hasSyntax,
  'stateCount=',
  stateCount,
  'injected=',
  injected,
  'activeUart=',
  lastActiveUart,
  'usbReady=',
  lastUsbReady,
  'tx=',
  lastTx,
  'rx=',
  lastRx,
  'gp15Toggles=',
  gp15Toggles,
  'gp15Final=',
  lastGp15
);
console.log('--- SERIAL START ---');
console.log(compact.slice(0, 5000));
console.log('--- SERIAL END ---');
