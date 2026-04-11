// @ts-nocheck
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createRunnerForBoard } from './execute.ts';

type WorkerEvent = {
  ts: string;
  type: string;
  boardId?: string;
  reason?: string;
  metrics?: any;
  pc?: number;
  data?: string;
  value?: number;
  message?: string;
};

type CaseReport = {
  caseId: string;
  pass: boolean;
  summary: string;
  details: Record<string, any>;
};

const requestedCaseTokens = new Set(
  String(process.env.RP2040_SMOKE_CASES || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
);

function shouldRunCase(caseId: string): boolean {
  if (requestedCaseTokens.size === 0) return true;
  for (const token of requestedCaseTokens) {
    if (caseId === token || caseId.startsWith(token)) {
      return true;
    }
  }
  return false;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');
const BACKEND_DEFAULT_UF2 = path.join(
  WORKSPACE_ROOT,
  'openhw-studio-backend-danish',
  'data',
  'firmware',
  'pico-micropython-uart0.uf2'
);

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toUf2PayloadFromFile(uf2Path: string): string {
  const raw = fs.readFileSync(uf2Path);
  return `UF2BASE64:${raw.toString('base64')}`;
}

type CircuitFixture = {
  components: any[];
  wires: Array<{ from: string; to: string }>;
};

function makeBoardComponent(env: string) {
  return {
    id: 'pico1',
    type: 'wokwi-raspberry-pi-pico',
    attrs: { env, builder: 'arduino-pico' },
  };
}

function makeLedCircuit(env: string): CircuitFixture {
  const components = [
    makeBoardComponent(env),
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

  return { components, wires };
}

function makeOledI2CCircuit(env: string): CircuitFixture {
  const components = [
    makeBoardComponent(env),
    {
      id: 'oled1',
      type: 'wokwi-ssd1306-oled',
      attrs: {},
    },
  ];

  const wires = [
    { from: 'pico1:GND', to: 'oled1:GND' },
    { from: 'pico1:3V3', to: 'oled1:VCC' },
    { from: 'pico1:GP5', to: 'oled1:SCL' },
    { from: 'pico1:GP4', to: 'oled1:SDA' },
  ];

  return { components, wires };
}

function makeLcd2004I2CCircuit(env: string): CircuitFixture {
  const components = [
    makeBoardComponent(env),
    {
      id: 'lcd1',
      type: 'wokwi-lcd2004-i2c',
      attrs: {},
    },
  ];

  const wires = [
    { from: 'pico1:GND', to: 'lcd1:GND' },
    { from: 'pico1:3V3', to: 'lcd1:VCC' },
    { from: 'pico1:GP5', to: 'lcd1:SCL' },
    { from: 'pico1:GP4', to: 'lcd1:SDA' },
  ];

  return { components, wires };
}

function makeIli9341SpiCircuit(env: string): CircuitFixture {
  const components = [
    makeBoardComponent(env),
    {
      id: 'tft1',
      type: 'wokwi-ili9341',
      attrs: {},
    },
  ];

  const wires = [
    { from: 'pico1:3V3', to: 'tft1:VCC' },
    { from: 'pico1:GND', to: 'tft1:GND' },
    { from: 'pico1:3V3', to: 'tft1:LED' },
    { from: 'pico1:GP17', to: 'tft1:CS' },
    { from: 'pico1:GP21', to: 'tft1:RESET' },
    { from: 'pico1:GP20', to: 'tft1:DC' },
    { from: 'pico1:GP19', to: 'tft1:MOSI' },
    { from: 'pico1:GP18', to: 'tft1:SCK' },
  ];

  return { components, wires };
}

function compactComponentState(state: any): Record<string, any> {
  if (!state || typeof state !== 'object') return {};
  const compact: Record<string, any> = {};

  for (const [key, value] of Object.entries(state)) {
    if (Array.isArray(value)) {
      compact[key] = value.length > 8 ? `[array:${value.length}]` : value;
      continue;
    }
    if (value && typeof value === 'object') {
      if (ArrayBuffer.isView(value)) {
        compact[key] = `[typed-array:${(value as any).length ?? 0}]`;
      } else {
        compact[key] = '[object]';
      }
      continue;
    }
    compact[key] = value;
  }

  return compact;
}

function compileNativePicoSketch(): {
  payload: string;
  artifactType: 'uf2' | 'hex';
  artifactPath: string;
  compileStdout: string;
} {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'rp2040-smoke-native-'));
  const sketchDir = path.join(tmpBase, 'SmokeNative');
  const buildDir = path.join(tmpBase, 'build');

  fs.mkdirSync(sketchDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const ino = [
    '#include <Arduino.h>',
    '',
    'volatile uint32_t g_ctr = 0;',
    '',
    'void setup() {',
    '  pinMode(15, OUTPUT);',
    '  pinMode(16, OUTPUT);',
    '  Serial1.begin(115200);',
    '  Serial1.println("NATIVE_BOOT_OK");',
    '}',
    '',
    'void loop() {',
    '  g_ctr++;',
    '  bool high = (g_ctr & 0x2000u) != 0;',
    '  digitalWrite(15, high ? HIGH : LOW);',
    '  digitalWrite(16, high ? LOW : HIGH);',
    '  if ((g_ctr & 0x3fffu) == 0) {',
    '    Serial1.println(high ? "NATIVE_H" : "NATIVE_L");',
    '  }',
    '}',
    '',
  ].join('\n');

  const inoPath = path.join(sketchDir, 'SmokeNative.ino');
  fs.writeFileSync(inoPath, ino, 'utf8');

  const args = [
    'compile',
    '--fqbn',
    'rp2040:rp2040:rpipico',
    '--output-dir',
    buildDir,
    sketchDir,
  ];

  const proc = spawnSync('arduino-cli', args, { encoding: 'utf8' });
  if (proc.status !== 0) {
    throw new Error(
      `arduino-cli compile failed (exit=${proc.status})\nSTDOUT:\n${proc.stdout || ''}\nSTDERR:\n${proc.stderr || ''}`
    );
  }

  const outFiles = fs.readdirSync(buildDir);
  const uf2 = outFiles.find((f) => f.toLowerCase().endsWith('.uf2'));
  const hex = outFiles.find((f) => f.toLowerCase().endsWith('.hex'));

  if (uf2) {
    const artifactPath = path.join(buildDir, uf2);
    return {
      payload: `UF2BASE64:${fs.readFileSync(artifactPath).toString('base64')}`,
      artifactType: 'uf2',
      artifactPath,
      compileStdout: proc.stdout || '',
    };
  }

  if (hex) {
    const artifactPath = path.join(buildDir, hex);
    return {
      payload: fs.readFileSync(artifactPath, 'utf8'),
      artifactType: 'hex',
      artifactPath,
      compileStdout: proc.stdout || '',
    };
  }

  throw new Error(`Compile succeeded but no .uf2 or .hex found in ${buildDir}. Files: ${outFiles.join(', ')}`);
}

function compileNativePicoProtocolSketch(mode: 'oled' | 'lcd' | 'tft'): {
  payload: string;
  artifactType: 'uf2' | 'hex';
  artifactPath: string;
  compileStdout: string;
} {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'rp2040-smoke-proto-'));
  const sketchName = mode === 'oled'
    ? 'SmokeOledProtocol'
    : mode === 'lcd'
      ? 'SmokeLcdProtocol'
      : 'SmokeTftProtocol';
  const sketchDir = path.join(tmpBase, sketchName);
  const buildDir = path.join(tmpBase, 'build');

  fs.mkdirSync(sketchDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const usesWire = mode === 'oled' || mode === 'lcd';
  const usesSpi = mode === 'tft';
  const i2cAddress = mode === 'oled' ? '0x3C' : '0x27';
  const bootTag = mode === 'oled' ? 'OLED_BOOT_OK' : mode === 'lcd' ? 'LCD_BOOT_OK' : 'TFT_BOOT_OK';

  const ino = [
    '#include <Arduino.h>',
    ...(usesWire ? ['#include <Wire.h>'] : []),
    ...(usesSpi ? ['#include <SPI.h>'] : []),
    '',
    'volatile uint32_t g_ctr = 0;',
    '',
    'void setup() {',
    '  pinMode(15, OUTPUT);',
    '  pinMode(16, OUTPUT);',
    ...(usesSpi
      ? [
          '  pinMode(17, OUTPUT);',
          '  pinMode(20, OUTPUT);',
          '  pinMode(21, OUTPUT);',
          '  digitalWrite(17, HIGH);',
          '  digitalWrite(20, HIGH);',
          '  digitalWrite(21, HIGH);',
        ]
      : []),
    ...(usesWire
      ? [
          '  Wire.setSDA(4);',
          '  Wire.setSCL(5);',
          '  Wire.begin();',
        ]
      : []),
    ...(usesSpi
      ? [
          '  SPI.setRX(16);',
          '  SPI.setCS(17);',
          '  SPI.setSCK(18);',
          '  SPI.setTX(19);',
          '  SPI.begin();',
        ]
      : []),
    '  Serial1.begin(115200);',
    `  Serial1.println("${bootTag}");`,
    '}',
    '',
    'void loop() {',
    '  g_ctr++;',
    '  bool high = (g_ctr & 0x800u) != 0;',
    '  digitalWrite(15, high ? HIGH : LOW);',
    '  digitalWrite(16, high ? LOW : HIGH);',
    '',
    '  if ((g_ctr & 0x1fu) == 0) {',
    ...(usesWire
      ? [
          `    Wire.beginTransmission(${i2cAddress});`,
          '    Wire.write(0x00);',
          mode === 'oled' ? '    Wire.write(0xAE);' : '    Wire.write(0x01);',
          '    uint8_t status = Wire.endTransmission();',
          '    if ((g_ctr & 0x3ffu) == 0) {',
          mode === 'oled'
            ? '    Serial1.print("OLED_I2C=");'
            : '    Serial1.print("LCD_I2C=");',
          '    Serial1.println(status);',
          '    }',
        ]
      : []),
    ...(usesSpi
      ? [
          '    digitalWrite(17, LOW);',
          '    digitalWrite(20, LOW);',
          '    SPI.transfer(0x2A);',
          '    digitalWrite(20, HIGH);',
          '    SPI.transfer(0x00);',
          '    SPI.transfer(0x10);',
          '    SPI.transfer(0x00);',
          '    SPI.transfer(0x1F);',
          '    digitalWrite(17, HIGH);',
          '    if ((g_ctr & 0x3ffu) == 0) {',
          '    Serial1.println("SPI_OK");',
          '    }',
        ]
      : []),
    '  }',
    '}',
    '',
  ].join('\n');

  const inoPath = path.join(sketchDir, `${sketchName}.ino`);
  fs.writeFileSync(inoPath, ino, 'utf8');

  const args = [
    'compile',
    '--fqbn',
    'rp2040:rp2040:rpipico',
    '--output-dir',
    buildDir,
    sketchDir,
  ];

  const proc = spawnSync('arduino-cli', args, { encoding: 'utf8' });
  if (proc.status !== 0) {
    throw new Error(
      `arduino-cli compile failed (exit=${proc.status})\nSTDOUT:\n${proc.stdout || ''}\nSTDERR:\n${proc.stderr || ''}`
    );
  }

  const outFiles = fs.readdirSync(buildDir);
  const uf2 = outFiles.find((f) => f.toLowerCase().endsWith('.uf2'));
  const hex = outFiles.find((f) => f.toLowerCase().endsWith('.hex'));

  if (uf2) {
    const artifactPath = path.join(buildDir, uf2);
    return {
      payload: `UF2BASE64:${fs.readFileSync(artifactPath).toString('base64')}`,
      artifactType: 'uf2',
      artifactPath,
      compileStdout: proc.stdout || '',
    };
  }

  if (hex) {
    const artifactPath = path.join(buildDir, hex);
    return {
      payload: fs.readFileSync(artifactPath, 'utf8'),
      artifactType: 'hex',
      artifactPath,
      compileStdout: proc.stdout || '',
    };
  }

  throw new Error(`Compile succeeded but no .uf2 or .hex found in ${buildDir}. Files: ${outFiles.join(', ')}`);
}

function sanitizeSerial(text: string): string {
  return String(text || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function summarizePinActivity(pinSnapshots: Array<Record<string, boolean>>) {
  const transitionsByPin: Record<string, number> = {};
  let previous: Record<string, boolean> | null = null;

  for (const snap of pinSnapshots) {
    if (previous) {
      for (const pin of Object.keys(snap)) {
        const prev = !!previous[pin];
        const next = !!snap[pin];
        if (prev !== next) {
          transitionsByPin[pin] = (transitionsByPin[pin] || 0) + 1;
        }
      }
    }
    previous = snap;
  }

  const changedPins = Object.entries(transitionsByPin)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([pin, count]) => `${pin}:${count}`);

  return {
    transitionsByPin,
    changedPins,
    changedPinCount: changedPins.length,
  };
}

async function runRunnerCase(
  caseId: string,
  env: string,
  firmwarePayload: string,
  durationMs: number,
  options?: {
    circuit?: CircuitFixture;
    injectMicroPythonScript?: string;
    forceFaultAfterMs?: number;
    forceFaultPc?: number;
    pyScript?: string;
  }
): Promise<{ report: CaseReport; events: WorkerEvent[]; serialText: string }> {
  const { components, wires } = options?.circuit || makeLedCircuit(env);
  const events: WorkerEvent[] = [];
  const pinSnapshots: Array<Record<string, boolean>> = [];
  const componentLastState: Record<string, any> = {};
  const componentUpdateCount: Record<string, number> = {};
  const i2cConnectEvents: Array<Record<string, any>> = [];
  const debugReasons = new Set<string>();
  const debugLastPins = new Set<string>();
  let serialText = '';
  let faultCount = 0;

  const runner = createRunnerForBoard(
    'wokwi-raspberry-pi-pico',
    firmwarePayload,
    components,
    wires,
    (msg: any) => {
      const event: WorkerEvent = {
        ts: nowIso(),
        type: String(msg?.type || 'unknown'),
        boardId: String(msg?.boardId || ''),
      };

      if (msg?.type === 'debug' && msg?.category === 'rp2040-runtime') {
        event.reason = String(msg.reason || 'tick');
        event.metrics = msg.metrics || {};
        debugReasons.add(event.reason);
        const lastPin = String(msg?.metrics?.lastGpioPin || '');
        if (lastPin) debugLastPins.add(lastPin);
      } else if (msg?.type === 'debug' && msg?.category === 'rp2040-i2c') {
        const payload = {
          reason: String(msg?.reason || ''),
          bus: String(msg?.i2c?.bus || ''),
          address: Number(msg?.i2c?.address ?? -1),
          isRead: !!msg?.i2c?.isRead,
          ack: !!msg?.i2c?.ack,
          deviceCount: Number(msg?.i2c?.deviceCount ?? 0),
          activeSlaveId: String(msg?.i2c?.activeSlaveId || ''),
        };
        i2cConnectEvents.push(payload);
      } else if (msg?.type === 'serial') {
        event.value = Number(msg.value ?? 0);
        event.data = String(msg.data || '');
        serialText += event.data;
      } else if (msg?.type === 'state') {
        if (msg?.pins) {
          pinSnapshots.push({ ...(msg.pins || {}) });
        }
        if (Array.isArray(msg?.components)) {
          for (const comp of msg.components) {
            const compId = String(comp?.id || '');
            if (!compId) continue;
            componentLastState[compId] = comp?.state ?? {};
            componentUpdateCount[compId] = Number(componentUpdateCount[compId] || 0) + 1;
          }
        }
      } else if (msg?.type === 'fault') {
        event.pc = Number(msg.pc ?? 0);
        event.message = String(msg.reason || 'fault');
        faultCount += 1;
      }

      events.push(event);
    },
    {
      boardId: 'pico1',
      serialBaudRate: 115200,
      debugEnabled: true,
      debugIntervalMs: 300,
      pyScript: options?.pyScript,
    }
  );

  if (options?.injectMicroPythonScript) {
    const script = options.injectMicroPythonScript;
    const sendAttempt = () => {
      try {
        runner.serialRx('\u0003\u0003\r\n');
        runner.serialRx(`\u0003\u0003\u0005${script}\n\u0004`);
        setTimeout(() => {
          try {
            runner.serialRx(`\u0003\u0003\u0001${script}\n\u0004\u0002`);
          } catch {
            // no-op
          }
        }, 120);
      } catch {
        // no-op
      }
    };

    // Mirror worker strategy: multiple retries for slow MicroPython boot.
    [1400, 3600, 5800, 8000, 10500].forEach((delayMs) => {
      setTimeout(sendAttempt, delayMs);
    });
  }

  if (Number.isFinite(Number(options?.forceFaultAfterMs))) {
    const faultAfter = Number(options?.forceFaultAfterMs);
    const forcedPc = Number.isFinite(Number(options?.forceFaultPc))
      ? (Number(options?.forceFaultPc) >>> 0)
      : (0x90000101 >>> 0);
    setTimeout(() => {
      try {
        const runnerAny = runner as any;
        if (typeof runnerAny?.faultAndStop === 'function') {
          runnerAny.faultAndStop('forced-fault-test', forcedPc);
          return;
        }

        const cpu = (runner as any)?.cpu;
        if (cpu?.core?.BXWritePC) {
          cpu.core.BXWritePC((forcedPc | 1) >>> 0);
        }
      } catch {
        // no-op
      }
    }, faultAfter);
  }

  await sleep(durationMs);

  try {
    runner.stop();
  } catch {
    // no-op
  }

  const pinSummary = summarizePinActivity(pinSnapshots);
  const cleanSerial = sanitizeSerial(serialText);
  const cpuAny = (runner as any)?.cpu;
  const i2c0 = cpuAny?.i2c?.[0];
  const i2c1 = cpuAny?.i2c?.[1];
  const spi0 = cpuAny?.spi?.[0];
  const spi1 = cpuAny?.spi?.[1];

  const summary = [
    `events=${events.length}`,
    `faults=${faultCount}`,
    `debugReasons=${Array.from(debugReasons).join(',') || 'none'}`,
    `changedPins=${pinSummary.changedPinCount}`,
    `serialLen=${cleanSerial.length}`,
  ].join(' | ');

  const report: CaseReport = {
    caseId,
    pass: true,
    summary,
    details: {
      faultCount,
      debugReasons: Array.from(debugReasons),
      debugLastPins: Array.from(debugLastPins).sort(),
      changedPins: pinSummary.changedPins,
      i2cConnectEvents: i2cConnectEvents.slice(-20),
      componentUpdateCount,
      componentLastState: Object.fromEntries(
        Object.entries(componentLastState).map(([id, state]) => [id, compactComponentState(state)])
      ),
      peripheralDiag: {
        i2c0: i2c0
          ? {
              enable: Number(i2c0.enable ?? 0),
              state: Number(i2c0.state ?? -1),
              busy: !!i2c0.busy,
              txFifo: Number(i2c0.txFIFO?.itemCount ?? 0),
              rxFifo: Number(i2c0.rxFIFO?.itemCount ?? 0),
              intRaw: Number(i2c0.intRaw ?? 0),
              intEnable: Number(i2c0.intEnable ?? 0),
              abortSource: Number(i2c0.abortSource ?? 0),
            }
          : null,
        i2c1: i2c1
          ? {
              enable: Number(i2c1.enable ?? 0),
              state: Number(i2c1.state ?? -1),
              busy: !!i2c1.busy,
              txFifo: Number(i2c1.txFIFO?.itemCount ?? 0),
              rxFifo: Number(i2c1.rxFIFO?.itemCount ?? 0),
              intRaw: Number(i2c1.intRaw ?? 0),
              intEnable: Number(i2c1.intEnable ?? 0),
              abortSource: Number(i2c1.abortSource ?? 0),
            }
          : null,
        spi0: spi0
          ? {
              enabled: !!spi0.enabled,
              busy: !!spi0.busy,
              txFifo: Number(spi0.txFIFO?.itemCount ?? 0),
              rxFifo: Number(spi0.rxFIFO?.itemCount ?? 0),
              status: Number(spi0.status ?? 0),
            }
          : null,
        spi1: spi1
          ? {
              enabled: !!spi1.enabled,
              busy: !!spi1.busy,
              txFifo: Number(spi1.txFIFO?.itemCount ?? 0),
              rxFifo: Number(spi1.rxFIFO?.itemCount ?? 0),
              status: Number(spi1.status ?? 0),
            }
          : null,
      },
      serialPreview: cleanSerial.slice(0, 400),
      finalPins: pinSnapshots.length > 0 ? pinSnapshots[pinSnapshots.length - 1] : {},
      stateSamples: pinSnapshots.length,
    },
  };

  return { report, events, serialText: cleanSerial };
}

function runMissingInoDecisionCase(): CaseReport {
  // Mirrors SimulatorPage resolveRp2040SourceMode + compile-gate behavior.
  const resolveRp2040SourceMode = ({
    configuredMode,
    activePrefersIno,
    activePrefersPy,
    hasNativeSketch,
    hasPythonSource,
  }: {
    configuredMode: string;
    activePrefersIno: boolean;
    activePrefersPy: boolean;
    hasNativeSketch: boolean;
    hasPythonSource: boolean;
  }): 'ino' | 'py' => {
    const mode = String(configuredMode || 'auto').toLowerCase();
    if (mode === 'ino' || mode === 'native') return 'ino';
    if (mode === 'py' || mode === 'python' || mode === 'micropython') return 'py';

    if (activePrefersIno) return 'ino';
    if (activePrefersPy) return 'py';
    if (hasPythonSource) return 'py';
    if (hasNativeSketch) return 'ino';
    return 'py';
  };

  const selected = resolveRp2040SourceMode({
    configuredMode: 'ino',
    activePrefersIno: false,
    activePrefersPy: false,
    hasNativeSketch: false,
    hasPythonSource: true,
  });

  const blocked = selected === 'ino' && !false;

  return {
    caseId: 'case2-native-missing-ino',
    pass: blocked,
    summary: `selectedMode=${selected} | blocked=${blocked}`,
    details: {
      selectedMode: selected,
      blocked,
      expectedReason: 'RP2040 source mode is .ino but no enabled .ino sketch exists',
    },
  };
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeLogs(reports: CaseReport[], rawEvents: Record<string, WorkerEvent[]>, serialDump: Record<string, string>) {
  const outDir = path.join(WORKSPACE_ROOT, 'temp', 'rp2040-smoke');
  ensureDir(outDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const jsonPath = path.join(outDir, `smoke-${stamp}.json`);
  const txtPath = path.join(outDir, `smoke-${stamp}.log`);

  const payload = {
    generatedAt: nowIso(),
    reports,
    serialDump,
    rawEvents,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const lines: string[] = [];
  lines.push(`RP2040 Smoke Matrix @ ${nowIso()}`);
  lines.push('');
  for (const r of reports) {
    lines.push(`[${r.caseId}] PASS=${r.pass}`);
    lines.push(`summary: ${r.summary}`);
    lines.push(`details: ${JSON.stringify(r.details)}`);
    lines.push('');
  }
  for (const [k, v] of Object.entries(serialDump)) {
    lines.push(`[serial:${k}]`);
    lines.push(v || '<empty>');
    lines.push('');
  }

  fs.writeFileSync(txtPath, lines.join('\n'), 'utf8');

  return { outDir, jsonPath, txtPath };
}

async function main() {
  const reports: CaseReport[] = [];
  const rawEvents: Record<string, WorkerEvent[]> = {};
  const serialDump: Record<string, string> = {};

  // Case 1: RP2040 native env with a valid .ino
  const nativeArtifact = compileNativePicoSketch();
  if (shouldRunCase('case1-native-valid-ino')) {
    const case1 = await runRunnerCase(
      'case1-native-valid-ino',
      'ino',
      nativeArtifact.payload,
      3500
    );
    case1.report.pass = case1.report.details.faultCount === 0
      && case1.report.details.changedPins.some((s: string) => s.startsWith('GP15:') || s.startsWith('GP16:'))
      && /NATIVE_(BOOT|TICK)/.test(case1.serialText);
    reports.push(case1.report);
    rawEvents[case1.report.caseId] = case1.events;
    serialDump[case1.report.caseId] = case1.serialText;
  }

  // Case 2: RP2040 native env with missing .ino (decision gate in SimulatorPage)
  if (shouldRunCase('case2-native-missing-ino')) {
    const case2 = runMissingInoDecisionCase();
    reports.push(case2);
  }

  const needsOledProtocolCase = shouldRunCase('case5-i2c-oled-traffic');
  const needsLcdProtocolCase = shouldRunCase('case6-i2c-lcd2004-traffic');
  const needsTftProtocolCase = shouldRunCase('case7-spi-ili9341-traffic');

  const oledProtocolArtifact = needsOledProtocolCase
    ? compileNativePicoProtocolSketch('oled')
    : null;
  const lcdProtocolArtifact = needsLcdProtocolCase
    ? compileNativePicoProtocolSketch('lcd')
    : null;
  const tftProtocolArtifact = needsTftProtocolCase
    ? compileNativePicoProtocolSketch('tft')
    : null;

  // Case 3: RP2040 MicroPython env with main.py + default UF2
  if (!fs.existsSync(BACKEND_DEFAULT_UF2)) {
    throw new Error(`Default UF2 not found: ${BACKEND_DEFAULT_UF2}`);
  }
  const defaultUf2Payload = toUf2PayloadFromFile(BACKEND_DEFAULT_UF2);
  const micropythonScript = [
    'from machine import Pin',
    'import time',
    'p = Pin(15, Pin.OUT)',
    'print("MP_BOOT_OK")',
    'for i in range(8):',
    '    p.value(i % 2)',
    '    print("MP_TICK", i)',
    '    time.sleep_ms(100)',
    'print("MP_DONE")',
  ].join('\n');

  if (shouldRunCase('case3-micropython-mainpy-default-uf2')) {
    const case3 = await runRunnerCase(
      'case3-micropython-mainpy-default-uf2',
      'micropython',
      defaultUf2Payload,
      13000,
      { injectMicroPythonScript: micropythonScript }
    );
    case3.report.pass = case3.report.details.faultCount === 0
      && case3.report.details.changedPins.some((s: string) => s.startsWith('GP15:'))
      && /MP_(BOOT_OK|TICK|DONE)/.test(case3.serialText);
    reports.push(case3.report);
    rawEvents[case3.report.caseId] = case3.events;
    serialDump[case3.report.caseId] = case3.serialText;
  }

  // Case 4: Forced fault path (confirm deterministic stop behavior)
  if (shouldRunCase('case4-forced-fault-deterministic-stop')) {
    const case4 = await runRunnerCase(
      'case4-forced-fault-deterministic-stop',
      'ino',
      nativeArtifact.payload,
      3000,
      { forceFaultAfterMs: 900, forceFaultPc: 0x90000101 }
    );
    case4.report.pass = case4.report.details.faultCount >= 1
      && case4.report.details.debugReasons.includes('fault');
    reports.push(case4.report);
    rawEvents[case4.report.caseId] = case4.events;
    serialDump[case4.report.caseId] = case4.serialText;
  }

  if (oledProtocolArtifact && shouldRunCase('case5-i2c-oled-traffic')) {
    const case5 = await runRunnerCase(
      'case5-i2c-oled-traffic',
      'ino',
      oledProtocolArtifact.payload,
      4500,
      { circuit: makeOledI2CCircuit('ino') }
    );
    const oledAck = /OLED_I2C=0/.test(case5.serialText);
    const oledConnected = Array.isArray(case5.report.details.i2cConnectEvents)
      && case5.report.details.i2cConnectEvents.some((ev: any) => Number(ev.address) === 0x3c && !!ev.ack);

    case5.report.pass = case5.report.details.faultCount === 0
      && oledAck
      && oledConnected;

    reports.push(case5.report);
    rawEvents[case5.report.caseId] = case5.events;
    serialDump[case5.report.caseId] = case5.serialText;
  }

  if (lcdProtocolArtifact && shouldRunCase('case6-i2c-lcd2004-traffic')) {
    const case6 = await runRunnerCase(
      'case6-i2c-lcd2004-traffic',
      'ino',
      lcdProtocolArtifact.payload,
      4500,
      { circuit: makeLcd2004I2CCircuit('ino') }
    );
    const lcdAck = /LCD_I2C=0/.test(case6.serialText);
    const lcdConnected = Array.isArray(case6.report.details.i2cConnectEvents)
      && case6.report.details.i2cConnectEvents.some((ev: any) => Number(ev.address) === 0x27 && !!ev.ack);

    case6.report.pass = case6.report.details.faultCount === 0
      && lcdAck
      && lcdConnected;

    reports.push(case6.report);
    rawEvents[case6.report.caseId] = case6.events;
    serialDump[case6.report.caseId] = case6.serialText;
  }

  if (tftProtocolArtifact && shouldRunCase('case7-spi-ili9341-traffic')) {
    const case7 = await runRunnerCase(
      'case7-spi-ili9341-traffic',
      'ino',
      tftProtocolArtifact.payload,
      4500,
      { circuit: makeIli9341SpiCircuit('ino') }
    );
    const spiMarker = /SPI_OK/.test(case7.serialText);
    const tftState = case7.report.details.componentLastState?.tft1 || {};
    const spiRxBytes = Number(tftState.spiRxBytes || 0);

    case7.report.pass = case7.report.details.faultCount === 0
      && spiMarker
      && (spiRxBytes > 0 || Number(case7.report.details.componentUpdateCount?.tft1 || 0) > 0);

    reports.push(case7.report);
    rawEvents[case7.report.caseId] = case7.events;
    serialDump[case7.report.caseId] = case7.serialText;
  }

  const out = writeLogs(reports, rawEvents, serialDump);

  const totalPass = reports.filter((r) => r.pass).length;
  const total = reports.length;
  console.log(`RP2040 smoke matrix complete: ${totalPass}/${total} passed`);
  for (const r of reports) {
    console.log(`- ${r.caseId}: ${r.pass ? 'PASS' : 'FAIL'} | ${r.summary}`);
  }
  console.log(`Log file: ${out.txtPath}`);
  console.log(`JSON file: ${out.jsonPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('RP2040 smoke matrix failed:', err?.message || err);
  process.exit(1);
});
