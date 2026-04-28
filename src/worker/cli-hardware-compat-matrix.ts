// @ts-nocheck
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildFatFsImage, buildLittleFsImage, createRunnerForBoard } from './execute.ts';
import {
  endpointAliases,
  resolveUartRoute,
  areBoardsSoftSerialConnected,
} from './protocol-routing.js';

type WorkerEvent = {
  ts: string;
  type: string;
  boardId?: string;
  reason?: string;
  metrics?: any;
  data?: string;
  value?: number;
  source?: string;
  pc?: number;
  message?: string;
};

type CaseReport = {
  caseId: string;
  pass: boolean;
  summary: string;
  details: Record<string, any>;
};

type CompileArtifact = {
  payload: string;
  artifactType: 'uf2' | 'hex';
  artifactPath: string;
  compileStdout: string;
};

type CircuitFixture = {
  components: any[];
  wires: Array<{ from: string; to: string }>;
};

type SingleBoardCaseOptions = {
  circuit: CircuitFixture;
  boardId?: string;
  serialBaudRate?: number;
  pyScript?: string;
  circuitPythonScript?: string;
  loopbackToSelf?: boolean;
  rp2040LogicalFlashBytes?: number;
  rp2040FlashPartitions?: Array<{ offset: number; data: Uint8Array }>;
  circuitPythonWaitMs?: number;
  serialInputs?: Array<{ delayMs: number; data: string; source?: string }>;
};

type LinkedBoardCaseOptions = {
  components: any[];
  wires: Array<{ from: string; to: string }>;
  boards: Array<{
    id: string;
    type: string;
    firmwarePayload: string;
    serialBaudRate?: number;
    pyScript?: string;
  }>;
  durationMs: number;
};

const requestedCaseTokens = new Set(
  String(process.env.CLI_SMOKE_CASES || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
);

function shouldRunCase(caseId: string): boolean {
  if (requestedCaseTokens.size === 0) return true;
  for (const token of requestedCaseTokens) {
    if (caseId === token || caseId.startsWith(token)) return true;
  }
  return false;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');
const JSON_EXAMPLE_DIR = path.resolve(WORKSPACE_ROOT, 'openhw-studio-examples-danish', 'examples', 'json-example');
const MICROPYTHON_UF2_PATH = path.resolve(WORKSPACE_ROOT, 'openhw-studio-backend-danish', 'data', 'firmware', 'pico-micropython-uart0.uf2');
const CIRCUITPYTHON_UF2_PATH = path.resolve(WORKSPACE_ROOT, 'openhw-studio-backend-danish', 'data', 'firmware', 'adafruit-circuitpython-raspberry_pi_pico-en_US-8.2.7.uf2');
const UF2_PAYLOAD_PREFIX = 'UF2BASE64:';
const RP2040_LOGICAL_FLASH_BYTES = 2 * 1024 * 1024;
const RP2040_MICROPYTHON_FS_OFFSET = 0xA0000;
const RP2040_CIRCUITPYTHON_FS_OFFSET = 0x100000;
const RP2040_LITTLEFS_BLOCK_SIZE = 4096;

type Rp2040RuntimeEnv = 'native' | 'micropython' | 'circuitpython';

const ALLOWED_ARDUINO_SOURCE_EXTS = new Set(['.ino', '.h', '.hpp', '.c', '.cpp']);
const jsonExampleCache = new Map<string, any | null>();
const micropythonUf2PayloadCache = { value: '' };
const circuitpythonUf2PayloadCache = { value: '' };

function loadJsonExampleFixture(caseId: string): any | null {
  if (jsonExampleCache.has(caseId)) {
    return jsonExampleCache.get(caseId) || null;
  }

  const fixturePath = path.join(JSON_EXAMPLE_DIR, `${caseId}.json`);
  try {
    const parsed = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    jsonExampleCache.set(caseId, parsed);
    return parsed;
  } catch (err) {
    console.warn(`[CLI Matrix] Fixture not loaded for ${caseId}: ${err?.message || err}`);
    jsonExampleCache.set(caseId, null);
    return null;
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeRp2040RuntimeEnv(source: unknown): Rp2040RuntimeEnv {
  const value = String(source || '').trim().toLowerCase();
  if (!value || value === 'none' || value === 'native' || value === 'ino') return 'native';
  if (value === 'cp' || value === 'circuitpy' || value === 'circuitpython' || value.startsWith('circuitpython')) {
    return 'circuitpython';
  }
  if (value === 'py' || value === 'python' || value === 'micropython' || value.startsWith('micropython')) {
    return 'micropython';
  }
  return 'native';
}

function getRp2040PythonFsOffset(env: Rp2040RuntimeEnv): number {
  if (env === 'circuitpython') {
    const override = Number.parseInt(String(process.env.CLI_CP_FS_OFFSET || ''), 0);
    if (Number.isFinite(override) && override > 0) {
      return Math.floor(override) >>> 0;
    }
  }

  return env === 'circuitpython'
    ? RP2040_CIRCUITPYTHON_FS_OFFSET
    : RP2040_MICROPYTHON_FS_OFFSET;
}

function getRp2040PythonFsBytes(env: Rp2040RuntimeEnv): number {
  const offset = getRp2040PythonFsOffset(env);
  return Math.max(0, RP2040_LOGICAL_FLASH_BYTES - offset);
}

function getRp2040PythonEntryFileName(env: Rp2040RuntimeEnv): string {
  return env === 'circuitpython' ? 'code.py' : 'main.py';
}

function normalizeRuntimePath(pathLike: unknown): string {
  const normalized = String(pathLike || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();

  if (!normalized) return '';

  const parts = normalized
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..');

  return parts.join('/');
}

function resolveFixtureRuntimeEnv(caseId: string, boardId: string): Rp2040RuntimeEnv {
  const fixture = loadJsonExampleFixture(caseId);
  if (!fixture) return 'native';

  const components = Array.isArray(fixture.components) ? fixture.components : [];
  const board = components.find((comp: any) => String(comp?.id || '') === String(boardId || ''));
  return normalizeRp2040RuntimeEnv(board?.attrs?.env);
}

function resolveFixturePythonRuntimeFiles(caseId: string, boardId: string): Array<{ path: string; content: string }> {
  const fixture = loadJsonExampleFixture(caseId);
  if (!fixture) return [];

  const boardPrefix = `project/${String(boardId || '').trim()}/`;
  const projectFiles = Array.isArray(fixture.projectFiles) ? fixture.projectFiles : [];
  const filesByPath = new Map<string, string>();

  for (const file of projectFiles) {
    if (String(file?.boardId || '').trim() !== String(boardId || '').trim()) continue;
    if (String(file?.kind || 'code') !== 'code') continue;

    const rawPath = String(file?.path || file?.name || '').replace(/\\/g, '/').trim();
    const ext = path.extname(rawPath || String(file?.name || '')).toLowerCase();
    if (ext !== '.py') continue;

    let relativePath = rawPath;
    if (rawPath.toLowerCase().startsWith(boardPrefix.toLowerCase())) {
      relativePath = rawPath.slice(boardPrefix.length);
    }

    const normalizedPath = normalizeRuntimePath(relativePath || file?.name || '');
    if (!normalizedPath) continue;
    filesByPath.set(normalizedPath, String(file?.content || ''));
  }

  return Array.from(filesByPath.entries())
    .map(([runtimePath, content]) => ({ path: runtimePath, content }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function resolveRp2040RuntimeFiles(
  caseId: string,
  boardId: string,
  env: Rp2040RuntimeEnv,
  fallbackFiles: Array<{ path: string; content: string }> = [],
): Array<{ path: string; content: string }> {
  const filesByPath = new Map<string, string>();
  const addFile = (rawPath: unknown, rawContent: unknown) => {
    const runtimePath = normalizeRuntimePath(rawPath);
    if (!runtimePath) return;
    filesByPath.set(runtimePath, String(rawContent || ''));
  };

  for (const file of resolveFixturePythonRuntimeFiles(caseId, boardId)) {
    addFile(file.path, file.content);
  }

  for (const file of (Array.isArray(fallbackFiles) ? fallbackFiles : [])) {
    addFile(file?.path, file?.content);
  }

  const entryName = getRp2040PythonEntryFileName(env);
  if (!filesByPath.has(entryName) && filesByPath.has('main.py')) {
    filesByPath.set(entryName, String(filesByPath.get('main.py') || ''));
  }

  return Array.from(filesByPath.entries())
    .map(([runtimePath, content]) => ({ path: runtimePath, content }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function resolveCaseCircuit(caseId: string, fallbackCircuit: CircuitFixture): CircuitFixture {
  const fixture = loadJsonExampleFixture(caseId);
  if (!fixture) return cloneJson(fallbackCircuit);

  const components = Array.isArray(fixture.components) ? fixture.components : null;
  const connections = Array.isArray(fixture.connections) ? fixture.connections : null;
  if (!components || !connections) return cloneJson(fallbackCircuit);

  return {
    components: cloneJson(components),
    wires: cloneJson(connections).map((wire: any) => ({
      from: String(wire?.from || ''),
      to: String(wire?.to || ''),
    })).filter((wire: any) => wire.from && wire.to),
  };
}

function resolveFixtureBoardFiles(caseId: string, boardId: string): Array<{ name: string; content: string }> {
  const fixture = loadJsonExampleFixture(caseId);
  if (!fixture) return [];

  const projectFiles = Array.isArray(fixture.projectFiles) ? fixture.projectFiles : [];
  return projectFiles
    .filter((file: any) => String(file?.boardId || '').trim() === String(boardId || '').trim())
    .filter((file: any) => String(file?.kind || 'code') === 'code')
    .map((file: any) => {
      const pathLike = String(file?.path || file?.name || '').trim();
      const name = sanitizeSourceName(pathLike || `${boardId}.ino`);
      return {
        name,
        content: String(file?.content || ''),
      };
    });
}

function resolveArduinoCompileInputs(
  caseId: string,
  boardId: string,
  fallbackMainCode: string,
  fallbackExtraFiles: Array<{ name: string; content: string }> = [],
) {
  const boardFiles = resolveFixtureBoardFiles(caseId, boardId)
    .filter((file) => ALLOWED_ARDUINO_SOURCE_EXTS.has(path.extname(file.name).toLowerCase()));

  if (boardFiles.length === 0) {
    return {
      mainCode: String(fallbackMainCode || ''),
      extraFiles: cloneJson(fallbackExtraFiles || []),
    };
  }

  const preferredMainName = `${String(boardId || '').trim()}.ino`;
  const mainFile = boardFiles.find((file) => file.name.toLowerCase() === preferredMainName.toLowerCase())
    || boardFiles.find((file) => path.extname(file.name).toLowerCase() === '.ino')
    || boardFiles[0];

  const extraFiles = boardFiles
    .filter((file) => file.name !== mainFile.name)
    .map((file) => ({ name: file.name, content: file.content }));

  return {
    mainCode: String(mainFile.content || fallbackMainCode || ''),
    extraFiles,
  };
}

function resolveMicroPythonScript(caseId: string, boardId: string, fallbackScript: string): string {
  const fixtureFiles = resolveFixtureBoardFiles(caseId, boardId)
    .filter((file) => path.extname(file.name).toLowerCase() === '.py')
    .map((file) => ({ name: file.name, content: file.content }));

  if (fixtureFiles.length > 0) {
    const bundled = bundleMicroPythonFiles(fixtureFiles);
    if (bundled.trim()) return bundled;
  }

  const fixture = loadJsonExampleFixture(caseId);
  if (fixture && typeof fixture.code === 'string' && fixture.code.trim()) {
    return bundleMicroPythonFiles([{ name: 'main.py', content: fixture.code }]) || String(fixture.code || '');
  }

  return String(fallbackScript || '');
}

function loadMicroPythonUf2Payload(): string {
  if (micropythonUf2PayloadCache.value) return micropythonUf2PayloadCache.value;

  if (!fs.existsSync(MICROPYTHON_UF2_PATH)) {
    throw new Error(`MicroPython UF2 not found: ${MICROPYTHON_UF2_PATH}`);
  }

  const uf2Data = fs.readFileSync(MICROPYTHON_UF2_PATH);
  micropythonUf2PayloadCache.value = `${UF2_PAYLOAD_PREFIX}${uf2Data.toString('base64')}`;
  return micropythonUf2PayloadCache.value;
}

function loadCircuitPythonUf2Payload(): string {
  if (circuitpythonUf2PayloadCache.value) return circuitpythonUf2PayloadCache.value;

  if (!fs.existsSync(CIRCUITPYTHON_UF2_PATH)) {
    throw new Error(`CircuitPython UF2 not found: ${CIRCUITPYTHON_UF2_PATH}`);
  }

  const uf2Data = fs.readFileSync(CIRCUITPYTHON_UF2_PATH);
  circuitpythonUf2PayloadCache.value = `${UF2_PAYLOAD_PREFIX}${uf2Data.toString('base64')}`;
  return circuitpythonUf2PayloadCache.value;
}

async function buildRp2040RuntimeFsPartitions(
  runtimeFiles: Array<{ path: string; content: string }>,
  env: Rp2040RuntimeEnv,
): Promise<Array<{ offset: number; data: Uint8Array }> | undefined> {
  if (!Array.isArray(runtimeFiles) || runtimeFiles.length === 0) return undefined;

  const fsOffset = getRp2040PythonFsOffset(env);
  const fsBytes = getRp2040PythonFsBytes(env);
  if (fsBytes <= 0) return undefined;

  const fsFiles = runtimeFiles.map((file) => ({ path: file.path, data: String(file.content || '') }));
  const image = env === 'circuitpython'
    ? buildFatFsImage(fsFiles, {
      sizeBytes: fsBytes,
      volumeLabel: 'CIRCUITPY',
    })
    : await buildLittleFsImage(fsFiles, {
      sizeBytes: fsBytes,
      blockSize: RP2040_LITTLEFS_BLOCK_SIZE,
    });
  if (!image || image.length === 0) return undefined;

  return [{
    offset: fsOffset,
    data: image,
  }];
}

function buildMicroPythonRawPayload(scriptSource: string): string {
  const normalized = String(scriptSource || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\u0004/g, ''))
    .join('\n');
  return `\u0001${normalized}\n\u0004`;
}

function buildMicroPythonReplProbe(): string {
  return '\r\n';
}

function buildCircuitPythonInjectedScript(runtimeFiles: Array<{ path: string; content: string }>): string {
  const files = Array.isArray(runtimeFiles) ? runtimeFiles : [];
  if (files.length === 0) return '';

  const normalizeModuleName = (runtimePath: string): string | null => {
    const normalized = normalizeRuntimePath(runtimePath);
    if (!normalized || !normalized.toLowerCase().endsWith('.py')) return null;
    if (normalized.includes('/')) return null;
    const stem = normalized.slice(0, -3);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(stem)) return null;
    if (stem === 'code' || stem === 'main') return null;
    return stem;
  };

  const escapeRegExp = (value: string): string => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const mainFile = files.find((file) => String(file.path || '').toLowerCase() === 'code.py')
    || files.find((file) => String(file.path || '').toLowerCase() === 'main.py')
    || files.find((file) => String(file.path || '').toLowerCase().endsWith('.py'))
    || null;
  if (!mainFile) return '';

  let mainSource = String(mainFile.content || '');
  const lines: string[] = [];

  for (const file of files) {
    const moduleName = normalizeModuleName(String(file.path || ''));
    if (!moduleName) continue;

    const importFromPattern = new RegExp(`^\\s*from\\s+${escapeRegExp(moduleName)}\\s+import\\s+.*$`, 'gm');
    const importModulePattern = new RegExp(`^\\s*import\\s+${escapeRegExp(moduleName)}\\s*$`, 'gm');
    mainSource = mainSource.replace(importFromPattern, '');
    mainSource = mainSource.replace(importModulePattern, '');

    lines.push(String(file.content || ''));
    lines.push('');
  }

  lines.push(mainSource);
  lines.push('');
  return lines.join('\n');
}

function scheduleMicroPythonInject(
  target: any,
  boardId: string,
  pyScript: string,
  baudOverride: number,
  timeoutMs = 4500,
): void {
  const rawPayload = buildMicroPythonRawPayload(pyScript);
  const replProbePayload = buildMicroPythonReplProbe();
  const startedAt = Date.now();
  let uartBuf = '';
  let finalized = false;
  let probeTimer: any = null;
  let timeoutGuard: any = null;
  let injectedOnce = false;
  let restoreUart0OnByte: (() => void) | null = null;

  const clearTimers = () => {
    if (probeTimer) {
      clearInterval(probeTimer);
      probeTimer = null;
    }
    if (timeoutGuard) {
      clearTimeout(timeoutGuard);
      timeoutGuard = null;
    }
  };

  const finalize = () => {
    if (finalized) return;
    finalized = true;
    clearTimers();
    if (restoreUart0OnByte) {
      restoreUart0OnByte();
      restoreUart0OnByte = null;
    }
  };

  const sendProbe = () => {
    if (finalized) return;
    target.setSerialBaudRate(baudOverride);
    target.serialRx(replProbePayload);
  };

  const sendRawOnce = () => {
    if (finalized || injectedOnce) return;
    injectedOnce = true;
    const targetAny = target as any;
    if (Array.isArray(targetAny?.serialBuffer)) {
      targetAny.serialBuffer.length = 0;
    }
    target.setSerialBaudRate(baudOverride);
    target.serialRx(rawPayload);
    finalize();
  };

  const shouldForceInjectFromBootTraffic = () => {
    const targetAny = target as any;
    const waitedMs = Date.now() - startedAt;
    if (waitedMs < 900) return false;

    const txBytes = Number(targetAny?.debugSerialTxBytes || 0);
    const activeUart = Number(targetAny?.activeUartIndex ?? -1);
    const usbReady = !!targetAny?.usbCdcReady;

    if (txBytes >= 64 && (activeUart === 2 || usbReady)) return true;
    if (txBytes >= 192) return true;
    return false;
  };

  const patchUart = () => {
    const cpu = (target as any).cpu;
    if (!cpu?.uart?.[0]) return false;
    const prev = cpu.uart[0].onByte;
    const patched = (value: number) => {
      if (prev) prev(value);
      if (finalized) return;

      uartBuf += String.fromCharCode(value);
      if (uartBuf.length > 32) uartBuf = uartBuf.slice(-32);
      if (uartBuf.includes('>>>')) sendRawOnce();
    };
    cpu.uart[0].onByte = patched;
    restoreUart0OnByte = () => {
      if ((cpu as any)?.uart?.[0]?.onByte === patched) {
        cpu.uart[0].onByte = prev;
      }
    };
    return true;
  };

  let patchAttempts = 0;
  const tryPatch = () => {
    if (finalized) return;
    if (patchUart()) return;
    if (++patchAttempts < 10) setTimeout(tryPatch, 50);
  };
  tryPatch();

  setTimeout(() => {
    if (finalized) return;
    sendProbe();
  }, 500);

  probeTimer = setInterval(() => {
    if (finalized) {
      clearTimers();
      return;
    }
    if (shouldForceInjectFromBootTraffic()) {
      sendRawOnce();
      return;
    }
    sendProbe();
  }, 900);

  timeoutGuard = setTimeout(() => {
    if (!finalized) sendRawOnce();
  }, timeoutMs);
}

function attachBehaviorChecks(report: CaseReport, checks: Record<string, boolean>) {
  const normalizedChecks = Object.fromEntries(
    Object.entries(checks || {}).map(([key, value]) => [key, !!value]),
  );
  report.details.behaviorChecks = normalizedChecks;
  const summary = Object.entries(normalizedChecks)
    .map(([key, value]) => `${key}:${value ? 'OK' : 'NO'}`)
    .join(', ');
  report.summary = `${report.summary} | checks=${summary || 'none'}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeSerial(text: string): string {
  return String(text || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function sanitizeSketchName(name: string): string {
  const raw = String(name || '').trim() || 'sketch';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function sanitizeSourceName(name: string): string {
  const base = path.basename(String(name || '').trim());
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function compactComponentState(state: any): Record<string, any> {
  if (!state || typeof state !== 'object') return {};
  const out: Record<string, any> = {};

  for (const [key, value] of Object.entries(state)) {
    if (Array.isArray(value)) {
      out[key] = value.length > 8 ? `[array:${value.length}]` : value;
      continue;
    }
    if (value && typeof value === 'object') {
      if (ArrayBuffer.isView(value)) {
        out[key] = `[typed-array:${(value as any).length ?? 0}]`;
      } else {
        out[key] = '[object]';
      }
      continue;
    }
    out[key] = value;
  }

  return out;
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

function compileArduinoSketch({
  fqbn,
  sketchName,
  mainCode,
  extraFiles = [],
}: {
  fqbn: string;
  sketchName: string;
  mainCode: string;
  extraFiles?: Array<{ name: string; content: string }>;
}): CompileArtifact {
  const safeSketchName = sanitizeSketchName(sketchName || 'Sketch');
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), `cli-matrix-${safeSketchName}-`));
  const sketchDir = path.join(tmpBase, safeSketchName);
  const buildDir = path.join(tmpBase, 'build');

  fs.mkdirSync(sketchDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });

  const mainInoPath = path.join(sketchDir, `${safeSketchName}.ino`);
  fs.writeFileSync(mainInoPath, String(mainCode || ''), 'utf8');

  const sourceFiles = Array.isArray(extraFiles) ? extraFiles : [];
  for (const src of sourceFiles) {
    if (!src || typeof src.name !== 'string') continue;
    const safeName = sanitizeSourceName(src.name);
    const ext = path.extname(safeName).toLowerCase();
    if (!ALLOWED_ARDUINO_SOURCE_EXTS.has(ext)) continue;
    fs.writeFileSync(path.join(sketchDir, safeName), String(src.content || ''), 'utf8');
  }

  const args = [
    'compile',
    '--fqbn',
    String(fqbn || 'arduino:avr:uno'),
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
  const lowerFqbn = String(fqbn || '').toLowerCase();
  const preferredExts = lowerFqbn.includes('rp2040')
    ? ['.uf2', '.hex']
    : ['.hex', '.uf2'];

  for (const ext of preferredExts) {
    const artifactName = outFiles.find((f) => f.toLowerCase().endsWith(ext));
    if (!artifactName) continue;

    const artifactPath = path.join(buildDir, artifactName);
    if (ext === '.hex') {
      return {
        payload: fs.readFileSync(artifactPath, 'utf8'),
        artifactType: 'hex',
        artifactPath,
        compileStdout: proc.stdout || '',
      };
    }

    return {
      payload: `UF2BASE64:${fs.readFileSync(artifactPath).toString('base64')}`,
      artifactType: 'uf2',
      artifactPath,
      compileStdout: proc.stdout || '',
    };
  }

  throw new Error(`Compile succeeded but no .uf2 or .hex found in ${buildDir}. Files: ${outFiles.join(', ')}`);
}

function makePicoBoard(id = 'pico1') {
  return {
    id,
    type: 'wokwi-raspberry-pi-pico',
    attrs: { env: 'ino', builder: 'arduino-pico' },
  };
}

function makeUnoBoard(id = 'uno1') {
  return {
    id,
    type: 'wokwi-arduino-uno',
    attrs: {},
  };
}

function makeWs2812Circuit(): CircuitFixture {
  const components = [
    makePicoBoard('pico1'),
    { id: 'ws1', type: 'wokwi-ws2812b', attrs: {} },
  ];

  const wires = [
    { from: 'pico1:GND', to: 'ws1:GND' },
    { from: 'pico1:3V3', to: 'ws1:VCC' },
    { from: 'pico1:GP2', to: 'ws1:DIN' },
  ];

  return { components, wires };
}

function makeServoPotCircuit(): CircuitFixture {
  const components = [
    makePicoBoard('pico1'),
    { id: 'servo1', type: 'wokwi-servo', attrs: {} },
    { id: 'pot1', type: 'wokwi-slide-potentiometer', attrs: { value: 72 } },
  ];

  const wires = [
    { from: 'pico1:GND', to: 'servo1:GND' },
    { from: 'pico1:3V3', to: 'servo1:V+' },
    { from: 'pico1:GP15', to: 'servo1:PWM' },

    { from: 'pico1:GND', to: 'pot1:GND' },
    { from: 'pico1:3V3', to: 'pot1:VCC' },
    { from: 'pico1:GP26', to: 'pot1:SIG' },
  ];

  return { components, wires };
}

function makeMax7219Circuit(): CircuitFixture {
  const components = [
    makePicoBoard('pico1'),
    { id: 'max1', type: 'wokwi-max7219', attrs: {} },
  ];

  const wires = [
    { from: 'pico1:3V3', to: 'max1:VCC' },
    { from: 'pico1:GND', to: 'max1:GND' },
    { from: 'pico1:GP19', to: 'max1:DIN' },
    { from: 'pico1:GP18', to: 'max1:CLK' },
    { from: 'pico1:GP17', to: 'max1:CS' },
  ];

  return { components, wires };
}

function makePicoLoopbackCircuit(): CircuitFixture {
  const components = [
    makePicoBoard('pico1'),
    { id: 'led1', type: 'wokwi-led', attrs: { color: 'green' } },
  ];

  const wires = [
    { from: 'pico1:GP0', to: 'pico1:GP1' },
    { from: 'pico1:GP15', to: 'led1:A' },
    { from: 'pico1:GND', to: 'led1:K' },
  ];

  return { components, wires };
}

function makePicoMicroPythonMixedCircuit(): CircuitFixture {
  const components = [
    makePicoBoard('pico1'),
    { id: 'led1', type: 'wokwi-led', attrs: { color: 'red' } },
    { id: 'pot1', type: 'wokwi-slide-potentiometer', attrs: { value: 64 } },
    { id: 'servo1', type: 'wokwi-servo', attrs: {} },
    { id: 'ws1', type: 'wokwi-ws2812b', attrs: {} },
    { id: 'oled1', type: 'wokwi-ssd1306-oled', attrs: {} },
  ];

  const wires = [
    { from: 'pico1:GP16', to: 'led1:A' },
    { from: 'pico1:GND', to: 'led1:K' },

    { from: 'pico1:GND', to: 'pot1:GND' },
    { from: 'pico1:3V3', to: 'pot1:VCC' },
    { from: 'pico1:GP26', to: 'pot1:SIG' },

    { from: 'pico1:GND', to: 'servo1:GND' },
    { from: 'pico1:3V3', to: 'servo1:V+' },
    { from: 'pico1:GP15', to: 'servo1:PWM' },

    { from: 'pico1:GND', to: 'ws1:GND' },
    { from: 'pico1:3V3', to: 'ws1:VCC' },
    { from: 'pico1:GP2', to: 'ws1:DIN' },

    { from: 'pico1:GND', to: 'oled1:GND' },
    { from: 'pico1:3V3', to: 'oled1:VCC' },
    { from: 'pico1:GP5', to: 'oled1:SCL' },
    { from: 'pico1:GP4', to: 'oled1:SDA' },
  ];

  return { components, wires };
}

function makePicoMixedIoCircuit(): CircuitFixture {
  const base = makePicoMicroPythonMixedCircuit();
  const components = [...base.components, { id: 'buzz1', type: 'wokwi-buzzer', attrs: {} }];
  const wires = [
    ...base.wires,
    { from: 'pico1:GP18', to: 'buzz1:1' },
    { from: 'pico1:GND', to: 'buzz1:2' },
  ];
  return { components, wires };
}

function makePicoOledCircuit(): CircuitFixture {
  const components = [
    makePicoBoard('pico1'),
    { id: 'oled1', type: 'wokwi-ssd1306-oled', attrs: {} },
  ];

  const wires = [
    { from: 'pico1:GND', to: 'oled1:GND' },
    { from: 'pico1:3V3', to: 'oled1:VCC' },
    { from: 'pico1:GP5', to: 'oled1:SCL' },
    { from: 'pico1:GP4', to: 'oled1:SDA' },
  ];

  return { components, wires };
}

async function runSingleBoardCase(
  caseId: string,
  boardType: string,
  firmwarePayload: string,
  durationMs: number,
  options: SingleBoardCaseOptions,
): Promise<{ report: CaseReport; events: WorkerEvent[]; serialText: string }> {
  const events: WorkerEvent[] = [];
  const pinSnapshots: Array<Record<string, boolean>> = [];
  const componentLastState: Record<string, any> = {};
  const componentUpdateCount: Record<string, number> = {};
  const debugReasons = new Set<string>();
  const debugSerial = { txBytesMax: 0, rxBytesMax: 0 };
  let serialText = '';
  let faultCount = 0;

  const boardId = String(options.boardId || options.circuit?.components?.[0]?.id || 'board1');
  const serialInputTimers: Array<ReturnType<typeof setTimeout>> = [];
  let acceptStateUpdates = true;

  let runner: any = null;

  runner = createRunnerForBoard(
    boardType,
    String(firmwarePayload || ''),
    options.circuit.components,
    options.circuit.wires,
    (msg: any) => {
      const event: WorkerEvent = {
        ts: nowIso(),
        type: String(msg?.type || 'unknown'),
        boardId: String(msg?.boardId || boardId),
      };

      if (msg?.type === 'debug' && msg?.category === 'rp2040-runtime') {
        event.reason = String(msg.reason || 'tick');
        event.metrics = msg.metrics || {};
        debugReasons.add(event.reason);
        debugSerial.txBytesMax = Math.max(
          debugSerial.txBytesMax,
          Number(event.metrics?.serialTxBytes || 0),
        );
        debugSerial.rxBytesMax = Math.max(
          debugSerial.rxBytesMax,
          Number(event.metrics?.serialRxBytes || 0),
        );
      } else if (msg?.type === 'state') {
        if (!acceptStateUpdates) {
          return;
        }
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
      boardId,
      serialBaudRate: Number(options.serialBaudRate || 9600),
      debugEnabled: /rp2040|pico/i.test(String(boardType || '')),
      debugIntervalMs: 300,
      pyScript: options.pyScript,
      rp2040LogicalFlashBytes: options.rp2040LogicalFlashBytes,
      rp2040FlashPartitions: options.rp2040FlashPartitions,
      onByteTransmit: ({ boardId: txBoardId, value, char, source }) => {
        serialText += String(char || '');
        events.push({
          ts: nowIso(),
          type: 'serial',
          boardId: String(txBoardId || boardId),
          data: String(char || ''),
          value: Number(value ?? 0),
          source: String(source || 'uart0'),
        });

        if (options.loopbackToSelf && runner && String(txBoardId || boardId) === boardId) {
          const sourceLabel = String(source || 'uart0');
          if (typeof runner.serialRxByteFromSource === 'function') {
            runner.serialRxByteFromSource(Number(value ?? 0), sourceLabel);
          } else if (typeof runner.serialRxByte === 'function') {
            runner.serialRxByte(Number(value ?? 0));
          }
        }
      },
    },
  );

  const pyScript = String(options.pyScript || '').trim();
  if (pyScript && /rp2040|pico/i.test(String(boardType || '')) && runner?.cpu?.uart?.[0]) {
    scheduleMicroPythonInject(
      runner,
      boardId,
      pyScript,
      Number(options.serialBaudRate || 115200),
    );
  }

  const circuitPythonScript = String(options.circuitPythonScript || '').trim();
  if (circuitPythonScript && /rp2040|pico/i.test(String(boardType || ''))) {
    const waitForUsbMs = Math.max(1000, Number(options.circuitPythonWaitMs || 9000));
    const sendByte = (byte: number, source: string = 'usb') => {
      if (!runner) return;
      if (typeof runner.serialRxByteFromSource === 'function') {
        runner.serialRxByteFromSource(byte & 0xff, source);
      } else if (typeof runner.serialRxByte === 'function') {
        runner.serialRxByte(byte & 0xff);
      } else if (typeof runner.serialRx === 'function') {
        runner.serialRx(String.fromCharCode(byte & 0xff));
      }
    };

    const streamText = (
      text: string,
      source: string,
      chunkSize = 8,
      everyMs = 10,
      onDone?: () => void,
    ) => {
      const bytes = Array.from(text || '', (ch) => ch.charCodeAt(0) & 0xff);
      if (bytes.length === 0) {
        if (typeof onDone === 'function') onDone();
        return;
      }

      let index = 0;
      const streamTimer = setInterval(() => {
        if (!runner) {
          clearInterval(streamTimer);
          return;
        }

        const end = Math.min(index + chunkSize, bytes.length);
        for (let i = index; i < end; i++) {
          sendByte(bytes[i], source);
        }
        index = end;

        if (index >= bytes.length) {
          clearInterval(streamTimer);
          if (typeof onDone === 'function') {
            onDone();
          }
        }
      }, Math.max(1, everyMs));

      serialInputTimers.push(streamTimer as unknown as ReturnType<typeof setTimeout>);
    };

    const startedAt = Date.now();
    let injected = false;
    const timer = setInterval(() => {
      if (!runner || injected) return;

      const usbReady = !!(runner as any)?.usbCdcReady;
      const waitedMs = Date.now() - startedAt;
      if (!usbReady && waitedMs < waitForUsbMs) {
        return;
      }

      const transportSource = usbReady ? 'usb' : 'uart0';

      injected = true;
      clearInterval(timer);

      // Stage CP raw-REPL injection and wait for the raw prompt before script payload.
      streamText('x\r', transportSource, 1, 24);
      const interruptTimer = setTimeout(() => {
        streamText('\u0003\u0003', transportSource, 1, 30);
      }, 80);
      serialInputTimers.push(interruptTimer);

      const enterRawTimer = setTimeout(() => {
        streamText('\u0001', transportSource, 1, 30);
      }, 260);
      serialInputTimers.push(enterRawTimer);

      const rawPromptStartedAt = Date.now();
      let scriptDispatched = false;
      const dispatchScript = () => {
        if (scriptDispatched || !runner) return;
        scriptDispatched = true;
        const scriptPayload = `${circuitPythonScript}\n`;
        streamText(scriptPayload, transportSource, 64, 8, () => {
          // Send Ctrl-D with a small tail delay, then repeat once for robustness.
          const ctrlD1 = setTimeout(() => sendByte(0x04, transportSource), 120);
          const ctrlD2 = setTimeout(() => sendByte(0x04, transportSource), 1500);
          serialInputTimers.push(ctrlD1, ctrlD2);
        });
      };

      const rawPromptPoll = setInterval(() => {
        if (!runner || scriptDispatched) {
          clearInterval(rawPromptPoll);
          return;
        }

        const waitedMs = Date.now() - rawPromptStartedAt;
        if (/raw REPL; CTRL-B to exit[\s\S]*>\s*$/.test(serialText)) {
          dispatchScript();
          clearInterval(rawPromptPoll);
          return;
        }

        // Fall back to sending script after bounded wait.
        if (waitedMs >= 3500) {
          dispatchScript();
          clearInterval(rawPromptPoll);
        }
      }, 80);
      serialInputTimers.push(rawPromptPoll as unknown as ReturnType<typeof setTimeout>);
    }, 120);
    serialInputTimers.push(timer as unknown as ReturnType<typeof setTimeout>);
  }

  const serialInputs = Array.isArray(options.serialInputs) ? options.serialInputs : [];
  for (const item of serialInputs) {
    if (!item || typeof item !== 'object') continue;
    const delayMs = Math.max(0, Number(item.delayMs || 0));
    const payload = String(item.data || '');
    if (!payload) continue;
    const source = String(item.source || '').trim().toLowerCase() || 'uart0';

    const timer = setTimeout(() => {
      if (!runner) return;
      for (let i = 0; i < payload.length; i++) {
        const byte = payload.charCodeAt(i) & 0xff;
        if (typeof runner.serialRxByteFromSource === 'function') {
          runner.serialRxByteFromSource(byte, source);
        } else if (typeof runner.serialRxByte === 'function') {
          runner.serialRxByte(byte);
        } else if (typeof runner.serialRx === 'function') {
          runner.serialRx(String.fromCharCode(byte));
        }
      }
    }, delayMs);
    serialInputTimers.push(timer);
  }

  await sleep(durationMs);

  const componentPinVoltages: Record<string, Record<string, number>> = {};
  try {
    const instances = (runner as any)?.instances;
    if (instances && typeof instances.entries === 'function') {
      for (const [componentId, instance] of instances.entries()) {
        const pinMap = (instance as any)?.pins;
        if (!pinMap || typeof pinMap !== 'object') continue;
        const voltageByPin: Record<string, number> = {};
        for (const [pinName, pinObj] of Object.entries(pinMap)) {
          const voltage = Number((pinObj as any)?.voltage);
          if (Number.isFinite(voltage)) {
            voltageByPin[String(pinName)] = voltage;
          }
        }
        if (Object.keys(voltageByPin).length > 0) {
          componentPinVoltages[String(componentId)] = voltageByPin;
        }
      }
    }
  } catch {
    // no-op
  }

  try {
    acceptStateUpdates = false;
    runner.stop();
  } catch {
    // no-op
  }


  for (const timer of serialInputTimers) {
    clearTimeout(timer);
  }

  const pinSummary = summarizePinActivity(pinSnapshots);
  const cleanSerial = sanitizeSerial(serialText);
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
      changedPins: pinSummary.changedPins,
      componentUpdateCount,
      componentPinVoltages,
      componentLastState: Object.fromEntries(
        Object.entries(componentLastState).map(([id, state]) => [id, compactComponentState(state)]),
      ),
      debugSerial,
      serialPreview: cleanSerial.slice(0, 600),
      stateSamples: pinSnapshots.length,
    },
  };

  return { report, events, serialText: cleanSerial };
}

function buildNetIndex(wires: Array<{ from: string; to: string }>): Map<string, number> {
  const pinToNet = new Map<string, number>();
  let nextNetId = 1;

  const aliasesFor = (endpoint: string) => endpointAliases(String(endpoint || ''));

  const mergeNets = (keepNet: number, dropNet: number) => {
    if (keepNet === dropNet) return;
    for (const [pin, net] of pinToNet.entries()) {
      if (net === dropNet) pinToNet.set(pin, keepNet);
    }
  };

  for (const wire of (wires || [])) {
    const left = aliasesFor(String(wire?.from || ''));
    const right = aliasesFor(String(wire?.to || ''));
    const allPins = [...left, ...right];
    if (allPins.length === 0) continue;

    const seenNets = Array.from(new Set(
      allPins
        .map((pin) => pinToNet.get(pin))
        .filter((net) => typeof net === 'number') as number[],
    ));

    let net = seenNets.length > 0 ? seenNets[0] : nextNetId++;

    if (seenNets.length > 1) {
      for (let i = 1; i < seenNets.length; i++) {
        mergeNets(net, seenNets[i]);
      }
    }

    for (const pin of allPins) {
      pinToNet.set(pin, net);
    }
  }

  return pinToNet;
}

function isConnectedByNet(pinToNet: Map<string, number>, pinA: string, pinB: string): boolean {
  const netA = pinToNet.get(pinA);
  const netB = pinToNet.get(pinB);
  return netA !== undefined && netA === netB;
}

async function runLinkedBoardsCase(
  caseId: string,
  opts: LinkedBoardCaseOptions,
): Promise<{ report: CaseReport; events: WorkerEvent[]; serialText: string }> {
  const events: WorkerEvent[] = [];
  const pinSnapshots: Record<string, Array<Record<string, boolean>>> = {};
  const componentLastState: Record<string, any> = {};
  const componentUpdateCount: Record<string, number> = {};
  const faultCountByBoard: Record<string, number> = {};
  const debugSerialByBoard: Record<string, { txBytesMax: number; rxBytesMax: number }> = {};
  let serialText = '';

  const boardRunners = new Map<string, any>();
  const boardTypes = new Map<string, string>();
  const boardBaud = new Map<string, number>();

  const pinToNet = buildNetIndex(opts.wires || []);
  const areConnected = (a: string, b: string) => isConnectedByNet(pinToNet, a, b);

  const programmable = (opts.components || []).filter((c) => /(arduino|esp32|stm32|rp2040|pico)/i.test(String(c.type || '')));
  const sharedPeripherals = (opts.components || []).filter((c) => !/(arduino|esp32|stm32|rp2040|pico)/i.test(String(c.type || '')));

  const routeUartByte = (sourceBoardId: string, value: number, sourceLabel = 'uart0') => {
    const sourceRunner = boardRunners.get(sourceBoardId);
    const sourceType = boardTypes.get(sourceBoardId) || '';
    const sourceBaud = sourceRunner?.getSerialBaudRate?.() ?? boardBaud.get(sourceBoardId) ?? 9600;

    for (const [targetBoardId, targetRunner] of boardRunners.entries()) {
      if (targetBoardId === sourceBoardId) continue;

      const targetType = boardTypes.get(targetBoardId) || '';
      const uartRoute = resolveUartRoute(
        sourceBoardId,
        sourceType,
        targetBoardId,
        targetType,
        areConnected,
        sourceLabel,
      );
      const softLinked = areBoardsSoftSerialConnected(
        sourceBoardId,
        sourceType,
        targetBoardId,
        targetType,
        areConnected,
      );

      if (!uartRoute.connected && !softLinked) continue;

      try {
        targetRunner.setSerialBaudRate(sourceBaud);
      } catch {
        // no-op
      }

      if (uartRoute.connected && typeof targetRunner.serialRxByteFromSource === 'function') {
        targetRunner.serialRxByteFromSource(value, uartRoute.targetSource || 'uart0');
      } else if (softLinked && typeof targetRunner.softSerialRxByte === 'function') {
        targetRunner.softSerialRxByte(value);
      } else {
        targetRunner.serialRxByte(value);
      }
    }
  };

  for (const board of opts.boards) {
    const boardComp = programmable.find((c) => c.id === board.id);
    if (!boardComp) {
      throw new Error(`Missing board component ${board.id} in linked case ${caseId}.`);
    }

    const runnerComponents = [boardComp, ...sharedPeripherals];

    const runner = createRunnerForBoard(
      String(board.type || ''),
      String(board.firmwarePayload || ''),
      runnerComponents,
      opts.wires,
      (msg: any) => {
        const event: WorkerEvent = {
          ts: nowIso(),
          type: String(msg?.type || 'unknown'),
          boardId: String(msg?.boardId || board.id),
        };

        if (msg?.type === 'debug') {
          event.reason = String(msg.reason || msg.category || 'debug');
          event.metrics = msg.metrics || {};
          const debugBoardId = String(msg?.boardId || board.id);
          if (!debugSerialByBoard[debugBoardId]) {
            debugSerialByBoard[debugBoardId] = { txBytesMax: 0, rxBytesMax: 0 };
          }
          debugSerialByBoard[debugBoardId].txBytesMax = Math.max(
            debugSerialByBoard[debugBoardId].txBytesMax,
            Number(event.metrics?.serialTxBytes || 0),
          );
          debugSerialByBoard[debugBoardId].rxBytesMax = Math.max(
            debugSerialByBoard[debugBoardId].rxBytesMax,
            Number(event.metrics?.serialRxBytes || 0),
          );
        }

        if (msg?.type === 'state') {
          const id = String(msg?.boardId || board.id);
          if (!pinSnapshots[id]) pinSnapshots[id] = [];
          if (msg?.pins) pinSnapshots[id].push({ ...(msg.pins || {}) });

          if (Array.isArray(msg?.components)) {
            for (const comp of msg.components) {
              const compId = String(comp?.id || '');
              if (!compId) continue;
              componentLastState[compId] = comp?.state ?? {};
              componentUpdateCount[compId] = Number(componentUpdateCount[compId] || 0) + 1;
            }
          }
        } else if (msg?.type === 'fault') {
          const id = String(msg?.boardId || board.id);
          faultCountByBoard[id] = Number(faultCountByBoard[id] || 0) + 1;
          event.pc = Number(msg.pc ?? 0);
          event.message = String(msg.reason || 'fault');
        }

        events.push(event);
      },
      {
        boardId: board.id,
        serialBaudRate: Number(board.serialBaudRate || 9600),
        debugEnabled: /rp2040|pico/i.test(String(board.type || '')),
        debugIntervalMs: 300,
        pyScript: board.pyScript,
        onByteTransmit: ({ boardId, value, char, source }) => {
          serialText += String(char || '');
          events.push({
            ts: nowIso(),
            type: 'serial',
            boardId: String(boardId || board.id),
            data: String(char || ''),
            value: Number(value ?? 0),
            source: String(source || 'uart0'),
          });
          routeUartByte(String(boardId || board.id), Number(value ?? 0), String(source || 'uart0'));
        },
      },
    );

    boardRunners.set(board.id, runner);
    boardTypes.set(board.id, String(board.type || ''));
    boardBaud.set(board.id, Number(board.serialBaudRate || 9600));

    const pyScript = String(board.pyScript || '').trim();
    if (pyScript && /rp2040|pico/i.test(String(board.type || '')) && runner?.cpu?.uart?.[0]) {
      scheduleMicroPythonInject(
        runner,
        board.id,
        pyScript,
        Number(board.serialBaudRate || 115200),
      );
    }
  }

  await sleep(Number(opts.durationMs || 3000));

  for (const runner of boardRunners.values()) {
    try {
      runner.stop();
    } catch {
      // no-op
    }
  }

  const cleanSerial = sanitizeSerial(serialText);
  const totalFaults = Object.values(faultCountByBoard).reduce((sum, v) => sum + Number(v || 0), 0);

  const perBoardPinSummary = Object.fromEntries(
    Object.entries(pinSnapshots).map(([boardId, snaps]) => [boardId, summarizePinActivity(snaps)]),
  );

  const report: CaseReport = {
    caseId,
    pass: true,
    summary: [
      `events=${events.length}`,
      `faults=${totalFaults}`,
      `boards=${opts.boards.length}`,
      `serialLen=${cleanSerial.length}`,
    ].join(' | '),
    details: {
      faultCountByBoard,
      boardPinActivity: Object.fromEntries(
        Object.entries(perBoardPinSummary).map(([id, s]) => [id, s.changedPins]),
      ),
      componentUpdateCount,
      debugSerialByBoard,
      componentLastState: Object.fromEntries(
        Object.entries(componentLastState).map(([id, state]) => [id, compactComponentState(state)]),
      ),
      serialPreview: cleanSerial.slice(0, 800),
    },
  };

  return { report, events, serialText: cleanSerial };
}

function bundleMicroPythonFiles(files: Array<{ name: string; content: string }>): string {
  const pyFiles = (Array.isArray(files) ? files : [])
    .map((f) => ({
      name: sanitizeSourceName(f?.name || ''),
      content: String(f?.content || ''),
    }))
    .filter((f) => f.name.toLowerCase().endsWith('.py'));

  if (pyFiles.length === 0) return '';

  const main = pyFiles.find((f) => f.name.toLowerCase() === 'main.py') || pyFiles[0];
  const support = pyFiles.filter((f) => f.name !== main.name);
  const moduleNames = support.map((f) => f.name.replace(/\.py$/i, ''));

  let bundledMain = String(main.content || '');
  for (const moduleName of moduleNames) {
    const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const importLine = new RegExp(`^\\s*(from\\s+${escaped}\\s+import\\s+.+|import\\s+${escaped}(?:\\s+as\\s+\\w+)?)\\s*$`, 'gmi');
    bundledMain = bundledMain.replace(importLine, '');
  }

  const supportBlocks = support
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => `# --- ${f.name} ---\n${String(f.content || '').trim()}\n`)
    .join('\n');

  return `${supportBlocks}\n# --- main.py ---\n${bundledMain.trim()}\n`;
}

function makePicoWs2812Sketch(): string {
  return [
    '#include <Arduino.h>',
    '',
    'static const int DATA_PIN = 2;',
    '',
    'void sendBit(bool bitValue) {',
    '  digitalWrite(DATA_PIN, HIGH);',
    '  delayMicroseconds(bitValue ? 2 : 1);',
    '  digitalWrite(DATA_PIN, LOW);',
    '  delayMicroseconds(bitValue ? 1 : 2);',
    '}',
    '',
    'void sendByte(uint8_t value) {',
    '  for (int i = 7; i >= 0; --i) {',
    '    sendBit(((value >> i) & 0x1) != 0);',
    '  }',
    '}',
    '',
    'void sendPixel(uint8_t r, uint8_t g, uint8_t b) {',
    '  sendByte(g);',
    '  sendByte(r);',
    '  sendByte(b);',
    '}',
    '',
    'void sendReset() {',
    '  digitalWrite(DATA_PIN, LOW);',
    '  delayMicroseconds(80);',
    '}',
    '',
    'void setup() {',
    '  pinMode(DATA_PIN, OUTPUT);',
    '  Serial1.setTX(0);',
    '  Serial1.setRX(1);',
    '  Serial1.begin(115200);',
    '  Serial1.println("WS2812_BOOT");',
    '}',
    '',
    'void loop() {',
    '  sendReset();',
    '  sendPixel(0x30, 0x08, 0x20);',
    '  sendReset();',
    '  Serial1.println("WS2812_SENT");',
    '  delay(25);',
    '}',
    '',
  ].join('\n');
}

function makePicoServoPotSketch(): string {
  return [
    '#include <Arduino.h>',
    '',
    'static const int SERVO_PIN = 15;',
    'static const int POT_PIN = A0;',
    'static uint32_t g_loops = 0;',
    '',
    'void pulseServo(int pulseUs) {',
    '  pulseUs = constrain(pulseUs, 544, 2400);',
    '  digitalWrite(SERVO_PIN, HIGH);',
    '  delayMicroseconds(pulseUs);',
    '  digitalWrite(SERVO_PIN, LOW);',
    '  const int restUs = 20000 - pulseUs;',
    '  if (restUs > 0) delayMicroseconds(restUs);',
    '}',
    '',
    'void setup() {',
    '  pinMode(SERVO_PIN, OUTPUT);',
    '  Serial1.setTX(0);',
    '  Serial1.setRX(1);',
    '  Serial1.begin(115200);',
    '  Serial1.println("SERVO_POT_BOOT");',
    '}',
    '',
    'void loop() {',
    '  const int raw = analogRead(POT_PIN);',
    '  const int angle = (int)((g_loops * 7u) % 181u);',
    '  const int pulseUs = map(angle, 0, 180, 544, 2400);',
    '  pulseServo(pulseUs);',
    '  if ((g_loops++ & 0x7u) == 0u) {',
    '    Serial1.print("SERVO_RAW=");',
    '    Serial1.print(raw);',
    '    Serial1.print(" ANG=");',
    '    Serial1.println(angle);',
    '  }',
    '}',
    '',
  ].join('\n');
}

function makePicoMax7219Sketch(): string {
  return [
    '#include <Arduino.h>',
    '#include <SPI.h>',
    '',
    'static const int PIN_CS = 17;',
    '',
    'void sendReg(uint8_t reg, uint8_t value) {',
    '  digitalWrite(PIN_CS, LOW);',
    '  SPI.transfer(reg);',
    '  SPI.transfer(value);',
    '  digitalWrite(PIN_CS, HIGH);',
    '}',
    '',
    'void setup() {',
    '  pinMode(PIN_CS, OUTPUT);',
    '  digitalWrite(PIN_CS, HIGH);',
    '  SPI.setRX(16);',
    '  SPI.setCS(17);',
    '  SPI.setSCK(18);',
    '  SPI.setTX(19);',
    '  SPI.begin();',
    '',
    '  Serial1.setTX(0);',
    '  Serial1.setRX(1);',
    '  Serial1.begin(115200);',
    '  Serial1.println("MAX7219_BOOT");',
    '',
    '  sendReg(0x0C, 0x01);',
    '  sendReg(0x0F, 0x00);',
    '}',
    '',
    'void loop() {',
    '  static uint8_t row = 1;',
    '  static uint8_t pattern = 0x81;',
    '  sendReg(row, pattern);',
    '  row = (row >= 8) ? 1 : (row + 1);',
    '  pattern = (uint8_t)((pattern << 1) | (pattern >> 7));',
    '  Serial1.println("MAX7219_SPI");',
    '  delay(25);',
    '}',
    '',
  ].join('\n');
}

function makePicoLoopbackSketch(): string {
  return [
    '#include <Arduino.h>',
    '',
    'void setup() {',
    '  pinMode(15, OUTPUT);',
    '  digitalWrite(15, LOW);',
    '  Serial1.setTX(0);',
    '  Serial1.setRX(1);',
    '  Serial1.begin(9600);',
    '  Serial1.println("PICO_LOOP_BOOT");',
    '}',
    '',
    'void loop() {',
    '  Serial1.write(\'A\');',
    '  delay(5);',
    '  while (Serial1.available() > 0) {',
    '    const int c = Serial1.read();',
    '    if (c == \"A\"[0]) {',
    '      digitalWrite(15, !digitalRead(15));',
    '      Serial1.println("PICO_LOOP_RX_OK");',
    '    }',
    '  }',
    '  delay(40);',
    '}',
    '',
  ].join('\n');
}

function makePicoOledSketch(): string {
  return [
    '#include <Arduino.h>',
    '#include <Wire.h>',
    '',
    'static const uint8_t OLED_ADDR = 0x3C;',
    'static uint8_t frameCounter = 0;',
    '',
    'void oledCommand(uint8_t cmd) {',
    '  Wire.beginTransmission(OLED_ADDR);',
    '  Wire.write(0x00);',
    '  Wire.write(cmd);',
    '  const int err = Wire.endTransmission();',
    '  Serial1.print("OLED_I2C=");',
    '  Serial1.println(err);',
    '}',
    '',
    'void oledDataBurst(uint8_t valueA, uint8_t valueB) {',
    '  Wire.beginTransmission(OLED_ADDR);',
    '  Wire.write(0x40);',
    '  Wire.write(valueA);',
    '  Wire.write(valueB);',
    '  const int err = Wire.endTransmission();',
    '  Serial1.print("OLED_DATA=");',
    '  Serial1.println(err);',
    '}',
    '',
    'void setup() {',
    '  Serial1.setTX(0);',
    '  Serial1.setRX(1);',
    '  Serial1.begin(115200);',
    '  Wire.setSDA(4);',
    '  Wire.setSCL(5);',
    '  Wire.begin();',
    '  delay(20);',
    '  Serial1.println("OLED_BOOT");',
    '  oledCommand(0xAE);',
    '  oledCommand(0x20);',
    '  oledCommand(0x00);',
    '  oledCommand(0xAF);',
    '}',
    '',
    'void loop() {',
    '  const uint8_t pattern = (frameCounter & 0x01u) ? 0xAA : 0x55;',
    '  oledDataBurst(pattern, (uint8_t)~pattern);',
    '  Serial1.print("OLED_FRAME ");',
    '  Serial1.println(frameCounter);',
    '  frameCounter++;',
    '  delay(60);',
    '}',
    '',
  ].join('\n');
}

function makePicoSenderSketch(ackMarker: string): string {
  return [
    '#include <Arduino.h>',
    '',
    'unsigned long lastSend = 0;',
    '',
    'void setup() {',
    '  pinMode(15, OUTPUT);',
    '  digitalWrite(15, LOW);',
    '  Serial1.setTX(0);',
    '  Serial1.setRX(1);',
    '  Serial1.begin(9600);',
    '  Serial1.println("PICO_SENDER_BOOT");',
    '}',
    '',
    'void loop() {',
    '  if (millis() - lastSend >= 120) {',
    '    lastSend = millis();',
    '    Serial1.write(\'1\');',
    '  }',
    '',
    '  while (Serial1.available() > 0) {',
    '    const int c = Serial1.read();',
    '    if (c == \"K\"[0]) {',
    '      digitalWrite(15, HIGH);',
    `      Serial1.println("${ackMarker}");`,
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');
}

function makePicoReceiverSketch(rxMarker: string): string {
  return [
    '#include <Arduino.h>',
    '',
    'void setup() {',
    '  pinMode(15, OUTPUT);',
    '  digitalWrite(15, LOW);',
    '  Serial1.setTX(0);',
    '  Serial1.setRX(1);',
    '  Serial1.begin(9600);',
    '  Serial1.println("PICO_RX_BOOT");',
    '}',
    '',
    'void loop() {',
    '  while (Serial1.available() > 0) {',
    '    const int c = Serial1.read();',
    '    if (c == \"1\"[0]) {',
    '      digitalWrite(15, !digitalRead(15));',
    '      Serial1.write(\'K\');',
    `      Serial1.println("${rxMarker}");`,
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');
}

function makeUnoSenderSketch(ackMarker: string): string {
  return [
    '#include <Arduino.h>',
    '',
    'unsigned long lastSend = 0;',
    '',
    'void setup() {',
    '  pinMode(13, OUTPUT);',
    '  digitalWrite(13, LOW);',
    '  Serial.begin(9600);',
    '  Serial.println("UNO_TX_BOOT");',
    '}',
    '',
    'void loop() {',
    '  if (millis() - lastSend >= 120) {',
    '    lastSend = millis();',
    '    Serial.write(\'1\');',
    '  }',
    '',
    '  while (Serial.available() > 0) {',
    '    const int c = Serial.read();',
    '    if (c == \"K\"[0]) {',
    '      digitalWrite(13, HIGH);',
    `      Serial.println("${ackMarker}");`,
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');
}

function makeUnoReceiverSketch(rxMarker: string): string {
  return [
    '#include <Arduino.h>',
    '',
    'void setup() {',
    '  pinMode(13, OUTPUT);',
    '  digitalWrite(13, LOW);',
    '  Serial.begin(9600);',
    '  Serial.println("UNO_RX_BOOT");',
    '}',
    '',
    'void loop() {',
    '  while (Serial.available() > 0) {',
    '    const int c = Serial.read();',
    '    if (c == \"1\"[0]) {',
    '      digitalWrite(13, !digitalRead(13));',
    '      Serial.write(\'K\');',
    `      Serial.println("${rxMarker}");`,
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');
}

function makeArduinoMultiFileMainSketch(): string {
  return [
    '#include <Arduino.h>',
    '#include "helper.h"',
    '',
    'void setup() {',
    '  Serial.begin(9600);',
    '  Serial.println("MULTI_BOOT");',
    '}',
    '',
    'void loop() {',
    '  static unsigned long counter = 0;',
    '  if ((counter++ & 0x1Fu) == 0u) {',
    '    Serial.println(helper_message());',
    '  }',
    '  delay(10);',
    '}',
    '',
  ].join('\n');
}

function makeArduinoMultiFileHeader(): string {
  return [
    '#pragma once',
    '',
    'const char* helper_message();',
    '',
  ].join('\n');
}

function makeArduinoMultiFileCpp(): string {
  return [
    '#include "helper.h"',
    '',
    'const char* helper_message() {',
    '  return "MULTI_CPP_OK";',
    '}',
    '',
  ].join('\n');
}

function makeMicroPythonMixedScript(): string {
  return [
    'from machine import Pin',
    'from time import sleep_ms',
    '',
    'print("MP_MIX_BOOT")',
    'led = Pin(16, Pin.OUT, value=0)',
    'servo = Pin(15, Pin.OUT, value=0)',
    'neo = Pin(2, Pin.OUT, value=0)',
    'sda = Pin(4, Pin.OUT, value=0)',
    'scl = Pin(5, Pin.OUT, value=0)',
    '',
    'for i in range(8):',
    '    if i % 2 == 0:',
    '        led.on()',
    '        servo.on()',
    '        neo.on()',
    '        sda.on()',
    '        scl.off()',
    '    else:',
    '        led.off()',
    '        servo.off()',
    '        neo.off()',
    '        sda.off()',
    '        scl.on()',
    '    print("MP_MIX_STEP", i)',
    '    sleep_ms(30)',
    '',
    'print("MP_MIX_DONE")',
    '',
  ].join('\n');
}

function makeCircuitPythonMultiFileCodeScript(): string {
  return [
    'import time',
    'from helper import HELPER_TAG',
    '',
    'print("CP_MULTI_BOOT")',
    'print(HELPER_TAG)',
    'for i in range(3):',
    '    print("CP_MULTI_TICK", i)',
    '    time.sleep(0.05)',
    '',
  ].join('\n');
}

function makeMicroPythonMixedIoScript(): string {
  return [
    'from machine import Pin, ADC, PWM, UART, I2C',
    'from time import sleep_ms, ticks_ms, ticks_diff',
    '',
    'try:',
    '    import neopixel',
    'except Exception:',
    '    neopixel = None',
    '',
    'print("MP_IO_BOOT")',
    'led = Pin(16, Pin.OUT, value=0)',
    'servo_pwm = PWM(Pin(15))',
    'servo_pwm.freq(50)',
    'buzz_pwm = PWM(Pin(18))',
    'buzz_pwm.freq(1400)',
    'buzz_pwm.duty_u16(0)',
    'pot = ADC(26)',
    'uart = UART(1, baudrate=115200, tx=Pin(8), rx=Pin(9))',
    'i2c = I2C(0, scl=Pin(5), sda=Pin(4), freq=400000)',
    'pixels = None',
    'if neopixel is not None:',
    '    try:',
    '        pixels = neopixel.NeoPixel(Pin(2), 1)',
    '    except Exception as exc:',
    '        print("MP_IO_NEO_INIT_ERR", exc)',
    '',
    'def clamp_u16(value):',
    '    return max(0, min(65535, int(value)))',
    '',
    'def servo_angle(angle):',
    '    angle = max(0, min(180, int(angle)))',
    '    pulse_us = 500 + int((angle * 2000) / 180)',
    '    duty = int((pulse_us * 65535) / 20000)',
    '    servo_pwm.duty_u16(clamp_u16(duty))',
    '',
    'def oled_cmd(cmd):',
    '    i2c.writeto(0x3C, bytes((0x00, cmd & 0xFF)))',
    '',
    'def oled_data(buf):',
    '    i2c.writeto(0x3C, b"\\x40" + bytes(buf))',
    '',
    'def oled_init():',
    '    for cmd in (0xAE, 0x20, 0x00, 0x21, 0x00, 0x7F, 0x22, 0x00, 0x07, 0xAF):',
    '        oled_cmd(cmd)',
    '',
    'oled_init()',
    '',
    'for i in range(10):',
    '    on = (i % 2) == 0',
    '    led.value(1 if on else 0)',
    '    angle = (i * 20) % 181',
    '    servo_angle(angle)',
    '    buzz_pwm.freq(1400 + (i * 80))',
    '    buzz_pwm.duty_u16(28000 if on else 0)',
    '    if pixels is not None:',
    '        pixels[0] = ((32 + (i * 18)) & 0xFF, 8 if on else 2, 24 if on else 96)',
    '        pixels.write()',
    '    oled_ok = True',
    '    try:',
    '        pattern = 0xAA if on else 0x55',
    '        oled_cmd(0xB0 + (i % 8))',
    '        oled_cmd(0x00)',
    '        oled_cmd(0x10)',
    '        oled_data(bytes([pattern]) * 16)',
    '    except Exception as exc:',
    '        oled_ok = False',
    '        print("MP_IO_OLED_ERR", exc)',
    '    print("MP_IO_STEP", i, "POT", pot.read_u16(), "ANGLE", angle, "OLED", 1 if oled_ok else 0)',
    '    sleep_ms(80)',
    '',
    'print("MP_IO_READY")',
    'deadline = ticks_ms() + 2500',
    'while ticks_diff(deadline, ticks_ms()) > 0:',
    '    if uart.any():',
    '        raw = uart.read() or b""',
    '        text = raw.decode("utf-8", "ignore").strip()',
    '        if text:',
    '            print("MP_IO_RX", text)',
    '            print("MP_IO_ECHO:" + text)',
    '            break',
    '    sleep_ms(25)',
    '',
    'print("MP_IO_DONE")',
    '',
  ].join('\n');
}

function makeCircuitPythonMixedIoCodeScript(): string {
  return [
    'import time',
    'import board',
    'import digitalio',
    '',
    'print("CP_IO_BOOT")',
    '',
    'led = None',
    'servo = None',
    'buzz = None',
    '',
    'print("CP_IO_NO_NEOPIXEL")',
    'print("CP_IO_NO_OLED")',
    '',
    'try:',
    '    led = digitalio.DigitalInOut(board.GP16)',
    '    led.direction = digitalio.Direction.OUTPUT',
    'except Exception as exc:',
    '    print("CP_IO_LED_ERR", exc)',
    '',
    'try:',
    '    servo = digitalio.DigitalInOut(board.GP15)',
    '    servo.direction = digitalio.Direction.OUTPUT',
    'except Exception as exc:',
    '    print("CP_IO_SERVO_ERR", exc)',
    '',
    'try:',
    '    buzz = digitalio.DigitalInOut(board.GP18)',
    '    buzz.direction = digitalio.Direction.OUTPUT',
    'except Exception as exc:',
    '    print("CP_IO_BUZZ_ERR", exc)',
    '',
    'def pulse_servo(angle):',
    '    if servo is None:',
    '        return',
    '    angle = max(0, min(180, int(angle)))',
    '    pulse_us = 700 + int((angle * 1400) / 180)',
    '    servo.value = True',
    '    time.sleep(pulse_us / 1000000.0)',
    '    servo.value = False',
    '',
    'for i in range(10):',
    '    on = (i % 2) == 0',
    '    if led is not None:',
    '        led.value = on',
    '    pulse_servo((i * 20) % 181)',
    '    if buzz is not None:',
    '        buzz.value = on',
    '    print("CP_IO_STEP", i)',
    '    pulse_servo((i * 20 + 10) % 181)',
    '    time.sleep(0.06)',
    '',
    'if led is not None:',
    '    led.value = False',
    'if servo is not None:',
    '    servo.value = False',
    'if buzz is not None:',
    '    buzz.value = False',
    'print("CP_IO_DONE")',
    '',
  ].join('\n');
}

function writeLogs(reports: CaseReport[], rawEvents: Record<string, WorkerEvent[]>, serialDump: Record<string, string>) {
  const outDir = path.join(WORKSPACE_ROOT, 'temp', 'cli-hw-matrix');
  ensureDir(outDir);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `cli-hw-matrix-${stamp}.json`);
  const txtPath = path.join(outDir, `cli-hw-matrix-${stamp}.log`);

  const payload = {
    generatedAt: nowIso(),
    reports,
    serialDump,
    rawEvents,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const lines: string[] = [];
  lines.push(`CLI HW Matrix @ ${nowIso()}`);
  lines.push('');
  for (const report of reports) {
    lines.push(`[${report.caseId}] PASS=${report.pass}`);
    lines.push(`summary: ${report.summary}`);
    lines.push(`details: ${JSON.stringify(report.details)}`);
    lines.push('');
  }

  for (const [caseId, serial] of Object.entries(serialDump)) {
    lines.push(`[serial:${caseId}]`);
    lines.push(serial || '<empty>');
    lines.push('');
  }

  fs.writeFileSync(txtPath, lines.join('\n'), 'utf8');
  return { outDir, jsonPath, txtPath };
}

async function main() {
  const reports: CaseReport[] = [];
  const rawEvents: Record<string, WorkerEvent[]> = {};
  const serialDump: Record<string, string> = {};

  // Case 1: WS2812B with Pico
  if (shouldRunCase('case1-pico-ws2812b')) {
    const caseId = 'case1-pico-ws2812b';
    const fixtureCircuit = makeWs2812Circuit();
    const compileInput = {
      mainCode: makePicoWs2812Sketch(),
      extraFiles: [],
    };
    const artifact = compileArduinoSketch({
      fqbn: 'rp2040:rp2040:rpipico',
      sketchName: 'PicoWs2812',
      mainCode: compileInput.mainCode,
      extraFiles: compileInput.extraFiles,
    });

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-raspberry-pi-pico',
      artifact.payload,
      7000,
      { circuit: fixtureCircuit, serialBaudRate: 115200 },
    );

    const pixels = run.report.details.componentLastState?.ws1?.pixels;
    const hasPixels = Array.isArray(pixels) && pixels.some((v: number) => Number(v) !== 0);
    const serialMarker = /WS2812_SENT|NEO_POS|8X8_NEOPIXEL_BOOT/.test(run.serialText);

    run.report.pass = run.report.details.faultCount === 0
      && serialMarker
      && hasPixels;
    run.report.details.ws2812HasPixels = hasPixels;
    run.report.details.ws2812SerialMarker = serialMarker;
    run.report.details.compileArtifact = artifact.artifactType;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      serialMarker,
      pixelsUpdated: hasPixels,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 2: Pico + Servo + Potentiometer
  if (shouldRunCase('case2-pico-servo-potentiometer')) {
    const caseId = 'case2-pico-servo-potentiometer';
    const compileInput = resolveArduinoCompileInputs(caseId, 'pico1', makePicoServoPotSketch());
    const artifact = compileArduinoSketch({
      fqbn: 'rp2040:rp2040:rpipico',
      sketchName: 'PicoServoPot',
      mainCode: compileInput.mainCode,
      extraFiles: compileInput.extraFiles,
    });

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-raspberry-pi-pico',
      artifact.payload,
      5200,
      { circuit: resolveCaseCircuit(caseId, makeServoPotCircuit()), serialBaudRate: 115200 },
    );

    const servoAngle = Number(run.report.details.componentLastState?.servo1?.angle || 0);
    const potValue = Number(run.report.details.componentLastState?.pot1?.value ?? -1);
    const potSig = Number(run.report.details.componentPinVoltages?.pot1?.SIG ?? 0);
    const gp15Activity = Array.isArray(run.report.details.changedPins)
      && run.report.details.changedPins.some((entry: string) => String(entry || '').startsWith('GP15:'));
    run.report.pass = run.report.details.faultCount === 0
      && /SERVO_RAW=/.test(run.serialText)
      && gp15Activity
      && potValue >= 0
      && potSig > 0;
    run.report.details.servoAngle = servoAngle;
    run.report.details.gp15Activity = gp15Activity;
    run.report.details.potValue = potValue;
    run.report.details.potSigVoltage = potSig;
    run.report.details.compileArtifact = artifact.artifactType;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      serialMarker: /SERVO_RAW=/.test(run.serialText),
      servoPwmActivity: gp15Activity,
      potentiometerSignal: potSig > 0 && potValue >= 0,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 3: MAX7219 Dot Matrix with Pico
  if (shouldRunCase('case3-pico-max7219-dot-matrix')) {
    const caseId = 'case3-pico-max7219-dot-matrix';
    const compileInput = resolveArduinoCompileInputs(caseId, 'pico1', makePicoMax7219Sketch());
    const artifact = compileArduinoSketch({
      fqbn: 'rp2040:rp2040:rpipico',
      sketchName: 'PicoMax7219',
      mainCode: compileInput.mainCode,
      extraFiles: compileInput.extraFiles,
    });

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-raspberry-pi-pico',
      artifact.payload,
      4200,
      { circuit: resolveCaseCircuit(caseId, makeMax7219Circuit()), serialBaudRate: 115200 },
    );

    const spiRxBytes = Number(run.report.details.componentLastState?.max1?.spiRxBytes || 0);
    run.report.pass = run.report.details.faultCount === 0
      && /MAX7219_SPI/.test(run.serialText)
      && spiRxBytes > 0;
    run.report.details.max7219SpiRxBytes = spiRxBytes;
    run.report.details.compileArtifact = artifact.artifactType;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      serialMarker: /MAX7219_SPI/.test(run.serialText),
      max7219SpiTraffic: spiRxBytes > 0,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 4: Pico UART TX/RX loopback
  if (shouldRunCase('case4-pico-uart-loopback')) {
    const caseId = 'case4-pico-uart-loopback';
    const compileInput = resolveArduinoCompileInputs(caseId, 'pico1', makePicoLoopbackSketch());
    const artifact = compileArduinoSketch({
      fqbn: 'rp2040:rp2040:rpipico',
      sketchName: 'PicoLoopback',
      mainCode: compileInput.mainCode,
      extraFiles: compileInput.extraFiles,
    });

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-raspberry-pi-pico',
      artifact.payload,
      3500,
      { circuit: resolveCaseCircuit(caseId, makePicoLoopbackCircuit()), serialBaudRate: 9600, loopbackToSelf: true },
    );

    const loopDebug = run.report.details.debugSerial || { txBytesMax: 0, rxBytesMax: 0 };
    run.report.pass = run.report.details.faultCount === 0
      && /A{10,}/.test(run.serialText)
      && Number(loopDebug.txBytesMax || 0) > 0
      && Number(loopDebug.rxBytesMax || 0) > 0;
    run.report.details.loopbackDebug = loopDebug;
    run.report.details.compileArtifact = artifact.artifactType;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      loopbackEcho: /A{10,}/.test(run.serialText),
      serialTxTraffic: Number(loopDebug.txBytesMax || 0) > 0,
      serialRxTraffic: Number(loopDebug.rxBytesMax || 0) > 0,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 5: Pico <-> Pico UART communication
  if (shouldRunCase('case5-pico2pico-uart')) {
    const caseId = 'case5-pico2pico-uart';
    const p1Compile = resolveArduinoCompileInputs(caseId, 'p1', makePicoSenderSketch('P1_ACK'));
    const p1 = compileArduinoSketch({
      fqbn: 'rp2040:rp2040:rpipico',
      sketchName: 'PicoP1Sender',
      mainCode: p1Compile.mainCode,
      extraFiles: p1Compile.extraFiles,
    });

    const p2Compile = resolveArduinoCompileInputs(caseId, 'p2', makePicoReceiverSketch('P2_RX'));
    const p2 = compileArduinoSketch({
      fqbn: 'rp2040:rp2040:rpipico',
      sketchName: 'PicoP2Receiver',
      mainCode: p2Compile.mainCode,
      extraFiles: p2Compile.extraFiles,
    });

    const fixtureCircuit = resolveCaseCircuit(caseId, {
      components: [
        makePicoBoard('p1'),
        makePicoBoard('p2'),
      ],
      wires: [
        { from: 'p1:GP0', to: 'p2:GP1' },
        { from: 'p2:GP0', to: 'p1:GP1' },
        { from: 'p1:GND', to: 'p2:GND' },
      ],
    });

    const run = await runLinkedBoardsCase(caseId, {
      components: fixtureCircuit.components,
      wires: fixtureCircuit.wires,
      boards: [
        { id: 'p1', type: 'wokwi-raspberry-pi-pico', firmwarePayload: p1.payload, serialBaudRate: 9600 },
        { id: 'p2', type: 'wokwi-raspberry-pi-pico', firmwarePayload: p2.payload, serialBaudRate: 9600 },
      ],
      durationMs: 4800,
    });

    const totalFaults = Object.values(run.report.details.faultCountByBoard || {}).reduce((sum: number, v: any) => sum + Number(v || 0), 0);
    const debugByBoard = run.report.details.debugSerialByBoard || {};
    const p1Debug = debugByBoard.p1 || { txBytesMax: 0, rxBytesMax: 0 };
    const p2Debug = debugByBoard.p2 || { txBytesMax: 0, rxBytesMax: 0 };
    run.report.pass = totalFaults === 0
      && /PICO_SENDER_BOOT/.test(run.serialText)
      && /PICO_RX_BOOT/.test(run.serialText)
      && Number(p1Debug.txBytesMax || 0) > 0
      && Number(p1Debug.rxBytesMax || 0) > 0
      && Number(p2Debug.txBytesMax || 0) > 0
      && Number(p2Debug.rxBytesMax || 0) > 0;
    run.report.details.p1Debug = p1Debug;
    run.report.details.p2Debug = p2Debug;
    attachBehaviorChecks(run.report, {
      noFaults: totalFaults === 0,
      senderBooted: /PICO_SENDER_BOOT/.test(run.serialText),
      receiverBooted: /PICO_RX_BOOT/.test(run.serialText),
      p1TxRxTraffic: Number(p1Debug.txBytesMax || 0) > 0 && Number(p1Debug.rxBytesMax || 0) > 0,
      p2TxRxTraffic: Number(p2Debug.txBytesMax || 0) > 0 && Number(p2Debug.rxBytesMax || 0) > 0,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 6: UNO <-> UNO UART communication
  if (shouldRunCase('case6-uno2uno-uart')) {
    const caseId = 'case6-uno2uno-uart';
    const u1Compile = resolveArduinoCompileInputs(caseId, 'u1', makeUnoSenderSketch('UU1_ACK'));
    const u1 = compileArduinoSketch({
      fqbn: 'arduino:avr:uno',
      sketchName: 'UnoU1Sender',
      mainCode: u1Compile.mainCode,
      extraFiles: u1Compile.extraFiles,
    });

    const u2Compile = resolveArduinoCompileInputs(caseId, 'u2', makeUnoReceiverSketch('UU2_RX'));
    const u2 = compileArduinoSketch({
      fqbn: 'arduino:avr:uno',
      sketchName: 'UnoU2Receiver',
      mainCode: u2Compile.mainCode,
      extraFiles: u2Compile.extraFiles,
    });

    const fixtureCircuit = resolveCaseCircuit(caseId, {
      components: [
        makeUnoBoard('u1'),
        makeUnoBoard('u2'),
      ],
      wires: [
        { from: 'u1:1', to: 'u2:0' },
        { from: 'u2:1', to: 'u1:0' },
        { from: 'u1:gnd_2', to: 'u2:gnd_2' },
      ],
    });

    const run = await runLinkedBoardsCase(caseId, {
      components: fixtureCircuit.components,
      wires: fixtureCircuit.wires,
      boards: [
        { id: 'u1', type: 'wokwi-arduino-uno', firmwarePayload: u1.payload, serialBaudRate: 9600 },
        { id: 'u2', type: 'wokwi-arduino-uno', firmwarePayload: u2.payload, serialBaudRate: 9600 },
      ],
      durationMs: 5200,
    });

    const totalFaults = Object.values(run.report.details.faultCountByBoard || {}).reduce((sum: number, v: any) => sum + Number(v || 0), 0);
    run.report.pass = totalFaults === 0
      && /UU1_ACK/.test(run.serialText)
      && /UU2_RX/.test(run.serialText);
    attachBehaviorChecks(run.report, {
      noFaults: totalFaults === 0,
      senderAck: /UU1_ACK/.test(run.serialText),
      receiverRx: /UU2_RX/.test(run.serialText),
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 7: Pico <-> UNO UART communication
  if (shouldRunCase('case7-pico2uno-uart')) {
    const caseId = 'case7-pico2uno-uart';
    const picoCompile = resolveArduinoCompileInputs(caseId, 'p1', makePicoSenderSketch('PU_PICO_ACK'));
    const pico = compileArduinoSketch({
      fqbn: 'rp2040:rp2040:rpipico',
      sketchName: 'PicoToUnoSender',
      mainCode: picoCompile.mainCode,
      extraFiles: picoCompile.extraFiles,
    });

    const unoCompile = resolveArduinoCompileInputs(caseId, 'u1', makeUnoReceiverSketch('PU_UNO_RX'));
    const uno = compileArduinoSketch({
      fqbn: 'arduino:avr:uno',
      sketchName: 'UnoFromPicoReceiver',
      mainCode: unoCompile.mainCode,
      extraFiles: unoCompile.extraFiles,
    });

    const fixtureCircuit = resolveCaseCircuit(caseId, {
      components: [
        makePicoBoard('p1'),
        makeUnoBoard('u1'),
      ],
      wires: [
        { from: 'p1:GP0', to: 'u1:0' },
        { from: 'u1:1', to: 'p1:GP1' },
        { from: 'p1:GND', to: 'u1:gnd_2' },
      ],
    });

    const run = await runLinkedBoardsCase(caseId, {
      components: fixtureCircuit.components,
      wires: fixtureCircuit.wires,
      boards: [
        { id: 'p1', type: 'wokwi-raspberry-pi-pico', firmwarePayload: pico.payload, serialBaudRate: 9600 },
        { id: 'u1', type: 'wokwi-arduino-uno', firmwarePayload: uno.payload, serialBaudRate: 9600 },
      ],
      durationMs: 5200,
    });

    const totalFaults = Object.values(run.report.details.faultCountByBoard || {}).reduce((sum: number, v: any) => sum + Number(v || 0), 0);
    const debugByBoard = run.report.details.debugSerialByBoard || {};
    const picoDebug = debugByBoard.p1 || { txBytesMax: 0, rxBytesMax: 0 };
    run.report.pass = totalFaults === 0
      && /PU_UNO_RX/.test(run.serialText)
      && Number(picoDebug.txBytesMax || 0) > 0
      && Number(picoDebug.rxBytesMax || 0) > 0;
    run.report.details.picoDebug = picoDebug;
    attachBehaviorChecks(run.report, {
      noFaults: totalFaults === 0,
      unoReceived: /PU_UNO_RX/.test(run.serialText),
      picoTxTraffic: Number(picoDebug.txBytesMax || 0) > 0,
      picoRxTraffic: Number(picoDebug.rxBytesMax || 0) > 0,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 8: Arduino multi-file support (.ino + .h + .cpp)
  if (shouldRunCase('case8-arduino-multifile-ino-h-cpp')) {
    const caseId = 'case8-arduino-multifile-ino-h-cpp';
    const multiCompile = resolveArduinoCompileInputs(
      caseId,
      'uno1',
      makeArduinoMultiFileMainSketch(),
      [
        { name: 'helper.h', content: makeArduinoMultiFileHeader() },
        { name: 'helper.cpp', content: makeArduinoMultiFileCpp() },
      ],
    );
    const multi = compileArduinoSketch({
      fqbn: 'arduino:avr:uno',
      sketchName: 'UnoMultiFile',
      mainCode: multiCompile.mainCode,
      extraFiles: multiCompile.extraFiles,
    });

    const fixtureCircuit = resolveCaseCircuit(caseId, {
      components: [makeUnoBoard('uno1')],
      wires: [],
    });

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-arduino-uno',
      multi.payload,
      2800,
      {
        circuit: fixtureCircuit,
        serialBaudRate: 9600,
      },
    );

    run.report.pass = run.report.details.faultCount === 0
      && /MULTI_CPP_OK/.test(run.serialText);
    run.report.details.compileArtifact = multi.artifactType;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      multiFileOutput: /MULTI_CPP_OK/.test(run.serialText),
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 9: MicroPython multi-file support (.py bundle for CLI runner)
  if (shouldRunCase('case9-micropython-multifile-py')) {
    const caseId = 'case9-micropython-multifile-py';
    const fallbackBundle = bundleMicroPythonFiles([
      {
        name: 'helper.py',
        content: [
          'HELPER_TAG = "MP_HELPER_OK"',
          '',
        ].join('\n'),
      },
      {
        name: 'main.py',
        content: [
          'from helper import HELPER_TAG',
          'print("MP_MULTI_BOOT")',
          'print(HELPER_TAG)',
          '',
        ].join('\n'),
      },
    ]);
    const pyBundle = resolveMicroPythonScript(caseId, 'pico1', fallbackBundle);
    const micropythonUf2 = loadMicroPythonUf2Payload();
    const fixtureCircuit = resolveCaseCircuit(caseId, {
      components: [makePicoBoard('pico1')],
      wires: [],
    });

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-raspberry-pi-pico',
      micropythonUf2,
      5200,
      {
        circuit: fixtureCircuit,
        pyScript: pyBundle,
        serialBaudRate: 115200,
      },
    );

    run.report.pass = run.report.details.faultCount === 0
      && /MP_MULTI_BOOT/.test(run.serialText)
      && /MP_HELPER_OK/.test(run.serialText);
    run.report.details.bundledLength = pyBundle.length;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      bootPrinted: /MP_MULTI_BOOT/.test(run.serialText),
      helperImported: /MP_HELPER_OK/.test(run.serialText),
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 10: Pico MicroPython with mixed components (display, LED, pot, servo, neopixel)
  if (shouldRunCase('case10-pico-micropython-mixed-components')) {
    const caseId = 'case10-pico-micropython-mixed-components';
    const pyScript = resolveMicroPythonScript(caseId, 'pico1', makeMicroPythonMixedScript());
    const micropythonUf2 = loadMicroPythonUf2Payload();
    const fixtureCircuit = resolveCaseCircuit(caseId, makePicoMicroPythonMixedCircuit());

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-raspberry-pi-pico',
      micropythonUf2,
      7600,
      {
        circuit: fixtureCircuit,
        pyScript,
        serialBaudRate: 19200,
      },
    );

    const changedPins = Array.isArray(run.report.details.changedPins) ? run.report.details.changedPins : [];
    const changedPinSet = new Set(
      changedPins
        .map((entry: string) => String(entry || '').split(':')[0])
        .filter(Boolean),
    );
    const requiredPins = ['GP16', 'GP15', 'GP2', 'GP4', 'GP5'];
    const changedRequiredPinCount = requiredPins.filter((pin) => changedPinSet.has(pin)).length;

    const componentState = run.report.details.componentLastState || {};
    const hasAllComponents = ['led1', 'pot1', 'servo1', 'ws1', 'oled1']
      .every((id) => Object.prototype.hasOwnProperty.call(componentState, id));
    const componentUpdateCount = run.report.details.componentUpdateCount || {};
    const mixUpdateSignals = {
      led: Number(componentUpdateCount.led1 || 0),
      pot: Number(componentUpdateCount.pot1 || 0),
      oled: Number(componentUpdateCount.oled1 || 0),
      servo: Number(componentUpdateCount.servo1 || 0),
      neopixel: Number(componentUpdateCount.ws1 || 0),
    };

    const potSig = Number(run.report.details.componentPinVoltages?.pot1?.SIG ?? 0);
    const oledVcc = Number(run.report.details.componentPinVoltages?.oled1?.VCC ?? 0);
    const wsVcc = Number(run.report.details.componentPinVoltages?.ws1?.VCC ?? 0);

    run.report.pass = run.report.details.faultCount === 0
      && /MP_MIX_BOOT/.test(run.serialText)
      && /MP_MIX_DONE/.test(run.serialText)
      && /MP_MIX_STEP/.test(run.serialText)
      && hasAllComponents
      && mixUpdateSignals.pot > 0
      && mixUpdateSignals.oled > 0
      && potSig > 0
      && oledVcc > 0
      && wsVcc > 0;

    run.report.details.changedRequiredPinCount = changedRequiredPinCount;
    run.report.details.hasAllComponents = hasAllComponents;
    run.report.details.mixUpdateSignals = mixUpdateSignals;
    run.report.details.potSigVoltage = potSig;
    run.report.details.oledVccVoltage = oledVcc;
    run.report.details.wsVccVoltage = wsVcc;
    run.report.details.pyScriptLength = pyScript.length;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      bootAndDonePrinted: /MP_MIX_BOOT/.test(run.serialText) && /MP_MIX_DONE/.test(run.serialText),
      componentsPresent: hasAllComponents,
      displayActivity: mixUpdateSignals.oled > 0,
      neopixelActivity: mixUpdateSignals.neopixel > 0,
      servoActivity: mixUpdateSignals.servo > 0,
      ledActivity: mixUpdateSignals.led > 0,
      requiredPinsActive: changedRequiredPinCount >= 3,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 11: Pico + OLED with native .ino path
  if (shouldRunCase('case11-pico-oled-ino')) {
    const caseId = 'case11-pico-oled-ino';
    const compileInput = resolveArduinoCompileInputs(caseId, 'pico1', makePicoOledSketch());
    const artifact = compileArduinoSketch({
      fqbn: 'rp2040:rp2040:rpipico',
      sketchName: 'PicoOledNative',
      mainCode: compileInput.mainCode,
      extraFiles: compileInput.extraFiles,
    });

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-raspberry-pi-pico',
      artifact.payload,
      5200,
      {
        circuit: resolveCaseCircuit(caseId, makePicoOledCircuit()),
        serialBaudRate: 115200,
      },
    );

    const oledState = run.report.details.componentLastState?.oled1 || {};
    const oledUpdates = Number(run.report.details.componentUpdateCount?.oled1 || 0);
    const oledVcc = Number(run.report.details.componentPinVoltages?.oled1?.VCC ?? 0);

    run.report.pass = run.report.details.faultCount === 0
      && /OLED_BOOT/.test(run.serialText)
      && /OLED_FRAME\s+\d+/.test(run.serialText)
      && /OLED_I2C=0/.test(run.serialText)
      && /OLED_DATA=0/.test(run.serialText)
      && oledUpdates > 0
      && oledVcc > 0
      && oledState.displayOn === true;
    run.report.details.oledUpdates = oledUpdates;
    run.report.details.oledVccVoltage = oledVcc;
    run.report.details.oledDisplayOn = oledState.displayOn === true;
    run.report.details.compileArtifact = artifact.artifactType;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      oledBootPrinted: /OLED_BOOT/.test(run.serialText),
      i2cAcked: /OLED_I2C=0/.test(run.serialText) && /OLED_DATA=0/.test(run.serialText),
      oledFramesPrinted: /OLED_FRAME\s+\d+/.test(run.serialText),
      oledStateUpdated: oledUpdates > 0,
      oledDisplayEnabled: oledState.displayOn === true,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 12: CircuitPython multi-file support (code.py + helper import)
  if (shouldRunCase('case12-circuitpython-multifile-py')) {
    const caseId = 'case12-circuitpython-multifile-py';
    const runtimeEnv = resolveFixtureRuntimeEnv(caseId, 'pico1');
    const effectiveEnv = runtimeEnv === 'native' ? 'circuitpython' : runtimeEnv;
    const runtimeFiles = resolveRp2040RuntimeFiles(
      caseId,
      'pico1',
      effectiveEnv,
      [
        { path: 'helper.py', content: 'HELPER_TAG = "CP_HELPER_OK"\n' },
        { path: 'code.py', content: makeCircuitPythonMultiFileCodeScript() },
      ],
    );
    const flashPartitions = await buildRp2040RuntimeFsPartitions(runtimeFiles, effectiveEnv);
    const hasFlashPartitions = Array.isArray(flashPartitions) && flashPartitions.length > 0;
    const circuitPythonUf2 = loadCircuitPythonUf2Payload();

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-raspberry-pi-pico',
      circuitPythonUf2,
      17000,
      {
        circuit: resolveCaseCircuit(caseId, {
          components: [makePicoBoard('pico1')],
          wires: [],
        }),
        serialBaudRate: 115200,
        rp2040LogicalFlashBytes: RP2040_LOGICAL_FLASH_BYTES,
        rp2040FlashPartitions: flashPartitions,
        circuitPythonWaitMs: 12000,
        circuitPythonScript: buildCircuitPythonInjectedScript(runtimeFiles),
      },
    );

    const bootPrinted = /CP_MULTI_BOOT/.test(run.serialText);
    const helperImported = /CP_HELPER_OK/.test(run.serialText);
    const tickPrinted = /CP_MULTI_TICK/.test(run.serialText);

    run.report.pass = run.report.details.faultCount === 0
      && hasFlashPartitions
      && bootPrinted
      && helperImported
      && tickPrinted;
    run.report.details.runtimeEnv = effectiveEnv;
    run.report.details.runtimeFiles = runtimeFiles.map((f) => f.path);
    run.report.details.flashPartitionCount = hasFlashPartitions ? flashPartitions.length : 0;
    run.report.details.flashPartitionBytes = hasFlashPartitions ? Number(flashPartitions[0]?.data?.length || 0) : 0;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      partitionsBuilt: hasFlashPartitions,
      circuitPythonBoot: bootPrinted,
      helperImport: helperImported,
      codePyExecuted: tickPrinted,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 13: MicroPython mixed components + serial input echo
  if (shouldRunCase('case13-pico-micropython-mixed-io-serial')) {
    const caseId = 'case13-pico-micropython-mixed-io-serial';
    const mainScript = makeMicroPythonMixedIoScript();
    const runtimeFiles = resolveRp2040RuntimeFiles(
      caseId,
      'pico1',
      'micropython',
      [{ path: 'main.py', content: mainScript }],
    );
    const flashPartitions = await buildRp2040RuntimeFsPartitions(runtimeFiles, 'micropython');
    const hasFlashPartitions = Array.isArray(flashPartitions) && flashPartitions.length > 0;
    const pyScriptFallback = hasFlashPartitions ? '' : mainScript;
    const micropythonUf2 = loadMicroPythonUf2Payload();
    const fixtureCircuit = resolveCaseCircuit(caseId, makePicoMixedIoCircuit());

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-raspberry-pi-pico',
      micropythonUf2,
      10800,
      {
        circuit: fixtureCircuit,
        pyScript: pyScriptFallback,
        serialBaudRate: 115200,
        rp2040LogicalFlashBytes: RP2040_LOGICAL_FLASH_BYTES,
        rp2040FlashPartitions: flashPartitions,
        serialInputs: [
          { delayMs: 1400, data: 'matrix-input-mp\\n', source: 'uart1' },
          { delayMs: 1800, data: 'matrix-input-mp\\n', source: 'uart1' },
        ],
      },
    );

    const componentState = run.report.details.componentLastState || {};
    const componentUpdateCount = run.report.details.componentUpdateCount || {};
    const hasAllComponents = ['led1', 'pot1', 'servo1', 'ws1', 'oled1', 'buzz1']
      .every((id) => Object.prototype.hasOwnProperty.call(componentState, id));
    const potSig = Number(run.report.details.componentPinVoltages?.pot1?.SIG ?? 0);
    const mixSignals = {
      led: Number(componentUpdateCount.led1 || 0),
      pot: Number(componentUpdateCount.pot1 || 0),
      oled: Number(componentUpdateCount.oled1 || 0),
      servo: Number(componentUpdateCount.servo1 || 0),
      neopixel: Number(componentUpdateCount.ws1 || 0),
      buzzer: Number(componentUpdateCount.buzz1 || 0),
    };
    const serialInputObserved = /MP_IO_RX/.test(run.serialText) && /MP_IO_ECHO:/.test(run.serialText);

    run.report.pass = run.report.details.faultCount === 0
      && hasFlashPartitions
      && /MP_IO_BOOT/.test(run.serialText)
      && /MP_IO_DONE/.test(run.serialText)
      && serialInputObserved
      && hasAllComponents
      && potSig > 0
      && mixSignals.led > 1
      && mixSignals.servo > 1
      && mixSignals.neopixel > 1
      && mixSignals.oled > 1
      && mixSignals.buzzer > 1;
    run.report.details.runtimeFiles = runtimeFiles.map((f) => f.path);
    run.report.details.flashPartitionCount = hasFlashPartitions ? flashPartitions.length : 0;
    run.report.details.flashPartitionBytes = hasFlashPartitions ? Number(flashPartitions[0]?.data?.length || 0) : 0;
    run.report.details.hasAllComponents = hasAllComponents;
    run.report.details.mixSignals = mixSignals;
    run.report.details.potSigVoltage = potSig;
    run.report.details.pyScriptLength = mainScript.length;
    run.report.details.pyScriptFallbackUsed = !hasFlashPartitions;
    run.report.details.serialInputObserved = serialInputObserved;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      partitionsBuilt: hasFlashPartitions,
      bootAndDonePrinted: /MP_IO_BOOT/.test(run.serialText) && /MP_IO_DONE/.test(run.serialText),
      serialInputEcho: serialInputObserved,
      componentsPresent: hasAllComponents,
      ledActivity: mixSignals.led > 1,
      oledActivity: mixSignals.oled > 1,
      servoActivity: mixSignals.servo > 1,
      neopixelActivity: mixSignals.neopixel > 1,
      buzzerActivity: mixSignals.buzzer > 1,
      potentiometerSignal: potSig > 0,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  // Case 14: CircuitPython mixed components + serial input echo via USB CDC
  if (shouldRunCase('case14-pico-circuitpython-mixed-io-serial')) {
    const caseId = 'case14-pico-circuitpython-mixed-io-serial';
    const runtimeEnv = resolveFixtureRuntimeEnv(caseId, 'pico1');
    const effectiveEnv = runtimeEnv === 'native' ? 'circuitpython' : runtimeEnv;
    const runtimeFiles = resolveRp2040RuntimeFiles(
      caseId,
      'pico1',
      effectiveEnv,
      [
        { path: 'code.py', content: makeCircuitPythonMixedIoCodeScript() },
      ],
    );
    const flashPartitions = await buildRp2040RuntimeFsPartitions(runtimeFiles, effectiveEnv);
    const hasFlashPartitions = Array.isArray(flashPartitions) && flashPartitions.length > 0;
    const circuitPythonUf2 = loadCircuitPythonUf2Payload();
    const fixtureCircuit = resolveCaseCircuit(caseId, makePicoMixedIoCircuit());

    const run = await runSingleBoardCase(
      caseId,
      'wokwi-raspberry-pi-pico',
      circuitPythonUf2,
      15000,
      {
        circuit: fixtureCircuit,
        serialBaudRate: 115200,
        rp2040LogicalFlashBytes: RP2040_LOGICAL_FLASH_BYTES,
        rp2040FlashPartitions: flashPartitions,
        circuitPythonWaitMs: 12000,
        circuitPythonScript: buildCircuitPythonInjectedScript(runtimeFiles),
      },
    );

    const componentState = run.report.details.componentLastState || {};
    const componentUpdateCount = run.report.details.componentUpdateCount || {};
    const hasAllComponents = ['led1', 'pot1', 'servo1', 'ws1', 'oled1', 'buzz1']
      .every((id) => Object.prototype.hasOwnProperty.call(componentState, id));
    const potSig = Number(run.report.details.componentPinVoltages?.pot1?.SIG ?? 0);
    const mixSignals = {
      led: Number(componentUpdateCount.led1 || 0),
      pot: Number(componentUpdateCount.pot1 || 0),
      oled: Number(componentUpdateCount.oled1 || 0),
      servo: Number(componentUpdateCount.servo1 || 0),
      neopixel: Number(componentUpdateCount.ws1 || 0),
      buzzer: Number(componentUpdateCount.buzz1 || 0),
    };
    const serialInputObserved = /CP_IO_RX/.test(run.serialText);
    const neopixelUnavailable = /CP_IO_NO_NEOPIXEL/.test(run.serialText)
      || /ImportError:\s*no module named ['\"]neopixel['\"]/i.test(run.serialText);
    const oledSkipped = /CP_IO_NO_OLED/.test(run.serialText);

    run.report.pass = run.report.details.faultCount === 0
      && hasFlashPartitions
      && /CP_IO_BOOT/.test(run.serialText)
      && /CP_IO_DONE/.test(run.serialText)
      && hasAllComponents
      && mixSignals.led > 1
      && mixSignals.servo > 1
      && (mixSignals.neopixel > 1 || neopixelUnavailable)
      && (mixSignals.oled > 1 || oledSkipped)
      && mixSignals.buzzer > 1
      && potSig > 0;
    run.report.details.runtimeEnv = effectiveEnv;
    run.report.details.runtimeFiles = runtimeFiles.map((f) => f.path);
    run.report.details.hasAllComponents = hasAllComponents;
    run.report.details.mixSignals = mixSignals;
    run.report.details.flashPartitionCount = hasFlashPartitions ? flashPartitions.length : 0;
    run.report.details.flashPartitionBytes = hasFlashPartitions ? Number(flashPartitions[0]?.data?.length || 0) : 0;
    run.report.details.potSigVoltage = potSig;
    run.report.details.neopixelUnavailable = neopixelUnavailable;
    run.report.details.oledSkipped = oledSkipped;
    run.report.details.serialInputObserved = serialInputObserved;
    attachBehaviorChecks(run.report, {
      noFaults: run.report.details.faultCount === 0,
      partitionsBuilt: hasFlashPartitions,
      bootAndDonePrinted: /CP_IO_BOOT/.test(run.serialText) && /CP_IO_DONE/.test(run.serialText),
      componentsPresent: hasAllComponents,
      ledActivity: mixSignals.led > 1,
      oledActivity: mixSignals.oled > 1 || oledSkipped,
      servoActivity: mixSignals.servo > 1,
      neopixelActivity: mixSignals.neopixel > 1 || neopixelUnavailable,
      buzzerActivity: mixSignals.buzzer > 1,
      potentiometerSignal: potSig > 0,
    });

    reports.push(run.report);
    rawEvents[run.report.caseId] = run.events;
    serialDump[run.report.caseId] = run.serialText;
  }

  const out = writeLogs(reports, rawEvents, serialDump);

  const total = reports.length;
  const passed = reports.filter((r) => r.pass).length;

  console.log(`CLI hardware compatibility matrix complete: ${passed}/${total} passed`);
  for (const report of reports) {
    console.log(`- ${report.caseId}: ${report.pass ? 'PASS' : 'FAIL'} | ${report.summary}`);
  }
  console.log(`Log file: ${out.txtPath}`);
  console.log(`JSON file: ${out.jsonPath}`);

  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('CLI hardware compatibility matrix failed:', err?.message || err);
  process.exit(1);
});
