import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');

const emulatorComponentsDir = path.join(workspaceRoot, 'openhw-studio-emulator-danish', 'src', 'components');
const executePath = path.join(workspaceRoot, 'OpenHW-studio-frontend-danish', 'src', 'worker', 'execute.ts');
const matrixOutDir = path.join(workspaceRoot, 'temp', 'cli-hw-matrix');

const TELEMETRY_TOKEN_PATTERNS = [
  /getTelemetrySummary\s*\(/,
  /getTelemetryData\s*\(/,
  /telemetryTemplate/i,
  /criticalKeys/i,
  /addTelemetry/i,
  /updateTelemetry/i,
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listManifestEntries() {
  if (!fs.existsSync(emulatorComponentsDir)) {
    throw new Error(`Components directory not found: ${emulatorComponentsDir}`);
  }

  const entries = [];
  for (const dirent of fs.readdirSync(emulatorComponentsDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const manifestPath = path.join(emulatorComponentsDir, dirent.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = readJson(manifestPath);
    const manifestType = String(manifest?.type || dirent.name).trim() || dirent.name;
    const telemetry = manifest?.telemetry && typeof manifest.telemetry === 'object' ? manifest.telemetry : null;

    entries.push({
      dirName: dirent.name,
      type: manifestType,
      manifestPath,
      hasManifestTelemetry: !!telemetry,
      telemetryKeys: telemetry ? Object.keys(telemetry).sort((a, b) => a.localeCompare(b)) : [],
    });
  }

  return entries.sort((a, b) => a.type.localeCompare(b.type));
}

function parseExecuteImports(sourceText) {
  const map = new Map();
  const importRegex = /^import\s+\{\s*([A-Za-z0-9_]+)\s*\}\s+from\s+'([^']+)';/gm;
  let match;
  while ((match = importRegex.exec(sourceText)) !== null) {
    const className = String(match[1] || '').trim();
    const importPath = String(match[2] || '').trim();
    if (!className || !importPath) continue;
    map.set(className, importPath);
  }
  return map;
}

function parseLogicRegistry(sourceText) {
  const registryMatch = sourceText.match(/export const LOGIC_REGISTRY\s*:\s*Record<string, any>\s*=\s*\{([\s\S]*?)\n\};/m);
  if (!registryMatch) {
    throw new Error('LOGIC_REGISTRY block not found in execute.ts');
  }

  const registryBody = registryMatch[1] || '';
  const registry = new Map();
  const pairRegex = /'([^']+)'\s*:\s*([A-Za-z0-9_]+)\s*,/g;
  let match;
  while ((match = pairRegex.exec(registryBody)) !== null) {
    const type = String(match[1] || '').trim();
    const logicClass = String(match[2] || '').trim();
    if (!type || !logicClass) continue;
    registry.set(type, logicClass);
  }

  return registry;
}

function resolveImportToFile(importPath) {
  if (!importPath) return null;

  if (importPath.startsWith('@openhw/emulator/src/components/')) {
    const suffix = importPath.replace('@openhw/emulator/', '');
    const abs = path.join(workspaceRoot, 'openhw-studio-emulator-danish', suffix);
    return fs.existsSync(abs) ? abs : null;
  }

  if (importPath.startsWith('../') || importPath.startsWith('./')) {
    const abs = path.resolve(path.dirname(executePath), importPath);
    return fs.existsSync(abs) ? abs : null;
  }

  return null;
}

function fileHasCustomTelemetry(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, 'utf8');
  return TELEMETRY_TOKEN_PATTERNS.some((pattern) => pattern.test(text));
}

function classifyTelemetrySource(component) {
  if (component.hasCustomTelemetryLogic) return 'logic-level custom';
  if (component.hasManifestTelemetry) return 'manifest-only';
  return 'fallback-only';
}

function formatBool(value) {
  return value ? 'yes' : 'no';
}

function main() {
  ensureDir(matrixOutDir);

  const executeText = fs.readFileSync(executePath, 'utf8');
  const importMap = parseExecuteImports(executeText);
  const logicRegistry = parseLogicRegistry(executeText);
  const manifestEntries = listManifestEntries();

  const allTypes = new Set();
  for (const entry of manifestEntries) allTypes.add(entry.type);
  for (const type of logicRegistry.keys()) allTypes.add(type);

  const manifestByType = new Map(manifestEntries.map((entry) => [entry.type, entry]));

  const rows = Array.from(allTypes)
    .sort((a, b) => a.localeCompare(b))
    .map((type) => {
      const manifest = manifestByType.get(type) || null;
      const logicClass = logicRegistry.get(type) || null;
      const logicImportPath = logicClass ? importMap.get(logicClass) || null : null;
      const logicFilePath = logicImportPath ? resolveImportToFile(logicImportPath) : null;

      const hasCustomTelemetryLogic = !!logicFilePath && fileHasCustomTelemetry(logicFilePath);
      const hasManifestTelemetry = !!manifest?.hasManifestTelemetry;
      const telemetrySource = classifyTelemetrySource({ hasCustomTelemetryLogic, hasManifestTelemetry });

      const notes = [];
      if (logicClass && logicClass.includes('Fallback')) notes.push('fallback-runtime-logic');
      if (logicClass === 'BaseComponent') notes.push('basecomponent-runtime-logic');
      if (!manifest) notes.push('no-manifest');
      if (manifest?.telemetryKeys?.length) {
        notes.push(`manifest-telemetry-keys=${manifest.telemetryKeys.join(',')}`);
      }

      return {
        type,
        telemetrySource,
        hasManifest: !!manifest,
        hasManifestTelemetry,
        hasCustomTelemetryLogic,
        logicClass,
        logicImportPath,
        logicFilePath,
        manifestPath: manifest?.manifestPath || null,
        notes,
      };
    });

  const counts = {
    total: rows.length,
    manifestOnly: rows.filter((row) => row.telemetrySource === 'manifest-only').length,
    logicLevelCustom: rows.filter((row) => row.telemetrySource === 'logic-level custom').length,
    fallbackOnly: rows.filter((row) => row.telemetrySource === 'fallback-only').length,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(matrixOutDir, `cli-hw-telemetry-coverage-${stamp}.json`);
  const mdPath = path.join(matrixOutDir, `cli-hw-telemetry-coverage-${stamp}.md`);

  const jsonPayload = {
    generatedAt: new Date().toISOString(),
    executePath,
    counts,
    components: rows,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push('# CLI Matrix Telemetry Coverage');
  lines.push('');
  lines.push(`Generated at: ${jsonPayload.generatedAt}`);
  lines.push(`Total components: ${counts.total}`);
  lines.push(`Manifest-only: ${counts.manifestOnly}`);
  lines.push(`Logic-level custom: ${counts.logicLevelCustom}`);
  lines.push(`Fallback-only: ${counts.fallbackOnly}`);
  lines.push('');
  lines.push('| Component Type | Source Class | Manifest Telemetry | Logic Custom Telemetry | Runtime Logic | Notes |');
  lines.push('| --- | --- | --- | --- | --- | --- |');

  for (const row of rows) {
    lines.push(`| ${row.type} | ${row.telemetrySource} | ${formatBool(row.hasManifestTelemetry)} | ${formatBool(row.hasCustomTelemetryLogic)} | ${row.logicClass || '-'} | ${row.notes.join('; ') || '-'} |`);
  }

  lines.push('');
  lines.push(`JSON: ${jsonPath}`);
  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(`[telemetry-coverage] markdown=${mdPath}`);
  console.log(`[telemetry-coverage] json=${jsonPath}`);
  console.log(`[telemetry-coverage] counts total=${counts.total} manifest-only=${counts.manifestOnly} logic-level-custom=${counts.logicLevelCustom} fallback-only=${counts.fallbackOnly}`);
}

main();
