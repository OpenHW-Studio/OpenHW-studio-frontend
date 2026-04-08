import { TopToolbox } from './TopToolbox';
import { Btn } from './Btn';
import { RightPanel } from './RightPanel';
import { renderRoundedPath, computeWireOrthoPoints, getWirePoints, multiRoutePath, buildWirePath, wireColor } from './wireUtils';
import { useWebSerialHardware } from './webSerialHardware';
import { useHardwareFlashing } from './useHardwareFlashing';
import { SimulationConsolePanel, TerminalIcon, useSimulationConsole } from './SimulationConsole';








import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useGamification } from '../../context/GamificationContext.jsx'
import { PROJECTS } from '../../services/gamification/ProjectsConfig.js'
import { COMPONENT_MAP } from '../../services/gamification/ComponentsConfig.js'
import { compileCode, flashFirmware, fetchInstalledLibraries, searchLibraries, installLibrary, submitCustomComponent, fetchInstalledComponentsWithFiles } from '../../services/simulatorService.js'
import { getCachedHex, setCachedHex, enqueueComponent, getQueuedComponents, dequeueComponent } from '../../services/offlineCache.js'
import { saveProject, loadProject, listProjects, deleteProject, renameProject, generateProjectId, formatProjectDate } from '../../services/projectStore.js'
import html2canvas from 'html2canvas'
import JSZip from 'jszip';

// ── Lazy loaders — heavy libs loaded on first use, NOT on page paint ──────────
// @babel/standalone is ~800KB — loading it eagerly was causing the 3.73s LCP.
// html2canvas is ~120KB — only needed for PNG export.
let _babelMod = null;
const getBabel = async () => {
  if (!_babelMod) _babelMod = await import('@babel/standalone');
  return _babelMod;
};
let _h2cMod = null;
const getHtml2canvas = async () => {
  if (!_h2cMod) _h2cMod = (await import('html2canvas')).default;
  return _h2cMod;
};

import * as EmulatorComponents from "@openhw/emulator";

// Web Editor features
import Editor from 'react-simple-code-editor';
import BlocklyEditor from '../../components/BlocklyEditor.jsx';
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
// Import a Prism theme (or we can inject our own CSS wrapper)
import 'prismjs/themes/prism-tomorrow.css';

// Build Catalog & UI Registry dynamically from local backend imports
const COMPONENT_REGISTRY = {};

Object.entries(EmulatorComponents).forEach(([key, module]) => {
  if (key === 'BaseComponent') return;

  if (module && module.manifest) {
    const compId = module.manifest.type || module.manifest.id || key;
    COMPONENT_REGISTRY[compId] = module;
  }
});

// Compatibility aliases: accept WS2812 naming variants used in imported diagrams.
const neopixelBaseModule = COMPONENT_REGISTRY['wokwi-neopixel-matrix'];
if (neopixelBaseModule?.manifest) {
  ['wokwi-ws2812b', 'wokwi-ws2821b'].forEach((aliasType) => {
    if (COMPONENT_REGISTRY[aliasType]) return;
    COMPONENT_REGISTRY[aliasType] = {
      ...neopixelBaseModule,
      manifest: {
        ...neopixelBaseModule.manifest,
        type: aliasType,
        hiddenAlias: true,
      },
    };
  });
}

const LOCAL_CATALOG = [];
const LOCAL_PIN_DEFS = {};

const GROUP_MAPPING = {
  'Basic': 'basic',
  'Passives': 'basic',
  'Power': 'basic',
  'Outputs': 'output',
  'Inputs': 'input',
  'Sensors': 'sensor',
  'Displays': 'display',
  'Memory': 'misc',
  'Logic': 'logic'
};

function normalizeGroupName(name) {
  return GROUP_MAPPING[name] || name;
}

function sortCatalog(catalog) {
  const GROUP_ORDER = ['Boards', 'Basic', 'Display', 'Input', 'Sensor', 'Output', 'Actuators', 'Misc', 'Logic'];
  catalog.sort((a, b) => {
    const idxA = GROUP_ORDER.indexOf(a.group);
    const idxB = GROUP_ORDER.indexOf(b.group);
    if (idxA === -1 && idxB === -1) return a.group.localeCompare(b.group);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

function resolveUiExport(exportsUI) {
  if (!exportsUI) return null;

  if (exportsUI.default && typeof exportsUI.default === 'function') return exportsUI.default;
  if (exportsUI.UI && typeof exportsUI.UI === 'function') return exportsUI.UI;

  const keys = Object.keys(exportsUI);
  const blocked = (k) => {
    const l = String(k).toLowerCase();
    return l.includes('contextmenu') || l === 'bounds' || l === 'contextmenuduringrun' || l === 'contextmenuonlyduringrun';
  };

  const fnKey = keys.find((k) => typeof exportsUI[k] === 'function' && !blocked(k));
  if (fnKey) return exportsUI[fnKey];

  const anyKey = keys.find((k) => !blocked(k));
  if (anyKey) return exportsUI[anyKey];

  return null;
}

function toPascalCase(value) {
  const safe = String(value || 'component');
  return safe
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, c => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '') || 'Component';
}

function extractFunctionSource(fn) {
  if (typeof fn !== 'function') return '';
  try {
    let src = String(fn).trim();
    // Remove common fast-refresh signature calls that may appear in function bodies.
    src = src.replace(/\b_s\s*\([^)]*\);?/g, '');
    src = src.replace(/\$RefreshSig\$\s*\([^)]*\)/g, '(() => {})');
    src = src.replace(/\$RefreshReg\$\s*\([^)]*\);?/g, '');
    return src.trim();
  } catch {
    return '';
  }
}

function buildUiSourceFromRegistry(registryInfo, fallbackType) {
  if (registryInfo?.uiRaw) return registryInfo.uiRaw;

  const manifest = registryInfo?.manifest || {};
  const name = toPascalCase(manifest.type || fallbackType || 'component');
  const uiFn = extractFunctionSource(registryInfo?.UI);
  if (!uiFn) return '';

  const b = registryInfo?.BOUNDS;
  const bounds = (b && typeof b === 'object')
    ? b
    : { x: 5, y: 5, w: Math.max((manifest.w || 100) - 10, 10), h: Math.max((manifest.h || 80) - 10, 10) };

  const lines = [
    "import React from 'react';",
    '',
    `export const BOUNDS = { x: ${Number(bounds.x) || 0}, y: ${Number(bounds.y) || 0}, w: ${Number(bounds.w) || 10}, h: ${Number(bounds.h) || 10} };`,
  ];

  if (registryInfo?.contextMenuDuringRun || manifest.contextMenuDuringRun) {
    lines.push('export const contextMenuDuringRun = true;');
  }
  if (registryInfo?.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun) {
    lines.push('export const contextMenuOnlyDuringRun = true;');
  }

  lines.push('', `export const ${name}UI = ${uiFn};`);

  const ctxFn = extractFunctionSource(registryInfo?.ContextMenu);
  if (ctxFn) {
    lines.push('', `export const ContextMenu = ${ctxFn};`);
  }

  return lines.join('\n');
}

function buildLogicSourceFromRegistry(registryInfo, fallbackType) {
  if (registryInfo?.logicRaw) return registryInfo.logicRaw;

  const logicClassSrc = extractFunctionSource(registryInfo?.LogicClass);
  if (logicClassSrc.startsWith('class ')) {
    return `import { BaseComponent } from '../BaseComponent';\n\nexport ${logicClassSrc}\n`;
  }

  const name = toPascalCase(registryInfo?.manifest?.type || fallbackType || 'component');
  return `import { BaseComponent } from '../BaseComponent';\n\nexport class ${name}Logic extends BaseComponent {\n  reset() {}\n  update() {}\n}\n`;
}

function buildValidationSourceFromRegistry(registryInfo) {
  if (registryInfo?.validationRaw) return registryInfo.validationRaw;
  const validation = registryInfo?.validation;
  if (Array.isArray(validation)) {
    const rows = validation.map((rule) => {
      const id = JSON.stringify(rule?.id || 'rule');
      const description = JSON.stringify(rule?.description || '');
      const check = typeof rule?.check === 'function'
        ? String(rule.check)
        : '() => ({ pass: true })';
      return `  {\n    id: ${id},\n    description: ${description},\n    check: ${check},\n  }`;
    });
    return `export const validation = [\n${rows.join(',\n')}\n];\n`;
  }
  if (typeof validation === 'function') {
    return `export const validation = ${String(validation)};\n`;
  }
  return 'export const validation = [];\n';
}

function buildIndexSourceFromRegistry(registryInfo, fallbackType) {
  if (registryInfo?.indexRaw) return registryInfo.indexRaw;
  const manifest = registryInfo?.manifest || {};
  const name = toPascalCase(manifest.type || fallbackType || 'component');
  const hasCtxMenu = typeof registryInfo?.ContextMenu === 'function';
  const hasDuringRun = !!(registryInfo?.contextMenuDuringRun || manifest.contextMenuDuringRun);
  const hasOnlyDuringRun = !!(registryInfo?.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun);

  return `import manifest from './manifest.json';\nimport { ${name}UI, BOUNDS${hasDuringRun ? ', contextMenuDuringRun' : ''}${hasOnlyDuringRun ? ', contextMenuOnlyDuringRun' : ''}${hasCtxMenu ? ', ContextMenu' : ''} } from './ui';\nimport { ${name}Logic } from './logic';\nimport { validation } from './validation';\n\nexport default {\n  manifest,\n  UI: ${name}UI,\n  LogicClass: ${name}Logic,\n  BOUNDS,\n  validation,${hasCtxMenu ? '\n  ContextMenu,' : ''}${hasDuringRun ? '\n  contextMenuDuringRun,' : ''}${hasOnlyDuringRun ? '\n  contextMenuOnlyDuringRun,' : ''}\n};\n`;
}

Object.values(COMPONENT_REGISTRY).forEach(module => {
  const manifest = module.manifest;
  if (!manifest) return;

  if (manifest.pins) {
    LOCAL_PIN_DEFS[manifest.type] = manifest.pins;
  }

  if (manifest.hiddenAlias) {
    return;
  }

  const groupName = normalizeGroupName(manifest.group);
  let group = LOCAL_CATALOG.find(g => g.group === groupName);
  if (!group) {
    group = { group: groupName, items: [] };
    LOCAL_CATALOG.push(group);
  }

  const { pins: _pins, group: _, ...catalogItem } = manifest;
  group.items.push(catalogItem);
});

sortCatalog(LOCAL_CATALOG);

// Tracks component types that were dynamically injected from the backend (not built-in).
// Used by the polling loop to detect deletions and purge them from the registry.
const BACKEND_INJECTED_TYPES = new Set();

let nextWireId = 1

// ─── SYNC WIRE ID COUNTER AFTER LOADING EXTERNAL DATA ──────────────────────
function syncNextIds(_comps, ws) {
  for (const w of (ws || [])) {
    const m = w.id && w.id.match(/^w(\d+)$/);
    if (m) nextWireId = Math.max(nextWireId, parseInt(m[1]) + 1);
  }
}

const EXAMPLES_BASE_URL = import.meta.env.VITE_EXAMPLES_BASE_URL || 'http://localhost:5001/examples';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api').replace(/\/$/, '');

// ── Palette group visual helpers ─────────────────────────────────────────────
const GROUP_ICON_SVG = {
  'Boards': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="18" x2="8" y2="22" /><line x1="16" y1="18" x2="16" y2="22" /><line x1="2" y1="8" x2="6" y2="8" /><line x1="2" y1="16" x2="6" y2="16" /><line x1="18" y1="8" x2="22" y2="8" /><line x1="18" y1="16" x2="22" y2="16" /><rect x="8" y="8" width="8" height="8" rx="1" fill={c} fillOpacity="0.2" /></svg>,
  'output': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="5" /><path d="M12 15v4M9 19h6M8.5 7.5A5 5 0 0 1 12 5" /></svg>,
  'input': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="10" width="12" height="8" rx="2" /><circle cx="12" cy="10" r="2" fill={c} fillOpacity="0.3" /><line x1="12" y1="2" x2="12" y2="8" /><line x1="4" y1="18" x2="6" y2="18" /><line x1="18" y1="18" x2="20" y2="18" /></svg>,
  'basic': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="12" x2="6" y2="12" /><rect x="6" y="8" width="12" height="8" rx="1" /><line x1="18" y1="12" x2="22" y2="12" /></svg>,
  'Actuators': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></svg>,
  'misc': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="2" /><line x1="8" y1="5" x2="8" y2="19" /><line x1="12" y1="5" x2="12" y2="19" /><line x1="16" y1="5" x2="16" y2="19" /></svg>,
  'display': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2" /><line x1="8" y1="22" x2="16" y2="22" /><line x1="12" y1="18" x2="12" y2="22" /></svg>,
  'sensor': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 5.5A11 11 0 0 0 5.5 18.5M18.5 5.5A11 11 0 0 1 18.5 18.5M8.5 8.5A6 6 0 0 0 8.5 15.5M15.5 8.5A6 6 0 0 1 15.5 15.5" /><circle cx="12" cy="12" r="1.5" fill={c} /></svg>,
  'logic': (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h8c3.3 0 6 2.7 6 6s-2.7 6-6 6H4z" /><line x1="4" y1="4" x2="4" y2="20" /><line x1="2" y1="11" x2="4" y2="11" /><line x1="2" y1="17" x2="4" y2="17" /><line x1="18" y1="14" x2="22" y2="14" /></svg>,
};
const GROUP_COLORS = {
  'Boards': '#6366f1', 'output': '#22c55e', 'input': '#3b82f6',
  'basic': '#f59e0b', 'Actuators': '#06b6d4',
  'misc': '#8b5cf6', 'display': '#ec4899', 'sensor': '#14b8a6', 'logic': '#8b5cf6',
};

const BOARD_BAUD_PRESETS = {
  arduino_uno: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200'],
  esp32: ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'],
  stm32: ['9600', '19200', '38400', '57600', '115200', '230400', '460800'],
  rp2040: ['9600', '19200', '38400', '57600', '115200', '230400', '460800'],
};

const BOARD_DEFAULT_BAUD = {
  arduino_uno: '9600',
  esp32: '115200',
  stm32: '115200',
  rp2040: '115200',
};

const SERIAL_LINE_ENDINGS = {
  none: '',
  nl: '\n',
  crlf: '\r\n',
  cr: '\r',
};

const BOARD_FQBN = {
  arduino_uno: 'arduino:avr:uno',
  esp32: 'esp32:esp32:esp32',
  stm32: 'STMicroelectronics:stm32:GenF1',
  rp2040: 'rp2040:rp2040:rpipico',
};

const BOARD_DISPLAY_NAME = {
  arduino_uno: 'Arduino Uno',
  esp32: 'ESP32',
  stm32: 'STM32',
  rp2040: 'Raspberry Pi Pico',
};

const UF2_PAYLOAD_PREFIX = 'UF2BASE64:';
const DEFAULT_PICO_MICROPYTHON_UF2_URL = `${API_BASE_URL}/compile/pico/micropython-uf2`;
const DEFAULT_PICO_CIRCUITPYTHON_UF2_URL = `${API_BASE_URL}/compile/pico/circuitpython-uf2`;
const DEFAULT_PICO_CIRCUITPYTHON_VERSION = '8.2.7';
const DISABLED_FILE_SUFFIX = '.disabled';
const GENERATED_ROOT_FILE_IDS = new Set(['project/diagram.png']);
const ARDUINO_CODE_EXTENSIONS = new Set(['.ino', '.h', '.hpp', '.c', '.cpp']);
const ROOT_UPLOADABLE_EXTENSIONS = new Set(['.ino', '.cpp', '.h', '.hpp', '.c', '.txt', '.json', '.xml', '.py', '.uf2']);
const RP2040_NATIVE_ALLOWED_EXTENSIONS = new Set(['.ino', '.h', '.hpp', '.c', '.cpp', '.txt', '.json', '.xml', '.uf2']);
const RP2040_MICROPYTHON_ALLOWED_EXTENSIONS = new Set(['.py', '.txt', '.json', '.xml', '.uf2']);

function boardKindToDisplayName(kind) {
  const normalized = normalizeBoardKind(kind);
  return BOARD_DISPLAY_NAME[normalized] || BOARD_DISPLAY_NAME.arduino_uno;
}

function boardCompToDisplayName(boardComp, fallbackKind = 'arduino_uno') {
  if (!boardComp || typeof boardComp !== 'object') {
    return boardKindToDisplayName(fallbackKind);
  }

  const boardLabel = String(boardComp.label || '').trim();
  if (boardLabel) return boardLabel;
  const boardId = String(boardComp.id || '').trim();
  const kindLabel = boardKindToDisplayName(boardComp.type || fallbackKind);
  return boardId ? `${kindLabel} (${boardId})` : kindLabel;
}

function extractCompileSummaryLines(stdoutText) {
  const text = String(stdoutText || '');
  if (!text.trim()) return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const summaryPatterns = [
    /^Sketch uses\s+/i,
    /^Global variables use\s+/i,
    /^Program\s+size\s*:/i,
    /^Flash\s*:/i,
    /^RAM\s*:/i,
    /\btext\s+data\s+bss\s+dec\s+hex\b/i,
    /^\d+\s+\d+\s+\d+\s+\d+\s+[0-9a-f]+\s+/i,
  ];

  const dedup = new Set();
  const out = [];
  lines.forEach((line) => {
    if (!summaryPatterns.some((pattern) => pattern.test(line))) return;
    if (dedup.has(line)) return;
    dedup.add(line);
    out.push(line);
  });

  return out.slice(0, 8);
}

function formatRunDuration(secondsValue) {
  const totalSeconds = Math.max(0, Math.floor(Number(secondsValue || 0)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function normalizeHashValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;

  if (ArrayBuffer.isView(value)) {
    const len = Number(value.length || 0);
    return {
      kind: 'typed-array',
      length: len,
      preview: Array.from(value).slice(0, 24),
    };
  }

  if (Array.isArray(value)) {
    if (value.length > 64) {
      return {
        kind: 'array',
        length: value.length,
        preview: value.slice(0, 64).map((entry) => normalizeHashValue(entry, depth + 1)),
      };
    }
    return value.map((entry) => normalizeHashValue(entry, depth + 1));
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (depth > 4 && keys.length > 24) {
      return {
        kind: 'object',
        keys: keys.sort().slice(0, 24),
        size: keys.length,
      };
    }

    const out = {};
    keys
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        out[key] = normalizeHashValue(value[key], depth + 1);
      });
    return out;
  }

  return String(value);
}

function fnv1aHash(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function computeRenderSyncHash(payload) {
  return fnv1aHash(JSON.stringify(normalizeHashValue(payload, 0)));
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function normalizeRp2040Env(source) {
  const value = String(source || '').trim().toLowerCase();
  if (!value || value === 'none' || value === 'native' || value === 'ino') return 'native';
  if (value === 'cp' || value === 'circuitpy' || value === 'circuitpython') return 'circuitpython';
  if (value.startsWith('circuitpython')) return 'circuitpython';
  if (value === 'py' || value === 'python') return 'micropython';
  if (value.startsWith('micropython')) return 'micropython';
  return 'native';
}

function isRp2040PythonEnv(source) {
  const env = normalizeRp2040Env(source);
  return env === 'micropython' || env === 'circuitpython';
}

function getRp2040PythonEntryFileName(source) {
  return normalizeRp2040Env(source) === 'circuitpython' ? 'code.py' : 'main.py';
}

function mapRp2040EnvForLegacyContextMenu(source) {
  const env = normalizeRp2040Env(source);
  if (env === 'micropython') return 'micropython-20241129-v1.24.1';
  if (env === 'circuitpython') return `circuitpython-${DEFAULT_PICO_CIRCUITPYTHON_VERSION}`;
  return '';
}

function resolveComponentIdFormat(type) {
  const rawType = String(type || '').toLowerCase();

  if (rawType.includes('arduino') && rawType.includes('uno')) {
    return { prefix: 'uno', separator: '' };
  }
  if (rawType.includes('pico-w') || rawType.includes('picow')) {
    return { prefix: 'picow', separator: '' };
  }
  if (rawType.includes('rp2040') || rawType.includes('pico')) {
    return { prefix: 'pico', separator: '' };
  }

  const fallback = String(type || 'component')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'component';

  return { prefix: fallback, separator: '_' };
}

function allocateComponentId(type, usedIdsInput) {
  const usedIds = usedIdsInput instanceof Set
    ? usedIdsInput
    : new Set(Array.isArray(usedIdsInput) ? usedIdsInput : []);
  const { prefix, separator } = resolveComponentIdFormat(type);
  const pattern = new RegExp(`^${prefix}${separator}(\\d+)$`, 'i');

  let maxIndex = 0;
  usedIds.forEach((id) => {
    const match = String(id || '').match(pattern);
    if (!match) return;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      maxIndex = Math.max(maxIndex, parsed);
    }
  });

  let index = Math.max(1, maxIndex + 1);
  let candidate = `${prefix}${separator}${index}`;
  while (usedIds.has(candidate)) {
    index += 1;
    candidate = `${prefix}${separator}${index}`;
  }

  usedIds.add(candidate);
  return candidate;
}

function normalizeBoardKind(source) {
  const s = String(source || '').toLowerCase();
  if (s.includes('esp32')) return 'esp32';
  if (s.includes('stm32')) return 'stm32';
  if (s.includes('rp2040') || s.includes('pico')) return 'rp2040';
  return 'arduino_uno';
}

function resolveBoardFqbnForComponent(boardComp, boardKind) {
  const type = String(boardComp?.type || '').toLowerCase();
  if (type.includes('pico-w') || type.includes('picow')) {
    return 'rp2040:rp2040:rpipicow';
  }
  return BOARD_FQBN[boardKind] || BOARD_FQBN.arduino_uno;
}

function createDefaultMainCode(boardKind, boardId, options = {}) {
  const rp2040Mode = normalizeRp2040Env(options?.rp2040Mode || 'native');

  if (boardKind === 'rp2040' && rp2040Mode === 'micropython') {
    return `# ${boardId} MicroPython script\nfrom machine import Pin\nfrom time import sleep\n\nled = Pin('LED', Pin.OUT)\n\nwhile True:\n  led.toggle()\n  sleep(0.5)\n`;
  }
  if (boardKind === 'rp2040' && rp2040Mode === 'circuitpython') {
    return `# ${boardId} CircuitPython script\nimport time\nimport board\nimport digitalio\n\nled = digitalio.DigitalInOut(board.LED)\nled.direction = digitalio.Direction.OUTPUT\n\nwhile True:\n  led.value = not led.value\n  time.sleep(0.5)\n`;
  }
  if (boardKind === 'esp32' || boardKind === 'stm32' || boardKind === 'rp2040') {
    return `// ${boardId} main sketch\nvoid setup() {\n  // Serial.begin(${BOARD_DEFAULT_BAUD[boardKind] || 115200});\n}\n\nvoid loop() {\n  delay(1000);\n}\n`;
  }
  return `// ${boardId} main sketch\nvoid setup() {\n  pinMode(13, OUTPUT);\n  // Serial.begin(${BOARD_DEFAULT_BAUD.arduino_uno});\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n`;
}

function getDefaultMainFileName(boardKind, boardId, options = {}) {
  if (boardKind === 'rp2040') {
    const rp2040Mode = normalizeRp2040Env(options?.rp2040Mode || 'native');
    if (isRp2040PythonEnv(rp2040Mode)) {
      return getRp2040PythonEntryFileName(rp2040Mode);
    }
    return `${boardId}.ino`;
  }
  return `${boardId}.ino`;
}

function fileExt(path) {
  const idx = path.lastIndexOf('.');
  return idx >= 0 ? path.substring(idx).toLowerCase() : '';
}

function toBoardRelativePath(boardId, fullPath) {
  const prefix = `project/${boardId}/`;
  const raw = String(fullPath || '').replace(/\\/g, '/');
  if (!raw.startsWith(prefix)) {
    return String(raw.split('/').pop() || '').trim();
  }

  const relative = raw.slice(prefix.length).trim();
  const parts = relative
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..');
  return parts.join('/');
}

function isFileDisabled(pathLike) {
  return String(pathLike || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX);
}

function baseFileExt(pathLike) {
  const normalized = isFileDisabled(pathLike)
    ? String(pathLike || '').slice(0, -DISABLED_FILE_SUFFIX.length)
    : String(pathLike || '');
  return fileExt(normalized);
}

function normalizeProjectFiles(files) {
  const list = Array.isArray(files) ? files : [];
  const seen = new Set();
  const out = [];

  list.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const normalizedPath = String(entry.path || entry.id || '').trim();
    if (!normalizedPath || GENERATED_ROOT_FILE_IDS.has(normalizedPath) || seen.has(normalizedPath)) return;
    seen.add(normalizedPath);

    out.push({
      ...entry,
      id: normalizedPath,
      path: normalizedPath,
      name: String(entry.name || normalizedPath.split('/').pop() || ''),
    });
  });

  return out;
}

function normalizeOpenCodeTabs(tabs, projectFiles) {
  const list = Array.isArray(tabs) ? tabs : [];
  const fileIds = new Set((projectFiles || []).map((f) => f.id));
  const seen = new Set();
  const out = [];

  list.forEach((tabId) => {
    const id = String(tabId || '').trim();
    if (!id || seen.has(id) || !fileIds.has(id)) return;
    seen.add(id);
    out.push(id);
  });

  return out;
}

function buildProjectPayload({
  name = '',
  board = 'arduino_uno',
  components = [],
  wires = [],
  code = '',
  includeCode = true,
  blocklyXml = '',
  blocklyGeneratedCode = '',
  useBlocklyCode = false,
  projectFiles = [],
  openCodeTabs = [],
  activeCodeFileId = '',
  exportedAt = '',
} = {}) {
  const normalizedFiles = normalizeProjectFiles(projectFiles)
    .filter((file) => file.id !== 'project/diagram.json')
    .map((file) => ({
      ...file,
      content: typeof file.content === 'string' ? file.content : String(file.content ?? ''),
    }));
  const normalizedTabs = normalizeOpenCodeTabs(openCodeTabs, normalizedFiles);
  const preferredActive = String(activeCodeFileId || '').trim();
  const resolvedActiveId = normalizedFiles.some((file) => file.id === preferredActive)
    ? preferredActive
    : (normalizedTabs[0] || normalizedFiles[0]?.id || '');

  const payload = {
    schemaVersion: 'openhw-project-v2',
    board: String(board || 'arduino_uno'),
    components: (Array.isArray(components) ? components : []).map((component) => ({
      id: String(component?.id || ''),
      type: String(component?.type || ''),
      label: String(component?.label || ''),
      x: Number(component?.x ?? 0),
      y: Number(component?.y ?? 0),
      w: Number(component?.w ?? 0),
      h: Number(component?.h ?? 0),
      rotation: Number(component?.rotation ?? 0),
      attrs: component?.attrs && typeof component.attrs === 'object' ? component.attrs : {},
    })),
    connections: (Array.isArray(wires) ? wires : []).map((wire) => ({
      id: String(wire?.id || ''),
      from: String(wire?.from || ''),
      to: String(wire?.to || ''),
      color: String(wire?.color || ''),
      waypoints: Array.isArray(wire?.waypoints) ? wire.waypoints : [],
      isBelow: wire?.isBelow === true,
      fromLabel: String(wire?.fromLabel || ''),
      toLabel: String(wire?.toLabel || ''),
    })),
    blocklyXml: String(blocklyXml || ''),
    blocklyGeneratedCode: String(blocklyGeneratedCode || ''),
    useBlocklyCode: !!useBlocklyCode,
    projectFiles: normalizedFiles,
    openCodeTabs: normalizedTabs,
    activeCodeFileId: resolvedActiveId,
  };

  if (includeCode) {
    payload.code = String(code || '');
  }

  if (name) payload.name = String(name);
  if (exportedAt) payload.exportedAt = String(exportedAt);
  return payload;
}

function normalizeImportedCircuitData(rawComponents, rawConnections) {
  const componentsInput = Array.isArray(rawComponents) ? rawComponents : [];
  const wiresInput = Array.isArray(rawConnections) ? rawConnections : [];

  const usedComponentIds = new Set();
  let layoutSlot = 0;

  const normalizedComponents = componentsInput
    .map((component) => {
      if (!component || typeof component !== 'object') return null;
      const type = String(component.type || '').trim();
      if (!type) return null;

      const regManifest = COMPONENT_REGISTRY[type]?.manifest || {};

      const rawId = String(component.id || '').trim();
      const id = rawId && !usedComponentIds.has(rawId)
        ? (usedComponentIds.add(rawId), rawId)
        : allocateComponentId(type, usedComponentIds);

      const defaultW = Number(regManifest.w ?? 80);
      const defaultH = Number(regManifest.h ?? 60);
      const width = Number(component.w);
      const height = Number(component.h);

      const hasX = Number.isFinite(Number(component.x));
      const hasY = Number.isFinite(Number(component.y));
      let x = Number(component.x);
      let y = Number(component.y);
      if (!hasX || !hasY) {
        const col = layoutSlot % 4;
        const row = Math.floor(layoutSlot / 4);
        x = 120 + col * 220;
        y = 80 + row * 170;
        layoutSlot += 1;
      }

      const attrs = component.attrs && typeof component.attrs === 'object'
        ? { ...component.attrs }
        : {};
      if (normalizeBoardKind(type) === 'rp2040') {
        attrs.env = normalizeRp2040Env(resolveComponentAttrString(attrs, 'env', 'native'));
      }

      return {
        ...component,
        id,
        type,
        label: String(component.label || regManifest.label || type),
        x,
        y,
        w: Number.isFinite(width) && width > 0
          ? width
          : (Number.isFinite(defaultW) && defaultW > 0 ? defaultW : 80),
        h: Number.isFinite(height) && height > 0
          ? height
          : (Number.isFinite(defaultH) && defaultH > 0 ? defaultH : 60),
        rotation: Number.isFinite(Number(component.rotation))
          ? ((Number(component.rotation) % 360) + 360) % 360
          : 0,
        attrs,
      };
    })
    .filter(Boolean);

  const endpointLabel = (endpoint) => {
    const parts = String(endpoint || '').split(':');
    return parts.length > 1 ? parts.slice(1).join(':') : '';
  };

  const normalizeWaypoint = (point) => {
    if (!point || typeof point !== 'object') return null;
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y, ...(point._corner ? { _corner: true } : {}) };
  };

  const usedWireIds = new Set();
  const allocateWireId = () => {
    let idx = 1;
    let candidate = `w${idx}`;
    while (usedWireIds.has(candidate)) {
      idx += 1;
      candidate = `w${idx}`;
    }
    usedWireIds.add(candidate);
    return candidate;
  };

  const normalizedWires = wiresInput
    .map((wire) => {
      if (!wire || typeof wire !== 'object') return null;
      const from = String(wire.from || '').trim();
      const to = String(wire.to || '').trim();
      if (!from || !to) return null;

      const rawWireId = String(wire.id || '').trim();
      const id = rawWireId && !usedWireIds.has(rawWireId)
        ? (usedWireIds.add(rawWireId), rawWireId)
        : allocateWireId();

      return {
        ...wire,
        id,
        from,
        to,
        color: typeof wire.color === 'string' && wire.color.trim() ? wire.color : wireColor(),
        waypoints: Array.isArray(wire.waypoints)
          ? wire.waypoints.map(normalizeWaypoint).filter(Boolean)
          : [],
        isBelow: wire.isBelow === true,
        fromLabel: String(wire.fromLabel || endpointLabel(from) || ''),
        toLabel: String(wire.toLabel || endpointLabel(to) || ''),
      };
    })
    .filter(Boolean);

  return { components: normalizedComponents, wires: normalizedWires };
}

function isRp2040CoreMissingError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes("platform 'rp2040:rp2040' not found")
    || msg.includes('platform rp2040:rp2040 is not found')
    || msg.includes('platform not installed');
}

function looksLikeMicroPythonSource(source) {
  const text = String(source || '').trim();
  if (!text) return false;
  const lower = text.toLowerCase();

  return lower.includes('from machine import')
    || lower.includes('import machine')
    || lower.includes('machine.pin(')
    || lower.includes('while true:')
    || lower.includes('sleep_ms(')
    || lower.includes('sleep_us(');
}

/**
 * Best-effort converter: takes a simple Arduino blink sketch and returns
 * a MicroPython equivalent. Extracts the LED pin from #define / const,
 * and delay values from delay() calls. Falls back gracefully.
 */
function arduinoBlinkToMicroPython(sourceCode, boardId) {
  const src = String(sourceCode || '');

  // Extract LED pin number: #define LED <n> or const int LED = <n> or similar
  const pinMatch =
    src.match(/#define\s+\w*LED\w*\s+(\d+)/i) ||
    src.match(/const\s+\w+\s+\w*LED\w*\s*=\s*(\d+)/i) ||
    src.match(/int\s+\w*LED\w*\s*=\s*(\d+)/i) ||
    src.match(/LED_BUILTIN\b/);

  let pinExpr;
  if (pinMatch && pinMatch[1]) {
    pinExpr = pinMatch[1]; // bare numeric pin string, e.g. "20"
  } else if (src.includes('LED_BUILTIN')) {
    pinExpr = "'LED'"; // MicroPython Pico built-in LED
  } else {
    // Try to find any pin used with pinMode or digitalWrite
    const pinModeMatch = src.match(/pinMode\s*\(\s*(\d+)/) ||
                         src.match(/digitalWrite\s*\(\s*(\d+)/);
    pinExpr = pinModeMatch ? pinModeMatch[1] : "'LED'";
  }

  // Extract delay values (ms) from delay() calls (skip delayMicroseconds)
  const delayMatches = [...src.matchAll(/\bdelay\s*\(\s*(\d+)\s*\)/g)].map(m => Number(m[1]));
  const delayOn  = delayMatches[0] ?? 1000;
  const delayOff = delayMatches[1] ?? delayOn;

  // Numeric pin → bare int; quoted string stays as is
  const pinArg = /^\d+$/.test(String(pinExpr)) ? Number(pinExpr) : pinExpr;

  return (
    `# Auto-converted from Arduino sketch for ${boardId}\n` +
    `from machine import Pin\n` +
    `from time import sleep_ms\n` +
    `\n` +
    `led = Pin(${pinArg}, Pin.OUT)\n` +
    `\n` +
    `while True:\n` +
    `    led.value(1)   # LED ON\n` +
    `    sleep_ms(${delayOn})\n` +
    `    led.value(0)   # LED OFF\n` +
    `    sleep_ms(${delayOff})\n`
  );
}

function arduinoSerialToMicroPython(sourceCode, boardId) {
  const src = String(sourceCode || '');
  if (!/\bSerial1?\s*\.\s*println\s*\(/.test(src)) return '';

  const printMatches = [...src.matchAll(/\bSerial1?\s*\.\s*println\s*\(([^)]*)\)\s*;/g)]
    .map((m) => String(m[1] || '').trim())
    .filter(Boolean);
  if (printMatches.length === 0) return '';

  const pyLiteral = (expr) => {
    const e = String(expr || '').trim();
    if (/^"[\s\S]*"$/.test(e) || /^'[\s\S]*'$/.test(e)) return e;
    if (/^[0-9.+\-*/ ()]+$/.test(e)) return `str(${e})`;
    return `str(${JSON.stringify(e)})`;
  };

  const setupMsg = pyLiteral(printMatches[0]);
  const loopMsg = pyLiteral(printMatches[1] || printMatches[0]);
  const delayMatch = src.match(/\bdelay\s*\(\s*(\d+)\s*\)/i);
  const loopDelay = delayMatch ? Math.max(1, Number(delayMatch[1])) : 1000;

  return [
    `# Auto-converted Serial sketch for ${boardId}`,
    'from time import sleep_ms',
    '',
    `print(${setupMsg})`,
    '',
    'while True:',
    `  print(${loopMsg})`,
    `  sleep_ms(${loopDelay})`,
    '',
  ].join('\n');
}

function prepareRp2040SketchForSimulation(sourceCode) {
  const source = String(sourceCode || '');
  if (!source.trim()) return source;
  if (!/\bSerial1?\b/.test(source)) return source;
  if (/OPENHW_SIM_SERIAL_REWRITE/.test(source)) return source;

  const hasBlockingSerialWaitCondition = (condition) => {
    const cond = String(condition || '');
    if (!/!\s*Serial1?\b/.test(cond)) return false;
    // Keep loops like !Serial1.available() intact; only strip plain readiness waits.
    if (/!\s*Serial1?\s*(?:\.|\[)/.test(cond)) return false;
    return true;
  };

  const stripBlockingSerialWaits = (text) => String(text || '')
    // Many Arduino RP2040 sketches block forever in simulation with
    // while (!Serial) { ... } because USB CDC is not attached.
    .replace(/\bwhile\s*\(([^)]*)\)\s*;/g, (match, condition) => (
      hasBlockingSerialWaitCondition(condition)
        ? '/* OPENHW_SIM_SERIAL_WAIT_REMOVED: skip blocking serial wait in simulator. */'
        : match
    ))
    .replace(/\bwhile\s*\(([^)]*)\)\s*\{/g, (match, condition) => (
      hasBlockingSerialWaitCondition(condition)
        ? 'if (false) { /* OPENHW_SIM_SERIAL_WAIT_REMOVED */'
        : match
    ))
    .replace(/\bwhile\s*\(([^)]*)\)\s*(?!\{|;)[^;\n]*;/g, (match, condition) => (
      hasBlockingSerialWaitCondition(condition)
        ? '/* OPENHW_SIM_SERIAL_WAIT_REMOVED: skip blocking serial wait in simulator. */'
        : match
    ))
    .replace(/\bfor\s*\(\s*;\s*([^;]*?)\s*;\s*\)\s*\{/g, (match, condition) => (
      hasBlockingSerialWaitCondition(condition)
        ? 'if (false) { /* OPENHW_SIM_SERIAL_WAIT_REMOVED */'
        : match
    ))
    .replace(/\bfor\s*\(\s*;\s*([^;]*?)\s*;\s*\)\s*;/g, (match, condition) => (
      hasBlockingSerialWaitCondition(condition)
        ? '/* OPENHW_SIM_SERIAL_WAIT_REMOVED: skip blocking serial wait in simulator. */'
        : match
    ));

  const rewritten = stripBlockingSerialWaits(source.replace(/\bSerial\b(?!1)/g, 'Serial1'));
  if (rewritten === source) return source;

  const serialShim = [
    '#ifdef ARDUINO_ARCH_RP2040',
    '// OPENHW_SIM_SERIAL_REWRITE: route Serial monitor traffic to UART0 (GP0/GP1)',
    '// and prevent blocking while(!Serial...) waits in simulator mode.',
    '#endif',
    '',
  ].join('\n');

  return `${serialShim}${rewritten}`;
}

const RP2040_SIM_PROTOCOL_VERSION = 'rp2040-sim-uart0-v4';

function resolveRp2040SourceMode({
  configuredMode,
  activePrefersIno,
  activePrefersPy,
  hasNativeSketch,
  hasPythonSource,
  prefersNativeFromSyntax = false,
}) {
  const mode = String(configuredMode || 'auto').toLowerCase();

  if (mode === 'cp' || mode === 'circuitpy' || mode === 'circuitpython') {
    return 'cp';
  }

  if (mode === 'py' || mode === 'python' || mode === 'micropython') {
    return 'py';
  }

  if (mode === 'ino' || mode === 'native' || mode === 'none') return 'ino';

  if (activePrefersIno) return 'ino';
  if (activePrefersPy) return mode === 'cp' ? 'cp' : 'py';

  if (hasNativeSketch || prefersNativeFromSyntax) return 'ino';
  if (hasPythonSource) return mode === 'cp' ? 'cp' : 'py';
  return 'ino';
}

function resolveComponentAttrString(attrs, key, fallback = '') {
  const raw = attrs?.[key];
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    if (typeof raw.value === 'string') return raw.value;
    if (typeof raw.default === 'string') return raw.default;
    if (raw.value != null) return String(raw.value);
    if (raw.default != null) return String(raw.default);
  }
  if (raw == null) return fallback;
  return String(raw);
}

function ensureMicroPythonSerialProbe(sourceCode, boardId) {
  const script = String(sourceCode || '').trim();
  const marker = 'OpenHW RP2040 UART0 ready';
  if (script.includes(marker)) return script;

  const probe = `print("${marker}: ${boardId}")`;
  if (!script) return `${probe}\n`;
  return `${probe}\n${script}\n`;
}

function applyRp2040MicroPythonCompat(sourceCode) {
  const script = String(sourceCode || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!script) return script;
  if (script.includes('OPENHW_RP2040_SLEEP_COMPAT')) return script;

  const needsSleepCompat = /\btime\.sleep_ms\s*\(|\bsleep_ms\s*\(/.test(script);
  if (!needsSleepCompat) return script;

  const prelude = [
    '# OPENHW_RP2040_SLEEP_COMPAT',
    'def _openhw_sleep_ms(ms):',
    '    ms = int(ms)',
    '    if ms <= 0:',
    '        return',
    '    for _ in range(ms * 500):',
    '        pass',
    '',
  ].join('\n');

  const rewritten = script
    .replace(/\btime\.sleep_ms\s*\(/g, '_openhw_sleep_ms(')
    .replace(/\bsleep_ms\s*\(/g, '_openhw_sleep_ms(');

  return `${prelude}\n${rewritten}\n`;
}

function isProgrammableBoardType(type) {
  return /(arduino|esp32|stm32|rp2040|pico)/i.test(String(type || ''));
}


function endpointAliases(endpoint) {
  const [compId, pinIdRaw] = String(endpoint || '').split(':');
  const pinId = String(pinIdRaw || '');
  if (!compId || !pinId) return [String(endpoint || '')];

  const aliases = new Set([`${compId}:${pinId}`]);
  if (/^\d+$/.test(pinId)) aliases.add(`${compId}:D${pinId}`);
  if (/^D\d+$/i.test(pinId)) aliases.add(`${compId}:${pinId.substring(1)}`);
  if (/^gnd(_\d+)?$/i.test(pinId) || /^GND$/i.test(pinId)) aliases.add(`${compId}:gnd`);
  if (/^5v$/i.test(pinId) || /^VCC$/i.test(pinId)) aliases.add(`${compId}:5V`);
  return Array.from(aliases);
}

function validateCircuitLocally(components, wires) {
  const errors = [];
  const componentById = new Map((components || []).map((c) => [c.id, c]));

  const programmableBoards = (components || []).filter((c) => isProgrammableBoardType(c.type));
  if (programmableBoards.length === 0) return errors;

  const graph = new Map();
  const addEdge = (a, b) => {
    if (!graph.has(a)) graph.set(a, new Set());
    if (!graph.has(b)) graph.set(b, new Set());
    graph.get(a).add(b);
    graph.get(b).add(a);
  };

  (wires || []).forEach((w) => {
    const fromAliases = endpointAliases(w.from);
    const toAliases = endpointAliases(w.to);
    fromAliases.forEach((fa) => toAliases.forEach((ta) => addEdge(fa, ta)));
  });

  const isMcuDigitalEndpoint = (endpoint) => {
    const [compId, pin] = String(endpoint || '').split(':');
    const comp = componentById.get(compId);
    if (!comp || !isProgrammableBoardType(comp.type)) return false;
    if (!pin) return false;
    return /^D?\d+$/i.test(pin) || /^A\d+$/i.test(pin);
  };

  const bfsReachable = (starts) => {
    const q = [...starts];
    const visited = new Set(starts);
    while (q.length) {
      const n = q.shift();
      for (const nei of graph.get(n) || []) {
        if (visited.has(nei)) continue;
        visited.add(nei);
        q.push(nei);
      }
    }
    return visited;
  };

  programmableBoards.forEach((board) => {
    const powerPins = [`${board.id}:5V`, `${board.id}:3v3`, `${board.id}:VCC`];
    const gndPins = [`${board.id}:gnd`, `${board.id}:gnd_1`, `${board.id}:gnd_2`, `${board.id}:gnd_3`, `${board.id}:GND`];
    const reachable = bfsReachable(powerPins);
    const isShorted = gndPins.some((g) => reachable.has(g) || reachable.has(`${board.id}:gnd`));
    if (isShorted) {
      errors.push({
        type: 'error',
        message: `Potential short circuit on ${board.id}: power net is connected to GND.`,
        compIds: [board.id],
      });
    }
  });

  // LED should not be directly connected between two MCU GPIO pins in this simulator.
  const leds = (components || []).filter((c) => String(c.type || '').toLowerCase() === 'wokwi-led');
  leds.forEach((led) => {
    const anode = `${led.id}:A`;
    const cathode = `${led.id}:K`;
    const anodeN = [...(graph.get(anode) || [])];
    const cathodeN = [...(graph.get(cathode) || [])];

    const anodeMcu = anodeN.filter(isMcuDigitalEndpoint);
    const cathodeMcu = cathodeN.filter(isMcuDigitalEndpoint);

    if (anodeMcu.length > 0 && cathodeMcu.length > 0) {
      const involved = new Set([led.id]);
      [...anodeMcu, ...cathodeMcu].forEach((ep) => involved.add(String(ep).split(':')[0]));
      errors.push({
        type: 'error',
        message: `Invalid LED wiring on ${led.id}: anode and cathode are tied to MCU GPIO pins. Connect LED through a resistor to VCC/GND instead of pin-to-pin drive.`,
        compIds: [...involved],
      });
    }
  });

  return errors;
}

/**
 * Helper to check if two category sets (strings or arrays) have any common elements.
 */
function hasCategoryIntersection(cat1, cat2) {
  if (!cat1 || !cat2) return false;
  const arr1 = Array.isArray(cat1) ? cat1 : [cat1];
  const arr2 = Array.isArray(cat2) ? cat2 : [cat2];
  return arr1.some(c => arr2.includes(c));
}

/**
 * Determines the logical category (or categories) of a pin.
 * Returns an array of strings, or null if no category matches.
 */
function getPinCategory(pId, pDesc, compType) {
  const sId = String(pId || '').toLowerCase();
  const sDesc = String(pDesc || '').toLowerCase();
  const matches = (regex) => regex.test(sId) || regex.test(sDesc);
  const categories = [];

  // 1. GND
  if (matches(/^([a-z0-9]+[._])?(gnd|vss|0v|ground|com)([._]?\d+)?$/i)) categories.push('GND');

  // 2. POWER
  if (matches(/^([a-z0-9]+[._])?(vcc|vdd|5v|3v3|3\.3v|v\+|power|vcc[12]|vbat|1\.8v|led|light|vout)([._]?\d+)?$/i)) {
    if (compType?.includes('arduino') && (sId === 'vin' || sId.includes('vin.'))) {
      categories.push('VIN');
    } else {
      categories.push('POWER');
    }
  }

  // 3. I2C
  if (matches(/^sda([._]?\d+)?$/i)) categories.push('I2C_SDA');
  if (matches(/^scl([._]?\d+)?$/i)) categories.push('I2C_SCL');
  if ((compType === 'wokwi-arduino-uno' || compType === 'wokwi-arduino-nano')) {
    if (sId === 'a4') categories.push('I2C_SDA');
    if (sId === 'a5') categories.push('I2C_SCL');
  }

  // 4. SPI
  if (matches(/^(mosi|din|dn|sdi)([._]?\d+)?$/i)) categories.push('SPI_MOSI');
  if (matches(/^(miso|dout|sdo)([._]?\d+)?$/i)) categories.push('SPI_MISO');
  if (matches(/^(sck|sclk|clk|clock)([._]?\d+)?$/i)) categories.push('SPI_SCK');

  // 5. ANALOG
  if (matches(/^(a\d+|vrx|vry|an|adc|out)([._]?\d+)?$/i)) {
    if (sId === 'vrx' || (compType?.includes('arduino') && sId === 'a0')) categories.push('ANALOG_X');
    if (sId === 'vry' || (compType?.includes('arduino') && sId === 'a1')) categories.push('ANALOG_Y');
    categories.push('ANALOG');
  }

  // 6. PWM
  if (matches(/^(pwm|~)([._]?\d+)?$/i)) categories.push('PWM');
  if ((compType === 'wokwi-arduino-uno' || compType === 'wokwi-arduino-nano') && ['3', '5', '6', '9', '10', '11'].includes(sId)) categories.push('PWM');
  if (compType === 'wokwi-arduino-mega') {
    const pinNum = parseInt(sId);
    if ((pinNum >= 2 && pinNum <= 13) || [44, 45, 46].includes(pinNum)) categories.push('PWM');
  }

  // 7. Motor Driver / EN Special (Enable can be PWM or POWER)
  if (matches(/^en([._]?\d+(,\d+)?)?$/i)) {
    if (!categories.includes('PWM')) categories.push('PWM');
    if (!categories.includes('POWER')) categories.push('POWER');
  }

  // 8. MOTOR OUTPUT
  if (matches(/^(out\d+)([._]?\d+)?$/i) || ((compType === 'wokwi-motor' || compType === 'wokwi-stepper-motor') && /^\d+$/.test(sId))) {
    categories.push('MOTOR');
  }

  // 9. DIGITAL
  if (matches(/^(d\d+|io\d+|gpio\d+|sw|joy_sw|dc|rst|reset|cs|ce|sce|ss|rs|en|enable|in\d+|\d+)([._]?\d+)?$/i)) {
    if (!(compType?.includes('arduino') && sId.startsWith('a'))) {
      if (!categories.includes('DIGITAL')) categories.push('DIGITAL');
    }
  }

  // 10. Breadboard
  if (compType?.startsWith('wokwi-breadboard') && /^\d+[a-j]$/i.test(sId)) {
    const colNum = sId.match(/^\d+/)[0];
    const rowLetter = sId.slice(-1);
    const rowHalf = 'abcde'.includes(rowLetter) ? 'top' : 'bottom';
    categories.push(`BB_${colNum}_${rowHalf}`);
  }

  return categories.length > 0 ? categories : null;
}

export default function SimulatorPage({ gamificationMode = false }) {
  const { isAuthenticated, user, logout, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { projectName = '', shareId = '' } = useParams()
  const location = useLocation()
  const assessmentParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const assessmentMode = assessmentParams.get('mode') === 'assessment'
  const assessmentProjectName = assessmentParams.get('project') || projectName

  // -- Gamification --
  const { trackComponentPlaced, trackWireDrawn, trackSimulationRun, isUnlocked, coins = 0, currentLevel, currentLevelData, nextLevel, xpProgress } = typeof useGamification === 'function' ? useGamification() : {}
  const gamProject = useMemo(() => gamificationMode && typeof PROJECTS !== 'undefined' ? (PROJECTS.find(p => p.slug === projectName) ?? null) : null, [gamificationMode, projectName])
  const [gamPanelOpen, setGamPanelOpen] = useState(true)
  const [gamTab, setGamTab] = useState('components')

  const WOKWI_TO_COMP_ID = useMemo(() => ({
    'wokwi-led':                    'led',
    'wokwi-resistor':               'resistor',
    'wokwi-pushbutton':             'button',
    'wokwi-potentiometer':          'potentiometer',
    'wokwi-buzzer':                 'buzzer',
    'wokwi-rgb-led':                'rgb-led',
    'wokwi-ntc-temperature-sensor': 'dht11',
    'wokwi-hc-sr04':                'ultrasonic',
    'wokwi-servo':                  'servo',
    'wokwi-lcd1602':                'lcd',
    'wokwi-analog-joystick':        'analog-joystick',
    'wokwi-membrane-keypad':        'keypad',
  }), [])

  const isPaletteItemLocked = useCallback((itemType) => {
    if (!gamificationMode) return false
    const compId = WOKWI_TO_COMP_ID[itemType]
    if (!compId) return false
    return isUnlocked ? !isUnlocked(compId) : false
  }, [gamificationMode, isUnlocked, WOKWI_TO_COMP_ID])

  const [lockToast, setLockToast] = useState(null)
  const showLockToast = useCallback((label, compId) => {
    setLockToast({ label, compId })
    setTimeout(() => setLockToast(null), 3500)
  }, [])

  const gamProjectComponents = useMemo(() => {
    if (!gamProject?.components) return []
    return gamProject.components.map(c => {
      const compId = WOKWI_TO_COMP_ID[c.type]
      const compDef = compId && typeof COMPONENT_MAP !== 'undefined' ? COMPONENT_MAP[compId] : null
      const isLocked = compId && isUnlocked ? !isUnlocked(compId) : false
      return { ...c, compId, compDef, isLocked }
    })
  }, [gamProject, isUnlocked, WOKWI_TO_COMP_ID])

  const gamLockedCount = gamProjectComponents.filter(c => c.isLocked && c.compId).length
  const gamAllUnlocked = gamProject ? gamLockedCount === 0 : true

  const handleAssessmentSubmit = async () => {
    if (!assessmentMode && !gamificationMode) return;
    const assessmentName = assessmentMode ? assessmentProjectName : projectName;
    if (!assessmentName) {
      alert('Assessment project is missing. Please open assessment from the project page.');
      return;
    }
    setIsSubmittingAssessment(true);
    try {
      const payload = {
        projectName: assessmentName,
        submittedAt: new Date().toISOString(),
        components,
        wires,
        code,
      };
      sessionStorage.setItem(`openhw_assessment_submission:${assessmentName}`, JSON.stringify(payload));
      navigate(`/${assessmentName}/assessment`);
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const handleGamificationSubmit = useCallback(() => {
    if (!gamAllUnlocked) {
      alert(`Unlock ${gamLockedCount} component${gamLockedCount > 1 ? 's' : ''} first!`)
      return
    }
    handleAssessmentSubmit()
  }, [gamAllUnlocked, gamLockedCount, handleAssessmentSubmit])

  // Theme Logic — defaults to light mode
  const [theme, setTheme] = useState(() => {
    const t = document.documentElement.getAttribute('data-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
    return t;
  })

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const [, setCustomCatalogCounter] = useState(0); // Trigger palette re-render on injection
  const [previewBanner, setPreviewBanner] = useState(null); // { id, label } — set when opened from admin "Test in Simulator"
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false)
  const [components, setComponents] = useState([])
  const [wires, setWires] = useState([])
  const [paletteSearch, setPaletteSearch] = useState('')

  const [history, setHistory] = useState({ past: [], future: [] })
  const [selected, setSelected] = useState(null)   // comp or wire id
  const [wireStart, setWireStart] = useState(null)   // { compId, pinId, pinLabel, x, y }
  const [wireClickPos, setWireClickPos] = useState(null) // canvas-space position where wire was clicked
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  // Segment-drag: tracks which wire segment handle is being dragged
  // { wireId, segIdx, isHoriz, startMouseCanvas: {x,y}, startPts: [...] }
  const [segDrag, setSegDrag] = useState(null)
  const segDragRef = useRef(null)
  const [hoveredPin, setHoveredPin] = useState(null)
  const [board, setBoard] = useState('arduino_uno')
  const [codeTab, setCodeTab] = useState('code')
  const [code, setCode] = useState('void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n')
  const [blocklyXml, setBlocklyXml] = useState('')
  const [blocklyGeneratedCode, setBlocklyGeneratedCode] = useState('')
  const [useBlocklyCode, setUseBlocklyCode] = useState(false)
  const [blocklyDisabled, setBlocklyDisabled] = useState(() => {
    try {
      const saved = localStorage.getItem('ohw_blockly_disabled');
      // Default is DISABLED (true) if never explicitly set
      return saved === null ? true : saved === 'true';
    } catch (_) { return true; }
  })
  const [projectFiles, setProjectFiles] = useState([])
  const [openCodeTabs, setOpenCodeTabs] = useState([])
  const [activeCodeFileId, setActiveCodeFileId] = useState('')
  const [showCodeExplorer, setShowCodeExplorer] = useState(true)
  const suppressCodeSyncRef = useRef(false)
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [isPaletteHovered, setIsPaletteHovered] = useState(false)
  const [panelWidth, setPanelWidth] = useState(580)
  const [explorerWidth, setExplorerWidth] = useState(190)
  const [isDragging, setIsDragging] = useState(false)
  const [isExplorerDragging, setIsExplorerDragging] = useState(false)
  // Palette redesign state
  const [paletteViewMode, setPaletteViewMode] = useState('grid') // 'list' | 'grid'
  const [favoriteComponents, setFavoriteComponents] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('openhw_fav_components') || '[]')); }
    catch { return new Set(); }
  })
  const [activeGroupFilter, setActiveGroupFilter] = useState('All')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showFavorites, setShowFavorites] = useState(true)
  const [paletteContextMenu, setPaletteContextMenu] = useState(null) // { x, y, item }
  const [selectedPaletteItem, setSelectedPaletteItem] = useState(null) // item for description panel
  const [showComponentDesc, setShowComponentDesc] = useState(true) // description panel visible
  const [showCreateComponentModal, setShowCreateComponentModal] = useState(false)
  const paletteContextMenuRef = useRef(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [showCanvasMenu, setShowCanvasMenu] = useState(false)
  const [showConnectionsPanel, setShowConnectionsPanel] = useState(true)
  const [wirepointsEnabled, setWirepointsEnabled] = useState(false)
  const canvasZoomRef = useRef(1)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const canvasOffsetRef = useRef({ x: 0, y: 0 })
  const [isCanvasLocked, setIsCanvasLocked] = useState(false)
  const isCanvasLockedRef = useRef(false)
  const [showGrid, setShowGrid] = useState(true)
  const [isPinMappingExpanded, setIsPinMappingExpanded] = useState(false)
  const [pendingPinColors, setPendingPinColors] = useState({}) // { [pinIdStr]: color }
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Reset Pin Mapping expansion when a new component is selected
  useEffect(() => {
    setIsPinMappingExpanded(false)
  }, [selected])
  const [quickAdd, setQuickAdd] = useState(null)   // { screenX, screenY, canvasX, canvasY }
  const [quickAddSearch, setQuickAddSearch] = useState('')
  const [quickAddIdx, setQuickAddIdx] = useState(0)
  const quickAddInputRef = useRef(null)
  const pageRef = useRef(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const didPanRef = useRef(false)

  const [validationErrors, setValidationErrors] = useState([])
  const [showValidation, setShowValidation] = useState(true)
  const [validationToast, setValidationToast] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isCompiling, setIsCompiling] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [pinStates, setPinStates] = useState({})
  const [neopixelData, setNeopixelData] = useState({})
  const [oopStates, setOopStates] = useState({});
  const [serialHistory, setSerialHistory] = useState([]);
  const [serialInput, setSerialInput] = useState('');
  const [serialPaused, setSerialPaused] = useState(false);
  const [serialViewMode, setSerialViewMode] = useState('monitor'); // 'monitor' | 'plotter'
  const [serialBoardFilter, setSerialBoardFilter] = useState('all');
  const [serialBaudRate, setSerialBaudRate] = useState('9600');
  const [serialLineEnding, setSerialLineEnding] = useState(() => {
    try {
      const saved = String(localStorage.getItem('openhw.serial.lineEnding') || '').toLowerCase();
      return Object.prototype.hasOwnProperty.call(SERIAL_LINE_ENDINGS, saved) ? saved : 'nl';
    } catch {
      return 'nl';
    }
  });
  const [rp2040DebugTelemetryEnabled, setRp2040DebugTelemetryEnabled] = useState(() => {
    try {
      const saved = String(localStorage.getItem('openhw.rp2040.debugTelemetry') || '').toLowerCase();
      return saved === '1' || saved === 'true' || saved === 'on';
    } catch {
      return false;
    }
  });
  const [hardwareBoardId, setHardwareBoardId] = useState('');
  const [hardwareSerialTargetId, setHardwareSerialTargetId] = useState(null);
  const [hardwareStatus, setHardwareStatus] = useState('Not connected');
  const serialOutputRef = useRef(null);
  const lastHardwareStatusRef = useRef('');
  const hardwareSerialTargetRef = useRef(null);
  const renderPinsByBoardRef = useRef({});
  const renderAnalogByBoardRef = useRef({});
  const renderComponentsByBoardRef = useRef({});
  const renderNeopixelsByBoardRef = useRef({});

  const {
    consoleEntries,
    isConsoleOpen,
    setIsConsoleOpen,
    consoleHeight,
    setConsoleHeight,
    appendConsoleEntry,
    clearConsoleEntries,
    downloadConsoleLog,
  } = useSimulationConsole();

  // Pinch-to-zoom state refs

  // Plotter State
  const [plotData, setPlotData] = useState([]);
  const [selectedPlotPins, setSelectedPlotPins] = useState(['13', 'A0']);
  const plotterCanvasRef = useRef(null);
  const [plotterPaused, setPlotterPaused] = useState(false);

  const serialBoardOptions = useMemo(() => {
    const ids = components
      .filter(c => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type))
      .map(c => c.id)
      .sort((a, b) => a.localeCompare(b));
    if (hardwareBoardId && !ids.includes(hardwareBoardId)) ids.push(hardwareBoardId);
    if (hardwareSerialTargetId && !ids.includes(hardwareSerialTargetId)) ids.push(hardwareSerialTargetId);
    return ['all', ...ids];
  }, [components, hardwareBoardId, hardwareSerialTargetId]);

  const serialBoardLabels = useMemo(() => {
    const labels = { all: 'All Boards' };
    serialBoardOptions.forEach((id) => {
      if (id === 'all') return;
      if (id.startsWith('hw:')) {
        labels[id] = `${id.slice(3)} (WebSerial)`;
      } else {
        labels[id] = id;
      }
    });
    return labels;
  }, [serialBoardOptions]);

  const serialBoardKinds = useMemo(() => {
    const kinds = {};
    components
      .filter((c) => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type))
      .forEach((c) => {
        kinds[c.id] = normalizeBoardKind(c.type);
      });
    return kinds;
  }, [components]);

  const serialBoardMap = useMemo(() => {
    const m = new Map();
    components.forEach((c) => m.set(c.id, c));
    return m;
  }, [components]);

  const selectedSerialBoardKind = useMemo(() => {
    if (serialBoardFilter !== 'all') {
      const comp = serialBoardMap.get(serialBoardFilter);
      if (comp) return normalizeBoardKind(comp.type);
    }
    return normalizeBoardKind(board);
  }, [serialBoardFilter, serialBoardMap, board]);

  const serialBaudOptions = useMemo(() => {
    return BOARD_BAUD_PRESETS[selectedSerialBoardKind] || BOARD_BAUD_PRESETS.arduino_uno;
  }, [selectedSerialBoardKind]);

  const projectFileMap = useMemo(() => {
    const m = new Map();
    projectFiles.forEach((f) => m.set(f.id, f));
    return m;
  }, [projectFiles]);

  const activeCodeFile = useMemo(() => projectFileMap.get(activeCodeFileId) || null, [projectFileMap, activeCodeFileId]);

  const boardComponents = useMemo(() => components.filter(c => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type)), [components]);
  const boardComponentMap = useMemo(() => {
    const map = new Map();
    boardComponents.forEach((component) => {
      map.set(component.id, component);
    });
    return map;
  }, [boardComponents]);
  const rp2040BoardSourceModes = useMemo(() => {
    const modes = {};
    boardComponents.forEach((component) => {
      if (normalizeBoardKind(component.type) !== 'rp2040') return;
      modes[component.id] = normalizeRp2040Env(resolveComponentAttrString(component?.attrs, 'env', 'native'));
    });
    return modes;
  }, [boardComponents]);
  const firmwareBoardOptions = useMemo(() => {
    return boardComponents
      .map((comp) => ({
        id: comp.id,
        label: boardCompToDisplayName(comp, normalizeBoardKind(comp.type)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [boardComponents]);
  const webSerialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;

  useEffect(() => {
    if (boardComponents.length === 0) {
      setHardwareBoardId('');
      return;
    }
    const hasCurrent = hardwareBoardId && boardComponents.some((b) => b.id === hardwareBoardId);
    if (!hasCurrent) setHardwareBoardId(boardComponents[0].id);
  }, [boardComponents, hardwareBoardId]);

  // PNG Export State
  const [isExporting, setIsExporting] = useState(false);
  const [showFirmwareDownloadDialog, setShowFirmwareDownloadDialog] = useState(false);
  const [firmwareDownloadTarget, setFirmwareDownloadTarget] = useState('');
  const [showFirmwareUploadDialog, setShowFirmwareUploadDialog] = useState(false);
  const [firmwareUploadTarget, setFirmwareUploadTarget] = useState('');
  const [firmwareUploadFile, setFirmwareUploadFile] = useState(null);
  const [isApplyingFirmwareUpload, setIsApplyingFirmwareUpload] = useState(false);
  const [runStartedAtMs, setRunStartedAtMs] = useState(null);
  const [runDurationSec, setRunDurationSec] = useState(0);
  const simulationSpeed = 1;
  const simulationSpeedPercent = Math.max(0, Math.round(simulationSpeed * 100));

  // View Panel State
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [viewPanelSection, setViewPanelSection] = useState(null); // null | 'schematic' | 'components'
  const [schematicLoading, setSchematicLoading] = useState(false);
  const [schematicDataUrl, setSchematicDataUrl] = useState(null);

  useEffect(() => {
    if (!showFirmwareDownloadDialog) return;

    if (firmwareDownloadTarget === '__all__' || firmwareDownloadTarget === '__latest__') {
      return;
    }

    const hasTarget = firmwareBoardOptions.some((opt) => opt.id === firmwareDownloadTarget);
    if (!hasTarget) {
      setFirmwareDownloadTarget(firmwareBoardOptions[0]?.id || '__latest__');
    }
  }, [showFirmwareDownloadDialog, firmwareDownloadTarget, firmwareBoardOptions]);

  useEffect(() => {
    if (!showFirmwareUploadDialog) return;
    const hasTarget = firmwareBoardOptions.some((opt) => opt.id === firmwareUploadTarget);
    if (!hasTarget) {
      setFirmwareUploadTarget(firmwareBoardOptions[0]?.id || '');
    }
  }, [showFirmwareUploadDialog, firmwareUploadTarget, firmwareBoardOptions]);

  const workerRef = useRef(null)
  const lastCompiledRef = useRef(null)
  const micropythonUf2PayloadRef = useRef(null)
  const circuitPythonUf2PayloadRef = useRef(null)
  const rp2040DebugLastLogRef = useRef(new Map())
  const rp2040WirelessLastLogRef = useRef(new Map())
  const rp2040GdbLastLogRef = useRef(new Map())
  const rp2040UartMicroPythonBoardsRef = useRef(new Set())
  const rp2040UartSilentWarnedBoardsRef = useRef(new Set())
  const runStartGuardRef = useRef(false)
  const runComponentUpdateCountsRef = useRef({})
  const runPinTransitionCountsRef = useRef({})
  const runLastBoardPinsRef = useRef(new Map())
  const neopixelRefs = useRef({})

  const serialPlotBufferRef = useRef('');
  const serialPlotLabelsRef = useRef([]);
  const latestParsedSerialRef = useRef([]);
  const serialIngressArbitrationRef = useRef(new Map());
  const serialPausedRef = useRef(false);
  const serialPausedQueueRef = useRef([]);

  const canvasRef = useRef(null)
  const innerCanvasRef = useRef(null)   // ref to the zoom-wrapper div — used for CSS-transform panning (Fix #4)
  const rafMoveRef = useRef(null)       // pending rAF id for mousemove throttle (Fixes #1-#4)
  const pendingMoveRef = useRef(null)   // latest computed move data, read by the rAF callback
  const svgRef = useRef(null)
  const viewPanelRef = useRef(null)
  const schematicSvgRef = useRef(null)
  const dragPayload = useRef(null)
  const movingComp = useRef(null)
  const componentZipInputRef = useRef(null);
  const firmwareUploadInputRef = useRef(null);
  // Reactive refs — kept current every render so async effects get fresh values
  const getPinPosRef = useRef(null);
  const componentsRef = useRef([]);
  const pinDefsRef = useRef({});

  // ── Project persistence state ────────────────────────────────────────────────
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentProjectName, setCurrentProjectName] = useState('Untitled');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showF1Menu, setShowF1Menu] = useState(false);
  const [saveDialogName, setSaveDialogName] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [shareVisibility, setShareVisibility] = useState('public');
  const [myProjects, setMyProjects] = useState([]);
  const [isSharingSimulation, setIsSharingSimulation] = useState(false);
  const currentProjectIdRef = useRef(null);   // mirror for use inside async callbacks
  const autoSaveTimerRef = useRef(null);
  // My Projects sidebar state
  const [showProjectsSidebar, setShowProjectsSidebar] = useState(false);
  const [projectsSidebarTab, setProjectsSidebarTab] = useState('projects'); // 'favourites' | 'projects' | 'custom' | 'settings'
  const [favouriteProjectIds, setFavouriteProjectIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ohw_favourite_projects') || '[]'); }
    catch { return []; }
  });
  const [projContextMenu, setProjContextMenu] = useState(null); // { proj, x, y }
  const [renamingProjectId, setRenamingProjectId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    try {
      const val = localStorage.getItem('ohw_autosave_enabled');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });
  const backupRestoreInputRef = useRef(null);

  const handleUploadZip = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    appendConsoleEntry('info', `ZIP upload started: ${file.name}`, 'zip');
    try {
      const zip = await JSZip.loadAsync(file);
      let manifestStr = null, uiStr = null, logicStr = null, validationStr = null, indexStr = null, docHtml = null;
      for (const relativePath of Object.keys(zip.files)) {
        if (relativePath.endsWith('manifest.json')) manifestStr = await zip.files[relativePath].async('string');
        if (relativePath.endsWith('ui.tsx') || relativePath.endsWith('ui.jsx')) uiStr = await zip.files[relativePath].async('string');
        if (relativePath.endsWith('logic.ts') || relativePath.endsWith('logic.js')) logicStr = await zip.files[relativePath].async('string');
        if (relativePath.endsWith('validation.ts') || relativePath.endsWith('validation.js')) validationStr = await zip.files[relativePath].async('string');
        if (relativePath.endsWith('index.ts') || relativePath.endsWith('index.js')) indexStr = await zip.files[relativePath].async('string');
        // Doc folder — any HTML file inside doc/ directory
        if (/\/doc\/.*\.html$/i.test(relativePath) || /^doc\/.*\.html$/i.test(relativePath)) {
          docHtml = await zip.files[relativePath].async('string');
        }
      }
      if (!manifestStr || !uiStr || !logicStr || !validationStr || !indexStr) {
        appendConsoleEntry('error', 'ZIP upload failed: required files are missing.', 'zip');
        alert('Error: Zip must contain manifest.json, ui.tsx, logic.ts, validation.ts, and index.ts');
        return;
      }
      const manifest = JSON.parse(manifestStr);
      const submitPayload = {
        id: manifest.type, manifest, ui: uiStr, logic: logicStr, validation: validationStr, index: indexStr,
        ...(docHtml ? { doc: docHtml } : {})
      };

      let submitted = false;
      let offlineQueued = false;
      try {
        await submitCustomComponent(submitPayload);
        submitted = true;
        appendConsoleEntry('info', `ZIP submitted to admin: ${manifest.type}`, 'zip');
      } catch (submitErr) {
        // Network unavailable — queue for later submission when back online
        await enqueueComponent(submitPayload);
        offlineQueued = true;
        appendConsoleEntry('warn', `Offline mode: queued ${manifest.type} for later submission.`, 'zip');
      }

      // --- ZERO-TOUCH SANDBOX INJECTION ---
      const Babel = await getBabel();
      const transpileUI = Babel.transform(uiStr, { filename: 'ui.tsx', presets: ['react', 'typescript', 'env'] }).code;
      const transpileLogic = Babel.transform(logicStr, { filename: 'logic.ts', presets: ['typescript', 'env'] }).code;

      const exportsUI = {};
      const evalUI = new Function('exports', 'require', 'React', transpileUI);
      evalUI(exportsUI, (mod) => {
        if (mod === 'react') return React;
        return null;
      }, React);

      const uiComponent = resolveUiExport(exportsUI);
      const contextMenu = exportsUI[Object.keys(exportsUI).find(k => k.toLowerCase().includes('contextmenu'))];

      if (uiComponent) {
        const newCatItem = { ...manifest };
        delete newCatItem.pins;
        delete newCatItem.group;

        const groupName = normalizeGroupName(manifest.group);
        let group = LOCAL_CATALOG.find(g => g.group === groupName);
        if (!group) {
          group = { group: groupName, items: [] };
          LOCAL_CATALOG.push(group);
        }
        group.items = group.items.filter(i => i.type !== manifest.type);
        group.items.push(newCatItem);
        sortCatalog(LOCAL_CATALOG);

        COMPONENT_REGISTRY[manifest.type] = {
          manifest,
          UI: uiComponent,
          BOUNDS: exportsUI.BOUNDS,
          ContextMenu: contextMenu,
          contextMenuDuringRun: !!(exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun),
          contextMenuOnlyDuringRun: !!(exportsUI.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun),
          logicCode: transpileLogic,
          uiRaw: uiStr,
          logicRaw: logicStr,
          validationRaw: validationStr,
          indexRaw: indexStr,
          ...(docHtml ? { doc: docHtml } : {})
        };
        if (manifest.pins) {
          LOCAL_PIN_DEFS[manifest.type] = manifest.pins;
        }
        setCustomCatalogCounter(c => c + 1);
        if (submitted) {
          appendConsoleEntry('info', `Component injected successfully: ${manifest.label}`, 'zip');
          alert(`Successfully submitted to admin AND injected ${manifest.label} into your local Sandbox Memory!`);
        } else if (offlineQueued) {
          appendConsoleEntry('warn', `Component injected locally while offline: ${manifest.label}`, 'zip');
          alert(`You are offline. "${manifest.label}" has been injected locally and will be submitted to the admin automatically when you reconnect.`);
        }
      }
    } catch (e) {
      appendConsoleEntry('error', `ZIP processing failed: ${e.message}`, 'zip');
      alert(`Error processing ZIP: ${e.message}`);
    }
    event.target.value = '';
  };

  // ── Library Manager State ───────────────────────────────────────────────────
  const [libQuery, setLibQuery] = useState('')
  const [libResults, setLibResults] = useState([])
  const [libInstalled, setLibInstalled] = useState([])
  const [isSearchingLib, setIsSearchingLib] = useState(false)
  const [installingLib, setInstallingLib] = useState(null)
  const [libMessage, setLibMessage] = useState(null)
  const libSearchCache = useRef({});

  useEffect(() => {
    if (!libQuery.trim() || libQuery.trim().length < 2) {
      setLibResults([]);
      return;
    }

    // Check cache first
    if (libSearchCache.current[libQuery.trim()]) {
      setLibResults(libSearchCache.current[libQuery.trim()]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLib(true);
      try {
        const results = await searchLibraries(libQuery);
        libSearchCache.current[libQuery.trim()] = results;
        setLibResults(results);
      } catch (err) {
        console.error('[Library Search Error]', err);
      } finally {
        setIsSearchingLib(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [libQuery]);

  const loadLibraries = async () => {
    try {
      const libraries = await fetchInstalledLibraries();
      setLibInstalled(libraries);
      setLibMessage(null);
    } catch (err) {
      console.error('Failed to fetch installed libraries', err);
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || 'Failed to load installed libraries.';
      if (status === 503) {
        setLibMessage({ type: 'error', text: msg });
      }
    }
  };

  useEffect(() => {
    loadLibraries();
  }, []);

  // ── Auto-load component from Component Editor ("Test in Simulator") ────────
  useEffect(() => {
    const raw = localStorage.getItem('openhw_pending_component');
    if (!raw) return;
    localStorage.removeItem('openhw_pending_component');
    try {
      const { data, name, label } = JSON.parse(raw);
      fetch(data)
        .then(r => r.blob())
        .then(blob => {
          const file = new File([blob], `${name || 'component'}.zip`, { type: 'application/zip' });
          handleUploadZip({ target: { files: [file] } });
        })
        .catch(err => console.error('[ComponentEditor] Failed to load pending component:', err));
    } catch (e) {
      console.error('[ComponentEditor] Could not parse pending component data:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gamificationMode) return; // gamification simulator starts with clean canvas
    
    let cancelled = false;

    const loadDemoProject = async () => {
      if (!projectName) return;

      try {
        const pngName = 'circuit.png';
        const pngUrl = `${EXAMPLES_BASE_URL}/${projectName}/${pngName}`;
        const pngRes = await fetch(pngUrl);
        if (!pngRes.ok) return;
        const blob = await pngRes.blob();
        if (cancelled) return;
        const file = new File([blob], pngName, { type: blob.type || 'image/png' });
        importPng(file);
      } catch (err) {
        console.error(`Failed to load demo project "${projectName}"`, err);
      }
    };

    loadDemoProject();
    return () => { cancelled = true; };
  }, [projectName]);

  // ── Offline component queue: flush to backend when connectivity restores ──
  useEffect(() => {
    const drainQueue = async () => {
      const queued = await getQueuedComponents();
      if (!queued.length) return;
      for (const item of queued) {
        try {
          await submitCustomComponent(item.payload);
          await dequeueComponent(item.queueId);
          console.log(`[Offline Queue] Submitted queued component: ${item.payload.id}`);
        } catch {
          // Still offline or backend unreachable — leave in queue for next attempt
        }
      }
    };

    // Attempt drain on initial mount in case items were queued in a previous session
    if (navigator.onLine) drainQueue();

    window.addEventListener('online', drainQueue);
    return () => window.removeEventListener('online', drainQueue);
  }, []);

  // ── Project: owner string ─────────────────────────────────────────────────
  const getOwner = () => user?.email || 'guest';

  // ── Project: load project list helper ────────────────────────────────────
  const refreshProjectList = async () => {
    const projects = await listProjects(getOwner());
    setMyProjects(projects);
  };

  // ── Project: load most-recent project on first mount ─────────────────────
  // ── Project: load most-recent project on first mount ─────────────────────
  useEffect(() => {
    // Don't auto-load a project if we're in assessment mode or loading a demo
    if (assessmentMode || projectName || shareId) return;

    const owner = user?.email || 'guest';
    listProjects(owner).then((projects) => {
      if (projects.length === 0) return;
      const latest = projects[0]; // already sorted newest-first
      const normalizedCircuit = normalizeImportedCircuitData(latest.components, latest.connections);
      const normalizedFiles = normalizeProjectFiles(latest.projectFiles);
      const normalizedTabs = normalizeOpenCodeTabs(latest.openCodeTabs, normalizedFiles);
      const preferredActive = String(latest.activeCodeFileId || '').trim();
      const activeId = normalizedFiles.some((f) => f.id === preferredActive)
        ? preferredActive
        : (normalizedTabs[0] || '');
      setBoard(latest.board || 'arduino_uno');
      setCode(latest.code || '');
      setBlocklyXml(latest.blocklyXml || '');
      setBlocklyGeneratedCode(latest.blocklyGeneratedCode || '');
      setUseBlocklyCode(!!latest.useBlocklyCode);
      setComponents(normalizedCircuit.components);
      setWires(normalizedCircuit.wires);
      setProjectFiles(normalizedFiles);
      setOpenCodeTabs(normalizedTabs);
      setActiveCodeFileId(activeId);
      syncNextIds(normalizedCircuit.components, normalizedCircuit.wires);
      setCurrentProjectId(latest.id);
      currentProjectIdRef.current = latest.id;
      setCurrentProjectName(latest.name || 'Untitled');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shareId) return;

    let cancelled = false;

    const loadSharedProject = async () => {
      try {
        const sharedProject = await fetchSharedSimulation(shareId);
        if (!sharedProject || cancelled) return;

        setBoard(sharedProject.board || 'arduino_uno');
        setCode(sharedProject.code || '');
        setComponents(sharedProject.components || []);
        setWires(sharedProject.connections || []);
        setProjectFiles(Array.isArray(sharedProject.projectFiles) ? sharedProject.projectFiles : []);
        setOpenCodeTabs(Array.isArray(sharedProject.openCodeTabs) ? sharedProject.openCodeTabs : []);
        setActiveCodeFileId(sharedProject.activeCodeFileId || '');
        syncNextIds(sharedProject.components || [], sharedProject.connections || []);
        currentProjectIdRef.current = null;
        setCurrentProjectId(null);
        setCurrentProjectName(sharedProject.name || 'Shared Simulation');
        setHistory({ past: [], future: [] });
        lastCompiledRef.current = null;
      } catch (error) {
        console.error('Failed to load shared simulation', error);
        if (!cancelled) {
          alert(error?.response?.data?.message || error.message || 'Failed to load shared simulation.');
        }
      }
    };

    loadSharedProject();
    return () => { cancelled = true; };
  }, [shareId]);

  // ── Project: debounced auto-save whenever circuit changes ─────────────────
  useEffect(() => {
    // Don't trigger auto-save if disabled
    if (!autoSaveEnabled) return;

    // Don't trigger an empty-project save on initial render
    if (components.length === 0 && wires.length === 0 && code.trim() === '') return;

    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const owner = user?.email || 'guest';
      let id = currentProjectIdRef.current;
      if (!id) {
        id = generateProjectId();
        currentProjectIdRef.current = id;
        setCurrentProjectId(id);
      }
      await saveProject({
        id,
        name: currentProjectName || 'Untitled',
        board,
        components,
        connections: wires,
        code,
        blocklyXml,
        blocklyGeneratedCode,
        useBlocklyCode,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
        owner,
      });
    }, 2500);

    return () => clearTimeout(autoSaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, wires, code, blocklyXml, blocklyGeneratedCode, useBlocklyCode, board, projectFiles, openCodeTabs, activeCodeFileId, autoSaveEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('ohw_autosave_enabled', String(autoSaveEnabled));
    } catch {
      // no-op
    }
  }, [autoSaveEnabled]);

  useEffect(() => { canvasZoomRef.current = canvasZoom; }, [canvasZoom]);
  useEffect(() => { canvasOffsetRef.current = canvasOffset; }, [canvasOffset]);
  useEffect(() => { isCanvasLockedRef.current = isCanvasLocked; }, [isCanvasLocked]);
  useEffect(() => { segDragRef.current = segDrag; }, [segDrag]);

  // Quick-add menu: auto-focus input when menu opens
  useEffect(() => {
    if (quickAdd && quickAddInputRef.current) {
      quickAddInputRef.current.focus();
    }
  }, [quickAdd]);

  // Quick-add menu: close when clicking outside
  useEffect(() => {
    if (!quickAdd) return;
    const handler = (e) => {
      if (!e.target.closest('[data-quickadd]')) setQuickAdd(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [quickAdd]);

  // Persist favourite projects
  useEffect(() => {
    localStorage.setItem('ohw_favourite_projects', JSON.stringify(favouriteProjectIds));
  }, [favouriteProjectIds]);

  // Fullscreen sync
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      pageRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // ── Admin Preview: inject a pending component passed via sessionStorage ──────
  // When admin clicks "Test in Simulator", AdminPage stores the component in
  // sessionStorage and opens /simulator in a new tab. This effect picks it up,
  // transpiles + injects it into the local registry (browser memory only),
  // and shows a banner so the admin knows it's in preview mode.
  useEffect(() => {
    const previewKey = sessionStorage.getItem('pendingPreviewKey');
    if (!previewKey) return;

    const raw = sessionStorage.getItem(previewKey);
    // Clean up immediately so a manual refresh doesn't re-inject
    sessionStorage.removeItem(previewKey);
    sessionStorage.removeItem('pendingPreviewKey');
    if (!raw) return;

    try {
      const comp = JSON.parse(raw);
      const { manifest, uiRaw, logicRaw } = comp;
      if (!manifest || !uiRaw || !logicRaw) return;

      const compType = manifest.type || comp.id;

      // Use async IIFE so await getBabel() is valid inside useEffect
      (async () => {
      const Babel = await getBabel();
      const transpileUI = Babel.transform(uiRaw, { filename: 'ui.tsx', presets: ['react', 'typescript', 'env'] }).code;
      const transpileLogic = Babel.transform(logicRaw, { filename: 'logic.ts', presets: ['typescript', 'env'] }).code;

      const exportsUI = {};
      const evalUI = new Function('exports', 'require', 'React', transpileUI);
      evalUI(exportsUI, (mod) => (mod === 'react' ? React : null), React);

      const uiComponent = resolveUiExport(exportsUI);
      if (!uiComponent) {
        console.warn('[SimulatorPage] Preview: UI component could not be evaluated.');
        return;
      }

      // Inject into catalog & registry
      const newCatItem = { ...manifest };
      delete newCatItem.pins;
      delete newCatItem.group;

      const groupName = normalizeGroupName(manifest.group);
      let group = LOCAL_CATALOG.find(g => g.group === groupName);
      if (!group) {
        group = { group: groupName, items: [] };
        LOCAL_CATALOG.push(group);
      }
      group.items = group.items.filter(i => i.type !== compType);
      group.items.push(newCatItem);
      sortCatalog(LOCAL_CATALOG);

      COMPONENT_REGISTRY[compType] = {
        manifest,
        UI: uiComponent,
        BOUNDS: exportsUI.BOUNDS,
        ContextMenu: exportsUI[Object.keys(exportsUI).find(k => k.toLowerCase().includes('contextmenu'))],
        contextMenuDuringRun: !!(exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun),
        contextMenuOnlyDuringRun: !!(exportsUI.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun),
        logicCode: transpileLogic,
        uiRaw,
        logicRaw,
      };
      if (manifest.pins) LOCAL_PIN_DEFS[compType] = manifest.pins;

      setCustomCatalogCounter(c => c + 1);
      setPreviewBanner({ id: comp.id, label: manifest.label || comp.id });
      console.log(`[SimulatorPage] Admin preview: injected "${manifest.label}" (${compType}) into local registry.`);
      })().catch(e => console.error('[SimulatorPage] Failed to inject admin preview component:', e.message));
    } catch (e) {
      console.error('[SimulatorPage] Failed to inject admin preview component:', e.message);
    }
  }, []);

  // ── Auto-sync Approved Backend Components (polls every 12 s, no refresh needed) ──
  // Handles both ADDITIONS (approve) and REMOVALS (delete) without any page refresh.
  useEffect(() => {
    const syncComponents = async () => {
      try {
        const installedComponents = await fetchInstalledComponentsWithFiles();

        // Build a Set of currently-installed types from the backend
        const currentInstalledTypes = new Set();
        let injectedCount = 0;
        let removedCount = 0;

        // ── ADDITIONS: inject any newly-approved components ──────────────────
        for (const comp of installedComponents) {
          const { id, files } = comp;
          if (!files) continue;

          const manifestStr = files['manifest.json'];
          const uiStr = files['ui.tsx'] || files['ui.jsx'];
          const logicStr = files['logic.ts'] || files['logic.js'];
          if (!manifestStr || !uiStr || !logicStr) continue;

          try {
            const manifest = JSON.parse(manifestStr);
            const compType = manifest.type || id;
            currentInstalledTypes.add(compType);

            // Already in registry — nothing to do this cycle
            if (COMPONENT_REGISTRY[compType]) continue;

            const Babel = await getBabel();
            const transpileUI = Babel.transform(uiStr, { filename: 'ui.tsx', presets: ['react', 'typescript', 'env'] }).code;
            const transpileLogic = Babel.transform(logicStr, { filename: 'logic.ts', presets: ['typescript', 'env'] }).code;

            const exportsUI = {};
            const evalUI = new Function('exports', 'require', 'React', transpileUI);
            evalUI(exportsUI, (mod) => {
              if (mod === 'react') return React;
              return null;
            }, React);

            const uiComponent = resolveUiExport(exportsUI);
            if (!uiComponent) continue;

            // Inject into catalog
            const newCatItem = { ...manifest };
            delete newCatItem.pins;
            delete newCatItem.group;

            const groupName = normalizeGroupName(manifest.group);
            let group = LOCAL_CATALOG.find(g => g.group === groupName);
            if (!group) {
              group = { group: groupName, items: [] };
              LOCAL_CATALOG.push(group);
            }
            group.items = group.items.filter(i => i.type !== compType);
            group.items.push(newCatItem);
            sortCatalog(LOCAL_CATALOG);

            COMPONENT_REGISTRY[compType] = {
              manifest,
              UI: uiComponent,
              BOUNDS: exportsUI.BOUNDS,
              ContextMenu: exportsUI[Object.keys(exportsUI).find(k => k.toLowerCase().includes('contextmenu'))],
              contextMenuDuringRun: !!(exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun),
              contextMenuOnlyDuringRun: !!(exportsUI.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun),
              logicCode: transpileLogic,
              uiRaw: uiStr,
              logicRaw: logicStr,
              validationRaw: files['validation.ts'] || files['validation.js'] || '',
              indexRaw: files['index.ts'] || files['index.js'] || '',
              ...(files['docs/index.html'] ? { doc: files['docs/index.html'] } : {})
            };
            if (manifest.pins) LOCAL_PIN_DEFS[compType] = manifest.pins;

            BACKEND_INJECTED_TYPES.add(compType); // track so we can detect future deletions
            injectedCount++;
          } catch (e) {
            console.warn(`[SimulatorPage] Failed to inject component "${id}":`, e.message);
          }
        }

        // ── REMOVALS: purge any backend-injected type no longer installed ────
        for (const type of BACKEND_INJECTED_TYPES) {
          if (!currentInstalledTypes.has(type)) {
            // Remove from registry
            delete COMPONENT_REGISTRY[type];
            delete LOCAL_PIN_DEFS[type];

            // Remove from catalog groups
            for (const group of LOCAL_CATALOG) {
              group.items = group.items.filter(i => i.type !== type);
            }
            // Clean up empty groups
            const idx = LOCAL_CATALOG.findIndex(g => g.items.length === 0);
            if (idx !== -1) LOCAL_CATALOG.splice(idx, 1);

            BACKEND_INJECTED_TYPES.delete(type);
            removedCount++;
            console.log(`[SimulatorPage] Removed deleted component "${type}" from panel.`);
          }
        }

        if (injectedCount > 0 || removedCount > 0) {
          setCustomCatalogCounter(c => c + 1); // triggers palette re-render
        }
      } catch (e) {
        // Silently ignore — backend may be starting up or unreachable
        console.warn('[SimulatorPage] Component sync skipped:', e.message);
      }
    };

    // Run once immediately on mount, then poll every 60 seconds.
    // Skip polling when the browser tab is hidden to avoid wasted work.
    syncComponents();
    const syncInterval = setInterval(() => {
      if (!document.hidden) syncComponents();
    }, 60000);
    return () => clearInterval(syncInterval); // cleanup on unmount
  }, []);

  const handleSearchLibraries = async (e) => {
    if (e) e.preventDefault();
    if (!libQuery.trim()) return;

    // Check cache first
    if (libSearchCache.current[libQuery.trim()]) {
      setLibResults(libSearchCache.current[libQuery.trim()]);
      setLibMessage(null);
      return;
    }

    setIsSearchingLib(true);
    setLibMessage(null);
    try {
      const libraries = await searchLibraries(libQuery);
      libSearchCache.current[libQuery.trim()] = libraries;
      setLibResults(libraries);
      if (libraries.length === 0) setLibMessage({ type: 'error', text: 'No libraries found.' });
    } catch (err) {
      setLibMessage({ type: 'error', text: 'Failed to search libraries.' });
    } finally {
      setIsSearchingLib(false);
    }
  };

  const handleInstallLibrary = async (libName) => {
    setInstallingLib(libName);
    setLibMessage(null);
    try {
      const res = await installLibrary(libName);
      setLibMessage({ type: 'success', text: res.message });
      loadLibraries();
      lastCompiledRef.current = null;
    } catch (err) {
      setLibMessage({ type: 'error', text: 'Failed to install library.' });
    } finally {
      setInstallingLib(null);
    }
  };

  // ── Handle Panel Resize ──────────────────────────────────────────────────────
  const onMouseDownResize = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (moveEvent) => {
      const delta = startX - moveEvent.clientX; // Left drag increases width
      const newWidth = Math.max(250, Math.min(800, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  const onMouseDownConsoleResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = consoleHeight;

    const onMouseMove = (moveEvent) => {
      const delta = startY - moveEvent.clientY;
      const newHeight = Math.max(140, Math.min(540, startHeight + delta));
      setConsoleHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [consoleHeight, setConsoleHeight]);

  const onMouseDownExplorerResize = useCallback((e) => {
    e.preventDefault();
    setIsExplorerDragging(true);
  }, []);

  useEffect(() => {
    if (!isExplorerDragging) return;
    const onMouseMove = (e) => {
      const rightPanelStart = window.innerWidth - panelWidth;
      const newWidth = e.clientX - rightPanelStart;
      setExplorerWidth(Math.max(120, Math.min(panelWidth - 100, newWidth)));
    };
    const onMouseUp = () => setIsExplorerDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isExplorerDragging, panelWidth]);

  // ── Close palette context menu on outside click ──────────────────────────
  useEffect(() => {
    if (!paletteContextMenu) return;
    const close = () => { setPaletteContextMenu(null); setIsPaletteHovered(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [paletteContextMenu]);

  // ── Close View panel on outside click ──────────────────────────────────────
  useEffect(() => {
    if (!showViewPanel) return;
    const close = (e) => { if (viewPanelRef.current && !viewPanelRef.current.contains(e.target)) setShowViewPanel(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showViewPanel]);

  // ── Close Filter dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    if (!showFilterDropdown) return;
    const close = (e) => { if (!e.target.closest('.filter-dropdown-container')) setShowFilterDropdown(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showFilterDropdown]);

  // ── Load Wokwi bundle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!customElements.get('wokwi-7segment') && !document.getElementById('wokwi-bundle')) {
      const s = document.createElement('script')
      s.id = 'wokwi-bundle'
      s.src = 'https://unpkg.com/@wokwi/elements@0.48.3/dist/wokwi-elements.bundle.js'
      document.head.appendChild(s)
    }
  }, [])

  // ── Validation toast auto-dismiss ───────────────────────────────────────────
  useEffect(() => {
    if (!validationToast) return undefined;
    const timer = setTimeout(() => setValidationToast(null), 10000);
    return () => clearTimeout(timer);
  }, [validationToast]);

  // ── Load Catalog on Mount ────────────────────────────────────────────────────
  const CATALOG = LOCAL_CATALOG;
  const PIN_DEFS = LOCAL_PIN_DEFS;

  // ── Static component descriptions ────────────────────────────────────────────
  const COMPONENT_DESCRIPTIONS = {
    'wokwi-led': 'Light-emitting diode. Emits light when current flows through it. Supports multiple colors.',
    'wokwi-arduino-uno': 'ATmega328P-based microcontroller board. 14 digital I/O pins, 6 analog inputs, USB connectivity.',
    'wokwi-resistor': 'Passive two-terminal component. Limits current flow. Configurable resistance value.',
    'wokwi-pushbutton': 'Momentary tactile push button. Connects circuit while pressed, opens when released.',
    'wokwi-power-supply': 'Provides stable DC power to the circuit. Configurable voltage output.',
    'wokwi-neopixel-matrix': 'Addressable RGB LED matrix. Individually controllable pixels via single data line.',
    'wokwi-buzzer': 'Piezoelectric buzzer. Generates audio tones when driven by PWM or digital signals.',
    'wokwi-motor': 'DC motor. Converts electrical energy to rotational motion. Controlled via H-bridge.',
    'wokwi-servo': 'Hobby servo motor. Precise angular position control via PWM signal (0–180°).',
    'wokwi-motor-driver': 'Dual H-bridge motor driver (L293D). Controls speed and direction of two DC motors.',
    'wokwi-slide-potentiometer': 'Linear slide potentiometer. Provides variable analog voltage via sliding knob.',
    'wokwi-potentiometer': 'Rotary potentiometer. Variable resistor providing analog voltage proportional to rotation.',
    'wokwi-analog-joystick': '2-axis analog joystick. Provides X and Y axis voltage limits along with a push button.',
    'shift_register': '74HC595 8-bit serial-in, parallel-out shift register. Expands digital outputs.',
    'wokwi-membrane-keypad': '4x4 Membrane Keypad. Provides a matrix of 16 buttons for code input or navigation.',
  };

  // ── Apply NeoPixel pixel data to DOM elements ──────────────────────────────
  useEffect(() => {
    if (!neopixelData || Object.keys(neopixelData).length === 0) return;
    for (const [compId, pixels] of Object.entries(neopixelData)) {
      const wrapper = neopixelRefs.current[compId];
      if (!wrapper) continue;
      const el = wrapper.querySelector('wokwi-neopixel-matrix');
      if (!el || typeof el.setPixel !== 'function') continue;
      for (const [row, col, rgb] of pixels) {
        el.setPixel(row, col, rgb);
      }
    }
  }, [neopixelData])

  // ── Error component IDs for highlighting ────────────────────────────────────
  const errorCompIds = useMemo(() =>
    new Set(validationErrors.flatMap(e => e.compIds)),
    [validationErrors]
  )

  // ── Info of currently selected canvas component (for description panel) ──────
  const selectedComponentInfo = useMemo(() => {
    if (!selected) return null;
    const comp = components.find(c => c.id === selected);
    if (!comp) return null;
    for (const group of CATALOG) {
      const item = group.items.find(i => i.type === comp.type);
      if (item) return { ...item, group: group.group };
    }
    return { type: comp.type, label: comp.label || comp.type, group: 'Custom' };
  }, [selected, components]);

  // ── Serial auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!serialPaused && serialOutputRef.current) {
      serialOutputRef.current.scrollTop = serialOutputRef.current.scrollHeight;
    }
  }, [serialHistory, serialPaused]);

  useEffect(() => {
    serialPausedRef.current = serialPaused;
  }, [serialPaused]);

  useEffect(() => {
    try {
      localStorage.setItem('openhw.serial.lineEnding', serialLineEnding);
    } catch {
      // no-op: storage may be unavailable in restricted contexts
    }
  }, [serialLineEnding]);

  useEffect(() => {
    try {
      localStorage.setItem('openhw.rp2040.debugTelemetry', rp2040DebugTelemetryEnabled ? '1' : '0');
    } catch {
      // no-op: storage may be unavailable in restricted contexts
    }
  }, [rp2040DebugTelemetryEnabled]);

  useEffect(() => {
    if (serialBoardFilter === 'all') return;
    if (!serialBoardOptions.includes(serialBoardFilter)) {
      setSerialBoardFilter(serialBoardOptions.length > 1 ? serialBoardOptions[1] : 'all');
    }
  }, [serialBoardFilter, serialBoardOptions]);

  useEffect(() => {
    setProjectFiles(prev => {
      const normalized = normalizeProjectFiles(prev);
      let changed = normalized.length !== prev.length;
      let result = [...normalized];

      // Remove board files for boards no longer present
      const validBoardIds = new Set(boardComponents.map(b => b.id));
      const pruned = result.filter(f => {
        const m = f.path.match(/^project\/([^/]+)\//);
        if (!m) return true;
        return validBoardIds.has(m[1]);
      });

      if (pruned.length !== result.length) changed = true;
      result = [...pruned];

      const replaceFilePath = (fromPath, toPath) => {
        if (!fromPath || !toPath || fromPath === toPath) return;
        const sourceIdx = result.findIndex((file) => file.id === fromPath);
        if (sourceIdx === -1) return;

        const duplicateIdx = result.findIndex((file, idx) => idx !== sourceIdx && file.id === toPath);
        if (duplicateIdx !== -1) {
          result.splice(sourceIdx, 1);
          changed = true;
          return;
        }

        const source = result[sourceIdx];
        result[sourceIdx] = {
          ...source,
          id: toPath,
          path: toPath,
          name: toPath.split('/').pop() || source.name,
        };
        changed = true;
      };

      const upsert = (fileObj) => {
        const idx = result.findIndex(f => f.id === fileObj.id);
        if (idx === -1) {
          result.push(fileObj);
          changed = true;
        } else {
          const existing = result[idx];
          if (existing.path !== fileObj.path || existing.name !== fileObj.name || existing.boardId !== fileObj.boardId || existing.boardKind !== fileObj.boardKind) {
            result[idx] = { ...existing, ...fileObj, content: existing.content, dirty: existing.dirty };
            changed = true;
          }
        }
      };

      boardComponents.forEach((bc) => {
        const kind = normalizeBoardKind(bc.type);
        const basePath = `project/${bc.id}`;
        const rp2040Mode = kind === 'rp2040'
          ? normalizeRp2040Env(resolveComponentAttrString(bc?.attrs, 'env', 'native'))
          : 'native';

        for (let i = 0; i < result.length; i += 1) {
          const file = result[i];
          if (!file.path.startsWith(`${basePath}/`)) continue;
          if (file.boardId !== bc.id || file.boardKind !== kind) {
            result[i] = { ...file, boardId: bc.id, boardKind: kind };
            changed = true;
          }
        }

        const expectedMainName = getDefaultMainFileName(kind, bc.id, { rp2040Mode });
        const expectedMainPath = `${basePath}/${expectedMainName}`;
        const expectedMainDisabledPath = `${expectedMainPath}${DISABLED_FILE_SUFFIX}`;
        if (!result.some((file) => file.id === expectedMainPath) && result.some((file) => file.id === expectedMainDisabledPath)) {
          replaceFilePath(expectedMainDisabledPath, expectedMainPath);
        }

        const hasEnabledMainForMode = result.some((file) => {
          if (!file.path.startsWith(`${basePath}/`)) return false;
          if (isFileDisabled(file.path)) return false;
          const ext = baseFileExt(file.path);
          if (kind !== 'rp2040') return ext === '.ino';
          return isRp2040PythonEnv(rp2040Mode) ? ext === '.py' : ext === '.ino';
        });

        if (!hasEnabledMainForMode) {
          const defaultContent = createDefaultMainCode(kind, bc.id, { rp2040Mode });
          upsert({
            id: expectedMainPath,
            path: expectedMainPath,
            name: expectedMainName,
            kind: 'code',
            boardId: bc.id,
            boardKind: kind,
            content: defaultContent,
            dirty: false,
          });
        }

        if (kind === 'rp2040') {
          const boardFilePaths = result
            .filter((file) => file.path.startsWith(`${basePath}/`))
            .map((file) => file.path);

          boardFilePaths.forEach((pathLike) => {
            const ext = baseFileExt(pathLike);
            const disabled = isFileDisabled(pathLike);
            const shouldDisable = isRp2040PythonEnv(rp2040Mode)
              ? ARDUINO_CODE_EXTENSIONS.has(ext)
              : ext === '.py';

            if (shouldDisable && !disabled) {
              replaceFilePath(pathLike, `${pathLike}${DISABLED_FILE_SUFFIX}`);
            }
          });
        }
      });

      const libraries = (libInstalled || []).map(l => l?.library?.name || l?.name).filter(Boolean);
      const diagramPayload = buildProjectPayload({
        board,
        components,
        wires,
        code,
        includeCode: false,
        blocklyXml,
        blocklyGeneratedCode,
        useBlocklyCode,
        projectFiles: result,
        openCodeTabs,
        activeCodeFileId,
      });
      const diagramJson = JSON.stringify(diagramPayload, null, 2);

      const generatedRootFiles = [
        { id: 'project/diagram.json', path: 'project/diagram.json', name: 'diagram.json', kind: 'root', content: diagramJson, dirty: false },
        { id: 'project/library.txt', path: 'project/library.txt', name: 'library.txt', kind: 'root', content: libraries.join('\n'), dirty: false },
      ];

      generatedRootFiles.forEach((rootFile) => {
        const idx = result.findIndex((file) => file.id === rootFile.id);
        if (idx === -1) {
          result.push(rootFile);
          changed = true;
          return;
        }

        const current = result[idx];
        if (
          current.path !== rootFile.path
          || current.name !== rootFile.name
          || current.kind !== rootFile.kind
          || current.content !== rootFile.content
          || current.dirty !== false
        ) {
          result[idx] = {
            ...current,
            path: rootFile.path,
            name: rootFile.name,
            kind: rootFile.kind,
            content: rootFile.content,
            dirty: false,
          };
          changed = true;
        }
      });

      return changed ? normalizeProjectFiles(result) : prev;
    });
  }, [
    boardComponents,
    board,
    components,
    wires,
    libInstalled,
    code,
    blocklyXml,
    blocklyGeneratedCode,
    useBlocklyCode,
    openCodeTabs,
    activeCodeFileId,
  ]);

  useEffect(() => {
    if (projectFiles.length === 0) return;
    // If activeCodeFileId is null, it means it was explicitly deselected
    if (activeCodeFileId === null) return;
    if (activeCodeFileId && projectFileMap.has(activeCodeFileId)) return;

    const firstCodeFile = projectFiles.find(f => f.kind === 'code') || projectFiles[0];
    if (!firstCodeFile) return;

    setActiveCodeFileId(firstCodeFile.id);
    setOpenCodeTabs(prev => prev.includes(firstCodeFile.id) ? prev : [...prev, firstCodeFile.id]);
  }, [projectFiles, activeCodeFileId, projectFileMap]);

  useEffect(() => {
    if (!activeCodeFile) {
      suppressCodeSyncRef.current = true;
      setCode('');
      return;
    }
    suppressCodeSyncRef.current = true;
    setCode(activeCodeFile.content || '');
  }, [activeCodeFile?.id]);

  useEffect(() => {
    if (!activeCodeFileId) return;
    if (suppressCodeSyncRef.current) {
      suppressCodeSyncRef.current = false;
      return;
    }

    setProjectFiles(prev => prev.map(f => {
      if (f.id !== activeCodeFileId) return f;
      if (f.content === code) return f;
      return { ...f, content: code, dirty: true };
    }));
  }, [code, activeCodeFileId]);

  useEffect(() => {
    const nextDefault = BOARD_DEFAULT_BAUD[selectedSerialBoardKind] || BOARD_DEFAULT_BAUD.arduino_uno;
    setSerialBaudRate(nextDefault);
  }, [selectedSerialBoardKind]);

  useEffect(() => {
    if (!isRunning || !workerRef.current) return;
    const parsedBaud = Number(serialBaudRate);
    if (!Number.isFinite(parsedBaud)) return;

    workerRef.current.postMessage({
      type: 'SERIAL_SET_BAUD',
      baudRate: parsedBaud,
      targetBoardId: serialBoardFilter !== 'all' ? serialBoardFilter : undefined,
    });
  }, [isRunning, serialBaudRate, serialBoardFilter]);

  // ── Plotter Rendering Loop ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = plotterCanvasRef.current;
    if (!canvas || codeTab !== 'serial' || serialViewMode !== 'plotter' || plotData.length === 0 || selectedPlotPins.length === 0) return;
    if (plotterPaused) return; // Freeze canvas when paused

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const Y_LABEL_W = 35;

    const scopedPlotData = serialBoardFilter === 'all'
      ? plotData
      : plotData.filter(pt => pt.boardId === serialBoardFilter);

    if (scopedPlotData.length === 0) return;

    // Separate selected pins into serial vs logic
    const logicPins = selectedPlotPins.filter(p => !isNaN(parseInt(p)) || p.startsWith('A'));
    const serialVars = selectedPlotPins.filter(p => isNaN(parseInt(p)) && !p.startsWith('A'));

    const hasSerial = serialVars.length > 0;
    const logicTrackCount = logicPins.length;
    // Serial track takes up half the height if logic pins exist, otherwise full height
    const serialHeight = hasSerial ? (logicTrackCount > 0 ? height * 0.6 : height) : 0;
    const logicAreaHeight = height - serialHeight;
    const logicTrackHeight = logicTrackCount > 0 ? logicAreaHeight / logicTrackCount : 0;

    // --- Draw Serial Track ---
    if (hasSerial) {
      const trackBaseY = serialHeight - 20;
      const trackTopY = 20;

      // Calculate global min/max for serial vars
      let sMin = Infinity, sMax = -Infinity;
      scopedPlotData.forEach(pt => {
        if (!pt.serialVars) return;
        serialVars.forEach(sv => {
          const v = pt.serialVars[sv];
          if (v !== undefined) {
            if (v < sMin) sMin = v;
            if (v > sMax) sMax = v;
          }
        });
      });
      if (sMin === Infinity) { sMin = 0; sMax = 1; }
      if (sMin === sMax) { sMin -= 1; sMax += 1; }

      // Draw grid/guides
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // zero line
      const zeroY = trackBaseY - ((0 - sMin) / (sMax - sMin) * (trackBaseY - trackTopY));
      if (zeroY >= trackTopY && zeroY <= trackBaseY) {
        ctx.moveTo(Y_LABEL_W, zeroY); ctx.lineTo(width, zeroY);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Axis labels
      ctx.font = '9px JetBrains Mono';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'right';
      ctx.fillText(sMax.toFixed(2), Y_LABEL_W - 2, trackTopY + 4);
      ctx.fillText(sMin.toFixed(2), Y_LABEL_W - 2, trackBaseY);
      ctx.textAlign = 'left';

      // Draw traces
      const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
      serialVars.forEach((sv, i) => {
        const color = colors[i % colors.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const maxPts = width - Y_LABEL_W;
        const pts = scopedPlotData.slice(-maxPts);
        const xStep = maxPts / Math.max(pts.length, 1);

        let hasStarted = false;
        pts.forEach((pt, idx) => {
          const x = Y_LABEL_W + (maxPts - ((pts.length - 1 - idx) * xStep));
          const v = pt.serialVars?.[sv];
          if (v !== undefined) {
            const y = trackBaseY - ((v - sMin) / (sMax - sMin)) * (trackBaseY - trackTopY);
            if (!hasStarted) { ctx.moveTo(x, y); hasStarted = true; }
            else { ctx.lineTo(x, y); }
          }
        });
        ctx.stroke();

        // Custom Label on graph
        ctx.fillStyle = color;
        ctx.font = 'bold 10px JetBrains Mono';
        ctx.fillText(sv, Y_LABEL_W + 4 + (i * 60), trackTopY - 5);
      });

      // Separator
      if (logicTrackCount > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, serialHeight);
        ctx.lineTo(width, serialHeight);
        ctx.stroke();
      }
    }

    // --- Draw Logic Tracks ---
    logicPins.forEach((pinStr, logicIdx) => {
      const trackBaseY = serialHeight + logicTrackHeight * (logicIdx + 1) - 10;
      const trackTopY = serialHeight + logicTrackHeight * logicIdx + 10;
      const isAnalog = pinStr.startsWith('A');
      const color = isAnalog ? '#3498db' : '#2ecc71';

      // Track separator
      if (logicIdx < logicPins.length - 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, serialHeight + logicTrackHeight * (logicIdx + 1));
        ctx.lineTo(width, serialHeight + logicTrackHeight * (logicIdx + 1));
        ctx.stroke();
      }

      // Baseline (LOW / 0V) dashed guide
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Y_LABEL_W, trackBaseY);
      ctx.lineTo(width, trackBaseY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Y-axis labels
      ctx.font = '9px JetBrains Mono';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textAlign = 'right';
      ctx.fillText(isAnalog ? '5V' : 'HIGH', Y_LABEL_W - 2, trackTopY + 9);
      ctx.fillText(isAnalog ? '0V' : 'LOW', Y_LABEL_W - 2, trackBaseY);
      ctx.textAlign = 'left';

      // Pin label
      ctx.fillStyle = color;
      ctx.font = 'bold 10px JetBrains Mono';
      ctx.fillText(`Pin ${pinStr}`, Y_LABEL_W + 4, trackTopY + 10);

      // Signal trace
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const maxPts = width - Y_LABEL_W;
      const pts = scopedPlotData.slice(-maxPts);
      const xStep = maxPts / Math.max(pts.length, 1);

      pts.forEach((pt, i) => {
        const x = Y_LABEL_W + (maxPts - ((pts.length - 1 - i) * xStep));
        let val = 0;
        if (isAnalog) {
          const ch = parseInt(pinStr.substring(1));
          val = Math.max(0, Math.min(1, (pt.analog[ch] || 0) / 5.0));
        } else {
          val = pt.pins[pinStr] ? 1 : 0;
        }
        const y = trackBaseY - (val * (trackBaseY - trackTopY));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // X-axis label
    ctx.font = '9px JetBrains Mono';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'left';
    ctx.fillText('← time', Y_LABEL_W + 4, height - 4);
  }, [plotData, codeTab, selectedPlotPins, plotterPaused, serialViewMode, serialBoardFilter]);

  // ── Get absolute pin position on canvas ────────────────────────────────────
  const componentsMap = useMemo(() => {
    const m = new Map();
    for (const c of components) m.set(c.id, c);
    return m;
  }, [components]);

  const getPinPos = useCallback((compId, pinId) => {
    const comp = componentsMap.get(compId)
    if (!comp) return null
    const pins = PIN_DEFS[comp.type] || []
    const pin = pins.find(p => p.id === pinId)
    if (!pin) return null
    const rotation = comp.rotation || 0;
    if (rotation === 0) return { x: comp.x + pin.x, y: comp.y + pin.y }
    // Rotate pin coordinate around component center
    const cx = comp.w / 2, cy = comp.h / 2;
    const rad = rotation * Math.PI / 180;
    const dx = pin.x - cx, dy = pin.y - cy;
    return {
      x: comp.x + cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: comp.y + cy + dx * Math.sin(rad) + dy * Math.cos(rad)
    }
  }, [componentsMap, PIN_DEFS])

  // ── Get the point a wire should exit/enter at 90° from a pin ───────────────
  const getPinExitPoint = useCallback((compId, pinId) => {
    const comp = componentsMap.get(compId)
    if (!comp) return null
    const pins = PIN_DEFS[comp.type] || []
    const pin = pins.find(p => p.id === pinId)
    if (!pin) return null
    const stub = 20;
    // Determine dominant exit direction from unrotated pin position relative to component center
    const cx = comp.w / 2, cy = comp.h / 2;
    const dx = pin.x - cx, dy = pin.y - cy;
    let exitDx = 0, exitDy = 0;
    if (Math.abs(dx) >= Math.abs(dy)) {
      exitDx = dx >= 0 ? stub : -stub;
    } else {
      exitDy = dy >= 0 ? stub : -stub;
    }
    // Rotate exit direction with the component
    const rotation = comp.rotation || 0;
    if (rotation !== 0) {
      const rad = rotation * Math.PI / 180;
      const rdx = exitDx * Math.cos(rad) - exitDy * Math.sin(rad);
      const rdy = exitDx * Math.sin(rad) + exitDy * Math.cos(rad);
      exitDx = rdx; exitDy = rdy;
    }
    const pinPos = getPinPos(compId, pinId);
    if (!pinPos) return null;
    return { x: pinPos.x + exitDx, y: pinPos.y + exitDy };
  }, [componentsMap, PIN_DEFS, getPinPos])

  // Keep reactive refs current so async effects always use latest values
  getPinPosRef.current = getPinPos;
  componentsRef.current = components;
  pinDefsRef.current = PIN_DEFS;

  // ── Palette drag start ──────────────────────────────────────────────────────
  const onPaletteDragStart = (e, item) => {
    dragPayload.current = item
    e.dataTransfer.effectAllowed = 'copy'
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-999px;width:1px;height:1px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  // ── Favorites helpers ────────────────────────────────────────────────────────
  const toggleFavorite = useCallback((type) => {
    setFavoriteComponents(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      try { localStorage.setItem('openhw_fav_components', JSON.stringify([...next])); } catch { }
      return next;
    });
  }, []);

  // ── History & Undo/Redo ────────────────────────────────────────────────────
  const saveHistory = useCallback(() => {
    setHistory(h => ({
      past: [...h.past.slice(-20), { components: structuredClone(components), wires: structuredClone(wires) }],
      future: []
    }))
  }, [components, wires])

  const undo = () => {
    if (history.past.length === 0 || isRunning) return
    const prev = history.past[history.past.length - 1]
    setHistory(h => ({ past: h.past.slice(0, -1), future: [{ components: structuredClone(components), wires: structuredClone(wires) }, ...h.future] }))
    setComponents(prev.components)
    setWires(prev.wires)
    setSelected(null)
  }

  const redo = () => {
    if (history.future.length === 0 || isRunning) return
    const next = history.future[0]
    setHistory(h => ({ past: [...h.past, { components: structuredClone(components), wires: structuredClone(wires) }], future: h.future.slice(1) }))
    setComponents(next.components)
    setWires(next.wires)
    setSelected(null)
  }

  // ── Canvas drop ────────────────────────────────────────────────────────────
  const onCanvasDrop = useCallback((e) => {
    e.preventDefault()
    const item = dragPayload.current
    if (!item) return
    saveHistory();
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current - (item.w || 60) / 2
    const y = (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current - (item.h || 60) / 2
    setComponents(prev => {
      const usedIds = new Set(prev.map((comp) => String(comp.id || '')));
      const id = allocateComponentId(item.type, usedIds);
      return [...prev, {
        id,
        type: item.type, label: item.label,
        x: Math.max(8, x), y: Math.max(8, y),
        w: item.w || 60, h: item.h || 60,
        attrs: item.attrs || {},
      }];
    })
    dragPayload.current = null
  }, [saveHistory])

  // ── Quick-add: place component at explicit canvas coordinates ──────────────
  const addComponentAt = useCallback((item, canvasX, canvasY) => {
    saveHistory()
    const x = canvasX - (item.w || 60) / 2
    const y = canvasY - (item.h || 60) / 2
    setComponents(prev => {
      const usedIds = new Set(prev.map((comp) => String(comp.id || '')));
      const id = allocateComponentId(item.type, usedIds);
      return [...prev, {
        id,
        type: item.type, label: item.label,
        x: Math.max(8, x), y: Math.max(8, y),
        w: item.w || 60, h: item.h || 60,
        attrs: item.attrs || {},
      }];
    })
  }, [saveHistory])

  // ── Palette click to add (adds to canvas center) ────────────────────────────
  const addComponentAtCenter = useCallback((item) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (rect.width / 2 - canvasOffsetRef.current.x) / canvasZoomRef.current;
    const cy = (rect.height / 2 - canvasOffsetRef.current.y) / canvasZoomRef.current;
    addComponentAt(item, cx, cy);
    setSelectedPaletteItem(item);
  }, [addComponentAt]);

  // ── Enhanced Zooming (Pinch Only) ──────────────────────────────────────────
  const initialTouchDistanceRef = useRef(null);
  const initialCanvasZoomRef = useRef(null);
  const initialTouchCenterCanvasRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    if (isCanvasLockedRef.current || e.touches.length !== 2) {
      initialTouchDistanceRef.current = null;
      return;
    }
    const t1 = e.touches[0], t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    initialTouchDistanceRef.current = dist;
    initialCanvasZoomRef.current = canvasZoomRef.current;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (t1.clientX + t2.clientX) / 2 - rect.left;
    const my = (t1.clientY + t2.clientY) / 2 - rect.top;
    
    // Position on canvas relative to 0,0
    initialTouchCenterCanvasRef.current = {
      x: (mx - canvasOffsetRef.current.x) / canvasZoomRef.current,
      y: (my - canvasOffsetRef.current.y) / canvasZoomRef.current
    };
  }, []);

  const onTouchMove = useCallback((e) => {
    if (isCanvasLockedRef.current || e.touches.length !== 2 || !initialTouchDistanceRef.current) return;
    if (e.cancelable) e.preventDefault();
    
    const t1 = e.touches[0], t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    
    const scale = dist / initialTouchDistanceRef.current;
    const newZoom = Math.min(3, Math.max(0.25, initialCanvasZoomRef.current * scale));

    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (t1.clientX + t2.clientX) / 2 - rect.left;
    const my = (t1.clientY + t2.clientY) / 2 - rect.top;

    // We want initialTouchCenterCanvasRef.current to be at (mx, my) in screen space
    const newOffsetX = mx - initialTouchCenterCanvasRef.current.x * newZoom;
    const newOffsetY = my - initialTouchCenterCanvasRef.current.y * newZoom;

    setCanvasZoom(newZoom);
    canvasZoomRef.current = newZoom;
    setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    canvasOffsetRef.current = { x: newOffsetX, y: newOffsetY };
  }, []);

  const onTouchEnd = useCallback(() => {
    initialTouchDistanceRef.current = null;
  }, []);

  // Trackpad pinch (Ctrl + Wheel)
  const onWheel = useCallback((e) => {
    if (isCanvasLockedRef.current || !e.ctrlKey) return;
    e.preventDefault();
    const zoomSpeed = 0.001; 
    const delta = -e.deltaY * zoomSpeed;
    const newZoom = Math.min(3, Math.max(0.25, canvasZoomRef.current + delta));
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const cx = (mx - canvasOffsetRef.current.x) / canvasZoomRef.current;
    const cy = (my - canvasOffsetRef.current.y) / canvasZoomRef.current;
    
    const newOffsetX = mx - cx * newZoom;
    const newOffsetY = my - cy * newZoom;
    
    setCanvasZoom(newZoom);
    canvasZoomRef.current = newZoom;
    setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    canvasOffsetRef.current = { x: newOffsetX, y: newOffsetY };
  }, []);

  // ── Move and Select component ──────────────────────────────────────────────
  const onCompMouseDown = useCallback((e, id) => {
    e.stopPropagation()
    if (isRunning) return; // Restrict movement while running
    const comp = components.find(c => c.id === id)
    movingComp.current = { id, sx: e.clientX, sy: e.clientY, cx: comp.x, cy: comp.y, moved: false, originalComps: JSON.parse(JSON.stringify(components)) }
  }, [components, isRunning])

  const onCompClick = useCallback((e, id) => {
    e.stopPropagation()
    setSelected(id)
    setWireClickPos(null)
  }, [])

  useEffect(() => {
    // ───── RAF-throttled mousemove (Fixes #1 #2 #3 #4) ──────────────────────────
    // Instead of calling React state setters on every raw mousemove (which can
    // fire at 200Hz), we synchronously extract all needed data from the event,
    // store it in a ref, then schedule one rAF callback to do all state updates.
    // This caps React renders at 60fps regardless of mouse polling rate.
    const onMove = (e) => {
      // ── Synchronously read event data (must happen in the event handler) ───
      let compUpdate = null;
      let wireUpdate = null;
      let panUpdate = null;
      let mousePosUpdate = null;

      if (movingComp.current) {
        // Fix #1 ─ component drag
        movingComp.current.moved = true;
        const { id, sx, sy, cx, cy } = movingComp.current;
        const zoom = canvasZoomRef.current;
        compUpdate = { id, newX: cx + (e.clientX - sx) / zoom, newY: cy + (e.clientY - sy) / zoom };
      }

      const sd = segDragRef.current;
      if (sd && canvasRef.current) {
        // Fix #2 ─ wire segment drag
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
        const my = (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
        const ddx = mx - sd.startMouseCanvas.x;
        const ddy = my - sd.startMouseCanvas.y;
        if (Math.abs(ddx) >= 1 || Math.abs(ddy) >= 1) {
          sd.hasMoved = true;
          const newPts = sd.startPts.map(pt => ({ ...pt }));
          const { segIdx, isHoriz } = sd;
          if (isHoriz) {
            newPts[segIdx] = { ...newPts[segIdx], y: newPts[segIdx].y + ddy };
            newPts[segIdx + 1] = { ...newPts[segIdx + 1], y: newPts[segIdx + 1].y + ddy };
          } else {
            newPts[segIdx] = { ...newPts[segIdx], x: newPts[segIdx].x + ddx };
            newPts[segIdx + 1] = { ...newPts[segIdx + 1], x: newPts[segIdx + 1].x + ddx };
          }
          wireUpdate = { wireId: sd.wireId, cornerWaypoints: newPts.slice(1, -1).map(pt => ({ x: pt.x, y: pt.y, _corner: true })) };
        }
        // don't pan or track mouse while segment-dragging
      } else {
        // Fix #4 ─ canvas panning via direct DOM transform (zero React renders mid-pan)
        if (isPanningRef.current && !isCanvasLockedRef.current) {
          const dx = e.clientX - panStartRef.current.x;
          const dy = e.clientY - panStartRef.current.y;
          if (!didPanRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
            didPanRef.current = true;
          }
          if (didPanRef.current) {
            const newOffset = { x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy };
            canvasOffsetRef.current = newOffset;
            // Apply transform directly to DOM — NO React state update mid-pan
            if (innerCanvasRef.current) {
              innerCanvasRef.current.style.transform =
                `translate(${newOffset.x}px, ${newOffset.y}px) scale(${canvasZoomRef.current})`;
            }
            panUpdate = newOffset; // stored so onUp can commit to React state
          }
        }

        // Fix #3 ─ wire preview mouse tracking
        if (wireStart && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const rawX = (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
          const rawY = (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
          const snapRadius = 15;
          let snapped = null;
          const allComps = componentsRef.current;
          const pinDefs = pinDefsRef.current;
          const getPos = getPinPosRef.current;
          if (getPos) {
            for (let ci = 0; ci < allComps.length && !snapped; ci++) {
              const c = allComps[ci];
              if (c.id === wireStart.compId) continue;
              const pins = pinDefs[c.type] || [];
              for (let pi = 0; pi < pins.length && !snapped; pi++) {
                const pp = getPos(c.id, pins[pi].id);
                if (pp && Math.hypot(pp.x - rawX, pp.y - rawY) < snapRadius) snapped = pp;
              }
            }
          }
          mousePosUpdate = snapped || { x: rawX, y: rawY };
        }
      }

      // ── Schedule a single rAF to flush state updates (cap at 60fps) ───────
      pendingMoveRef.current = { compUpdate, wireUpdate, mousePosUpdate };
      if (!rafMoveRef.current) {
        rafMoveRef.current = requestAnimationFrame(() => {
          rafMoveRef.current = null;
          const { compUpdate, wireUpdate, mousePosUpdate } = pendingMoveRef.current || {};
          if (compUpdate) {
            const { id, newX, newY } = compUpdate;
            setComponents(prev => prev.map(c => c.id === id ? { ...c, x: newX, y: newY } : c));
          }
          if (wireUpdate) {
            const { wireId, cornerWaypoints } = wireUpdate;
            setWires(prev => prev.map(w => w.id === wireId ? { ...w, waypoints: cornerWaypoints } : w));
          }
          if (mousePosUpdate) {
            setMousePos(mousePosUpdate);
          }
          // Note: panUpdate is applied via direct DOM transform above — no setState here
        });
      }
    };
    const onUp = () => {
      // Cancel any pending rAF on mouse up to avoid a ghost render
      if (rafMoveRef.current) { cancelAnimationFrame(rafMoveRef.current); rafMoveRef.current = null; }
      // Fix #4 ─ commit final pan offset to React state once (1 render total for entire pan)
      if (isPanningRef.current && canvasOffsetRef.current) {
        setCanvasOffset({ ...canvasOffsetRef.current });
      }
      if (movingComp.current?.moved) {
        const origComps = movingComp.current.originalComps;
        const movedId = movingComp.current.id;
        setHistory(h => ({ past: [...h.past.slice(-20), { components: origComps, wires: JSON.parse(JSON.stringify(wires)) }], future: [] }));
        // Clear _corner waypoints on wires connected to the moved component so
        // they re-route cleanly from the new pin positions.
        setWires(prev => prev.map(w => {
          if (w.from.startsWith(movedId + ':') || w.to.startsWith(movedId + ':')) {
            if (w.waypoints?.length && w.waypoints[0]._corner) return { ...w, waypoints: [] };
          }
          return w;
        }));
      }
      movingComp.current = null;
      isPanningRef.current = false;
      if (segDragRef.current) {
        if (segDragRef.current.hasMoved) {
          // Save undo snapshot using pre-drag wires captured at drag start
          const pre = segDragRef.current.preWires;
          setHistory(h => ({ past: [...h.past.slice(-20), { components: JSON.parse(JSON.stringify(componentsRef.current)), wires: JSON.parse(JSON.stringify(pre)) }], future: [] }));
          // Prevent the subsequent click event from deselecting the wire
          didPanRef.current = true;
        }
        segDragRef.current = null;
        setSegDrag(null);
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [wireStart, wires])

  // ── Block default browser zoom/scroll with non-passive listeners ───────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventDefault = (e) => {
      // Still prevent wheel zoom (Ctrl + Wheel)
      if (e.ctrlKey) {
        if (e.cancelable) e.preventDefault();
      }
    };

    canvas.addEventListener('wheel', preventDefault, { passive: false });
    // removed native touch blockers as touch-action: none handles it and preventDefault might break React events

    return () => {
      canvas.removeEventListener('wheel', preventDefault);
    };
  }, []);

  // ── Pin click — start or complete wire ─────────────────────────────────────
  const onPinClick = useCallback((e, compId, pinId, pinLabel) => {
    e.stopPropagation()
    if (isRunning) return; // Restrict wiring while running

    const pos = getPinPos(compId, pinId)
    if (!pos) return

    if (!wireStart) {
      // Start wire
      setWireStart({ compId, pinId, pinLabel, ...pos })
    } else {
      // Complete wire — prevent self-loop
      if (wireStart.compId === compId && wireStart.pinId === pinId) {
        setWireStart(null)
        return
      }
      saveHistory();
      const newWire = {
        id: `w${nextWireId++}`,
        from: `${wireStart.compId}:${wireStart.pinId}`,
        to: `${compId}:${pinId}`,
        fromLabel: wireStart.pinLabel,
        toLabel: pinLabel,
        color: wireColor(wireStart.pinLabel),
        waypoints: wireStart.waypoints || [],
        isBelow: false // Add z-index configuration
      }
      setWires(prev => [...prev, newWire])
      setWireStart(null)
    }
  }, [wireStart, getPinPos, saveHistory, isRunning])

  const updateWireColor = (id, color) => {
    setWires(prev => prev.map(w => w.id === id ? { ...w, color } : w));
  };

  const toggleWireLayer = (id) => {
    saveHistory();
    setWires(prev => prev.map(w => w.id === id ? { ...w, isBelow: !w.isBelow } : w));
  };

  const updateComponentAttr = (id, key, value) => {
    saveHistory();
    setComponents(prev => prev.map(c => {
      if (c.id === id) {
        let newW = c.w;
        let newH = c.h;
        const nextValue = (key === 'env' && normalizeBoardKind(c.type) === 'rp2040')
          ? normalizeRp2040Env(value)
          : value;
        if (c.type === 'wokwi-neopixel-matrix') {
          const rows = key === 'rows' ? (parseInt(nextValue) || 1) : (parseInt(c.attrs?.rows) || 1);
          const cols = key === 'cols' ? (parseInt(nextValue) || 1) : (parseInt(c.attrs?.cols) || 1);
          newW = Math.max(30, cols * 30);
          newH = Math.max(30, rows * 30);
        }
        return { ...c, w: newW, h: newH, attrs: { ...c.attrs, [key]: nextValue } };
      }
      return c;
    }));
  };

  // Cancel wire on Escape / delete selected
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowF1Menu(prev => !prev);
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Escape') { setWireStart(null); setSelected(null); setWireClickPos(null); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !isRunning) {
        saveHistory();
        if (selected.match(/^w\d+$/)) {
          setWires(prev => prev.filter(w => w.id !== selected))
        } else {
          setComponents(prev => prev.filter(c => c.id !== selected))
          setWires(prev => prev.filter(w => !w.from.startsWith(selected + ':') && !w.to.startsWith(selected + ':')))
        }
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, isRunning, saveHistory])

  const deleteWire = (id) => {
    if (isRunning) return;
    saveHistory();
    setWires(prev => prev.filter(w => w.id !== id))
    if (selected === id) setSelected(null);
  }

  const rotateComponent = (id) => {
    if (isRunning) return;
    saveHistory();
    setComponents(prev => prev.map(c => c.id === id ? { ...c, rotation: ((c.rotation || 0) + 90) % 360 } : c));
  };

  const openCodeFile = useCallback((fileId) => {
    setOpenCodeTabs(prev => prev.includes(fileId) ? prev : [...prev, fileId]);
    setActiveCodeFileId(fileId);
  }, []);

  const closeCodeTab = useCallback((fileId) => {
    setOpenCodeTabs(prev => {
      const next = prev.filter(id => id !== fileId);
      if (activeCodeFileId === fileId) {
        setActiveCodeFileId(next[next.length - 1] || null);
      }
      return next;
    });
  }, [activeCodeFileId]);

  const saveCodeFile = useCallback((fileId) => {
    setProjectFiles(prev => prev.map(f => f.id === fileId ? { ...f, dirty: false } : f));
  }, []);

  const duplicateCodeFile = useCallback((fileId) => {
    setProjectFiles(prev => {
      const source = prev.find(f => f.id === fileId);
      if (!source) return prev;
      const ext = fileExt(source.name);
      const base = ext ? source.name.slice(0, -ext.length) : source.name;
      let name = `${base}_copy${ext}`;
      let path = `${source.path.substring(0, source.path.lastIndexOf('/') + 1)}${name}`;
      let i = 2;
      while (prev.some(f => f.path === path)) {
        name = `${base}_copy${i}${ext}`;
        path = `${source.path.substring(0, source.path.lastIndexOf('/') + 1)}${name}`;
        i++;
      }
      const dup = { ...source, id: path, path, name, dirty: true };
      return [...prev, dup];
    });
  }, []);

  const renameCodeFile = useCallback((fileId, nextName) => {
    const cleaned = String(nextName || '').trim();
    if (!cleaned) return;
    const source = projectFileMap.get(fileId);
    if (!source) return;
    const parent = source.path.substring(0, source.path.lastIndexOf('/') + 1);
    const nextPath = `${parent}${cleaned}`;

    setProjectFiles(prev => {
      if (prev.some(f => f.id !== fileId && f.path === nextPath)) return prev;
      return prev.map(f => f.id === fileId ? { ...f, id: nextPath, path: nextPath, name: cleaned, dirty: true } : f);
    });
    setOpenCodeTabs(prev => prev.map(id => id === fileId ? nextPath : id));
    if (activeCodeFileId === fileId) {
      setActiveCodeFileId(nextPath);
    }
  }, [activeCodeFileId, projectFileMap]);

  const toggleCodeFileDisabled = useCallback((fileId) => {
    const source = projectFileMap.get(fileId);
    if (!source || source.kind !== 'code') return;

    const currentlyDisabled = isFileDisabled(source.name);
    const nextName = currentlyDisabled
      ? source.name.slice(0, -DISABLED_FILE_SUFFIX.length)
      : `${source.name}${DISABLED_FILE_SUFFIX}`;

    renameCodeFile(fileId, nextName);
  }, [projectFileMap, renameCodeFile]);

  const deleteCodeFile = useCallback((fileId) => {
    setProjectFiles(prev => prev.filter(f => f.id !== fileId));
    setOpenCodeTabs(prev => prev.filter(id => id !== fileId));
    if (activeCodeFileId === fileId) {
      const next = openCodeTabs.find(id => id !== fileId) || null;
      setActiveCodeFileId(next);
    }
  }, [activeCodeFileId, openCodeTabs]);

  const downloadCodeFile = useCallback((fileId) => {
    const file = projectFileMap.get(fileId);
    if (!file) return;
    const blob = new Blob([file.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [projectFileMap]);

  const getBoardMainCode = useCallback((boardId) => {
    const preferred = `project/${boardId}/${boardId}.ino`;
    const prefFile = projectFileMap.get(preferred);
    if (prefFile && prefFile.content && !isFileDisabled(prefFile.path)) return prefFile.content;

    const ino = projectFiles.find(
      (f) => f.path.startsWith(`project/${boardId}/`) && fileExt(f.path) === '.ino' && !isFileDisabled(f.path)
    );
    if (ino?.content) return ino.content;

    return '';
  }, [projectFileMap, projectFiles]);

  const getBoardCompileFiles = useCallback((boardId, preferredMainPath = '') => {
    const allowed = new Set(['.ino', '.h', '.hpp', '.c', '.cpp']);
    const allFiles = projectFiles
      .filter((f) => f.path.startsWith(`project/${boardId}/`))
      .filter((f) => !isFileDisabled(f.path))
      .filter((f) => allowed.has(fileExt(f.path)))
      .map((f) => ({ path: f.path, name: f.name, content: f.id === activeCodeFileId ? code : (f.content || '') }));

    const preferredMainName = `${boardId}.ino`;
    const preferredPath = String(preferredMainPath || '').trim();
    const main = allFiles.find((f) => f.path === preferredPath)
      || allFiles.find((f) => f.name === preferredMainName)
      || allFiles.find((f) => fileExt(f.name) === '.ino')
      || null;

    const files = allFiles
      .filter((f) => !(main && f.path === main.path))
      .map((f) => ({ name: f.name, content: f.content }));

    return {
      mainCode: main?.content || getBoardMainCode(boardId) || '',
      sketchName: boardId,
      files,
      hasMainFile: !!main,
      mainFilePath: main?.path || '',
    };
  }, [projectFiles, getBoardMainCode, activeCodeFileId, code]);

  const getBoardFirmwareAssets = useCallback((boardId) => {
    const boardFiles = projectFiles
      .filter((f) => f.path.startsWith(`project/${boardId}/`))
      .filter((f) => !isFileDisabled(f.path));
    const uf2File = boardFiles.find((f) => fileExt(f.path) === '.uf2' && typeof f.content === 'string' && f.content.trim());
    const pyFiles = boardFiles
      .filter((f) => fileExt(f.path) === '.py')
      .map((f) => ({
        path: toBoardRelativePath(boardId, f.path),
        name: f.name,
        content: String(f.content || ''),
      }));

    const mainPy = pyFiles.find((f) => f.name.toLowerCase() === 'main.py') || pyFiles[0] || null;

    let uf2Payload = null;
    if (uf2File?.content) {
      const raw = String(uf2File.content).trim();
      uf2Payload = raw.startsWith(UF2_PAYLOAD_PREFIX) ? raw : `${UF2_PAYLOAD_PREFIX}${raw}`;
    }

    return { uf2Payload, mainPy, pythonFiles: pyFiles };
  }, [projectFiles]);

  const fetchDefaultMicroPythonUf2Payload = useCallback(async () => {
    if (micropythonUf2PayloadRef.current) return micropythonUf2PayloadRef.current;

    const response = await fetch(`${DEFAULT_PICO_MICROPYTHON_UF2_URL}?v=uart0`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to fetch default MicroPython UF2 (${response.status})`);
    }

    const buffer = await response.arrayBuffer();
    const payload = `${UF2_PAYLOAD_PREFIX}${arrayBufferToBase64(buffer)}`;
    micropythonUf2PayloadRef.current = payload;
    return payload;
  }, []);

  const fetchDefaultCircuitPythonUf2Payload = useCallback(async () => {
    if (circuitPythonUf2PayloadRef.current) return circuitPythonUf2PayloadRef.current;

    const version = encodeURIComponent(DEFAULT_PICO_CIRCUITPYTHON_VERSION);
    const response = await fetch(`${DEFAULT_PICO_CIRCUITPYTHON_UF2_URL}?v=${version}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to fetch default CircuitPython UF2 (${response.status})`);
    }

    const buffer = await response.arrayBuffer();
    const payload = `${UF2_PAYLOAD_PREFIX}${arrayBufferToBase64(buffer)}`;
    circuitPythonUf2PayloadRef.current = payload;
    return payload;
  }, []);

  const resolveFolderFilePolicy = useCallback((parentPath = 'project') => {
    const normalizedParent = String(parentPath || 'project').trim() || 'project';
    const boardMatch = normalizedParent.match(/^project\/([^/]+)(?:\/|$)/);
    if (!boardMatch) {
      return {
        parent: normalizedParent,
        boardId: '',
        boardKind: 'root',
        rp2040Mode: 'native',
        defaultExt: '.ino',
        allowedExtensions: ROOT_UPLOADABLE_EXTENSIONS,
      };
    }

    const boardId = boardMatch[1];
    const boardComp = boardComponentMap.get(boardId);
    const boardKind = normalizeBoardKind(boardComp?.type || '');
    if (boardKind !== 'rp2040') {
      return {
        parent: normalizedParent,
        boardId,
        boardKind,
        rp2040Mode: 'native',
        defaultExt: '.ino',
        allowedExtensions: RP2040_NATIVE_ALLOWED_EXTENSIONS,
      };
    }

    const rp2040Mode = rp2040BoardSourceModes[boardId] || 'native';
    return {
      parent: normalizedParent,
      boardId,
      boardKind,
      rp2040Mode,
      defaultExt: isRp2040PythonEnv(rp2040Mode) ? '.py' : '.ino',
      allowedExtensions: isRp2040PythonEnv(rp2040Mode)
        ? RP2040_MICROPYTHON_ALLOWED_EXTENSIONS
        : RP2040_NATIVE_ALLOWED_EXTENSIONS,
    };
  }, [boardComponentMap, rp2040BoardSourceModes]);

  const createCodeFile = useCallback((requestedName, openAfterCreate = false, customParent = null) => {
    const cleaned = String(requestedName || '').trim();
    if (!cleaned) return null;

    let parent = 'project';
    if (customParent) {
      parent = customParent;
    } else {
      const activePath = activeCodeFile?.path || '';
      parent = activePath.includes('/')
        ? activePath.substring(0, activePath.lastIndexOf('/'))
        : 'project';
    }

    const folderPolicy = resolveFolderFilePolicy(parent);

    const defaultExt = folderPolicy.defaultExt || '.ino';
    const rawExt = fileExt(cleaned);
    const fileNameBase = rawExt ? cleaned.slice(0, -rawExt.length) : cleaned;
    const ext = rawExt || defaultExt;
    const safeBase = fileNameBase.replace(/[^a-zA-Z0-9._-]/g, '_') || 'new_file';
    const safeExt = (ext.replace(/[^a-zA-Z0-9.]/g, '') || defaultExt).toLowerCase();

    if (!folderPolicy.allowedExtensions.has(safeExt)) {
      if (folderPolicy.boardKind === 'rp2040') {
        const modeLabel = isRp2040PythonEnv(folderPolicy.rp2040Mode) ? '.py' : '.ino';
        alert(`RP2040 board ${folderPolicy.boardId} currently allows ${modeLabel} workflow files. "${safeExt}" is disabled for this env.`);
      } else {
        alert(`Unsupported file type: ${safeExt}`);
      }
      return null;
    }

    let candidate = `${safeBase}${safeExt}`;
    let candidatePath = `${parent}/${candidate}`;
    let i = 2;

    while (projectFileMap.has(candidatePath)) {
      candidate = `${safeBase}_${i}${safeExt}`;
      candidatePath = `${parent}/${candidate}`;
      i++;
    }

    const boardMatch = candidatePath.match(/^project\/([^/]+)\//);
    const content = safeExt === '.h'
      ? `#pragma once\n\n// ${safeBase} declarations\n`
      : safeExt === '.cpp'
        ? `#include "${safeBase}.h"\n\n// ${safeBase} implementation\n`
        : safeExt === '.ino'
          ? `void setup() {\n}\n\nvoid loop() {\n}\n`
            : safeExt === '.py'
              ? `from machine import Pin\nfrom time import sleep\n\nled = Pin('LED', Pin.OUT)\n\nwhile True:\n  led.toggle()\n  sleep(0.5)\n`
          : '';

    const nextFile = {
      id: candidatePath,
      path: candidatePath,
      name: candidate,
      kind: 'code',
      boardId: boardMatch ? boardMatch[1] : undefined,
      boardKind: boardMatch ? folderPolicy.boardKind : undefined,
      content,
      dirty: true,
    };

    setProjectFiles(prev => [...prev, nextFile]);
    if (openAfterCreate) {
      setOpenCodeTabs(prev => prev.includes(candidatePath) ? prev : [...prev, candidatePath]);
      setActiveCodeFileId(candidatePath);
    }

    return candidatePath;
  }, [activeCodeFile, projectFileMap, resolveFolderFilePolicy]);

  const createCodeTab = useCallback((requestedName) => {
    return createCodeFile(requestedName, true);
  }, [createCodeFile]);

  const uploadCodeFile = useCallback((customParent = null) => {
    let parent = 'project';
    if (customParent) {
      parent = customParent;
    } else {
      const activePath = activeCodeFile?.path || '';
      parent = activePath.includes('/')
        ? activePath.substring(0, activePath.lastIndexOf('/'))
        : 'project';
    }

    const folderPolicy = resolveFolderFilePolicy(parent);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = Array.from(folderPolicy.allowedExtensions).join(',');
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const rawExt = fileExt(file.name);
      const readAsBinary = rawExt === '.uf2';
      const reader = new FileReader();
      reader.onload = (re) => {
        let content = re.target.result;
        if (readAsBinary) {
          const base64 = arrayBufferToBase64(content);
          content = `${UF2_PAYLOAD_PREFIX}${base64}`;
        }

        const fileNameBase = rawExt ? file.name.slice(0, -rawExt.length) : file.name;
        const ext = rawExt || folderPolicy.defaultExt || '.ino';
        const safeBase = fileNameBase.replace(/[^a-zA-Z0-9._-]/g, '_') || 'uploaded';
        const safeExt = (ext.replace(/[^a-zA-Z0-9.]/g, '') || '.ino').toLowerCase();

        if (!folderPolicy.allowedExtensions.has(safeExt)) {
          if (folderPolicy.boardKind === 'rp2040') {
            const modeLabel = isRp2040PythonEnv(folderPolicy.rp2040Mode) ? '.py' : '.ino';
            alert(`RP2040 board ${folderPolicy.boardId} currently allows ${modeLabel} workflow files. "${safeExt}" cannot be uploaded in this env.`);
          } else {
            alert(`Unsupported file type: ${safeExt}`);
          }
          return;
        }

        let candidate = `${safeBase}${safeExt}`;
        let candidatePath = `${parent}/${candidate}`;
        let i = 2;

        while (projectFileMap.has(candidatePath)) {
          candidate = `${safeBase}_${i}${safeExt}`;
          candidatePath = `${parent}/${candidate}`;
          i++;
        }

        const boardMatch = candidatePath.match(/^project\/([^/]+)\//);
        const nextFile = {
          id: candidatePath,
          path: candidatePath,
          name: candidate,
          kind: 'code',
          boardId: boardMatch ? boardMatch[1] : undefined,
          boardKind: boardMatch ? folderPolicy.boardKind : undefined,
          content,
          dirty: true,
        };

        setProjectFiles(prev => [...prev, nextFile]);
        setOpenCodeTabs(prev => prev.includes(candidatePath) ? prev : [...prev, candidatePath]);
        setActiveCodeFileId(candidatePath);
        
        appendConsoleEntry('info', `File uploaded: ${candidate}`, 'code');
      };
      if (readAsBinary) reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
    };
    input.click();
  }, [activeCodeFile, projectFileMap, appendConsoleEntry, resolveFolderFilePolicy]);

  // ─── Project Save / Load Handlers ───────────────────────────────────────────

  const sanitizeDownloadStem = useCallback((value, fallback = 'firmware') => {
    const cleaned = String(value || '')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return cleaned || fallback;
  }, []);

  const resolveFirmwareBoardFileStem = useCallback((boardId = '') => {
    const normalizedBoardId = String(boardId || '').trim();
    if (!normalizedBoardId) return '';

    const boardComp = boardComponentMap.get(normalizedBoardId);
    const boardLabel = String(boardComp?.label || '').trim();
    return sanitizeDownloadStem(boardLabel || normalizedBoardId, 'firmware');
  }, [boardComponentMap, sanitizeDownloadStem]);

  const buildSimulationJsonPayload = useCallback(() => {
    return buildProjectPayload({
      name: currentProjectName,
      board,
      components,
      wires,
      code,
      blocklyXml,
      blocklyGeneratedCode,
      useBlocklyCode,
      projectFiles,
      openCodeTabs,
      activeCodeFileId,
      exportedAt: new Date().toISOString(),
    });
  }, [
    currentProjectName,
    board,
    components,
    wires,
    code,
    blocklyXml,
    blocklyGeneratedCode,
    useBlocklyCode,
    projectFiles,
    openCodeTabs,
    activeCodeFileId,
  ]);

  const downloadSimulationJson = useCallback(() => {
    try {
      const payload = buildSimulationJsonPayload();
      const fileBase = sanitizeDownloadStem(currentProjectName || 'simulation', 'simulation');
      const fileName = `${fileBase}.json`;

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      appendConsoleEntry('info', `Simulation JSON downloaded: ${fileName}`, 'simulator');
    } catch (err) {
      appendConsoleEntry('error', `Simulation JSON download failed: ${err?.message || 'Unknown error'}`, 'simulator');
    }
  }, [appendConsoleEntry, buildSimulationJsonPayload, currentProjectName, sanitizeDownloadStem]);

  const parseFirmwareUploadFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (!(file instanceof File)) {
        reject(new Error('No firmware file selected.'));
        return;
      }

      const rawExt = fileExt(file.name).toLowerCase();
      if (rawExt !== '.hex' && rawExt !== '.uf2') {
        reject(new Error('Unsupported firmware file. Use .hex (all boards) or .uf2 (RP2040).'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
      reader.onload = () => {
        try {
          if (rawExt === '.uf2') {
            const buffer = reader.result;
            if (!(buffer instanceof ArrayBuffer)) {
              throw new Error('UF2 payload read failed.');
            }
            const payload = `${UF2_PAYLOAD_PREFIX}${arrayBufferToBase64(buffer)}`;
            resolve({ payload, ext: rawExt, fileName: file.name });
            return;
          }

          const payload = String(reader.result || '').trim();
          resolve({ payload, ext: rawExt, fileName: file.name });
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to parse firmware file.'));
        }
      };

      if (rawExt === '.uf2') reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
    });
  }, []);

  const normalizeFirmwareFileName = useCallback((artifactName, boardId, firmwarePayload) => {
    const cleaned = String(artifactName || '').trim();
    const isUf2 = typeof firmwarePayload === 'string' && firmwarePayload.startsWith(UF2_PAYLOAD_PREFIX);
    const defaultExt = isUf2 ? '.uf2' : '.hex';

    const boardStem = resolveFirmwareBoardFileStem(boardId);
    if (boardStem) {
      return `${boardStem}${defaultExt}`;
    }

    if (cleaned) {
      return /\.[a-z0-9]+$/i.test(cleaned)
        ? sanitizeDownloadStem(cleaned, 'firmware') + cleaned.match(/\.[a-z0-9]+$/i)[0]
        : `${sanitizeDownloadStem(cleaned, 'firmware')}${defaultExt}`;
    }

    return `firmware${defaultExt}`;
  }, [resolveFirmwareBoardFileStem, sanitizeDownloadStem]);

  const triggerFirmwareDownload = useCallback((firmwarePayload, fileName) => {
    if (!firmwarePayload) return;

    let content = firmwarePayload;
    let mimeType = 'text/plain';

    if (typeof firmwarePayload === 'string' && firmwarePayload.startsWith(UF2_PAYLOAD_PREFIX)) {
      const base64 = firmwarePayload.substring(UF2_PAYLOAD_PREFIX.length);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      content = bytes;
      mimeType = 'application/octet-stream';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, []);

  const resolveStoredFirmwareArtifact = useCallback((targetBoardId = '') => {
    const normalizedBoardId = String(targetBoardId || '').trim();

    const readStoredArtifact = (storageKey) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    };

    if (normalizedBoardId) {
      const byBoard = readStoredArtifact(`openhw_gdb_artifact_${normalizedBoardId}`);
      if (byBoard?.firmware) {
        return {
          boardId: normalizedBoardId,
          firmware: byBoard.firmware,
          artifactName: byBoard.artifactName || byBoard.elfName || '',
        };
      }
    }

    const latest = readStoredArtifact('openhw_gdb_last_artifact');
    if (latest?.firmware) {
      const latestBoardId = String(latest.boardId || '').trim();
      if (!normalizedBoardId || !latestBoardId || latestBoardId === normalizedBoardId) {
        return {
          boardId: latestBoardId || normalizedBoardId,
          firmware: latest.firmware,
          artifactName: latest.artifactName || latest.elfName || '',
        };
      }
    }

    if (!normalizedBoardId) {
      const fallback = lastCompiledRef.current?.result;
      if (fallback?.hex) {
        return {
          boardId: 'latest',
          firmware: fallback.hex,
          artifactName: fallback.artifactName || '',
        };
      }
    }

    return null;
  }, []);

  const handleDownloadFirmware = useCallback(async (target = '__latest__') => {
    try {
      const normalizedTarget = String(target || '__latest__').trim() || '__latest__';

      if (normalizedTarget === '__all__') {
        const boardIds = firmwareBoardOptions.map((opt) => opt.id);

        if (boardIds.length === 0) {
          const latest = resolveStoredFirmwareArtifact('');
          if (!latest?.firmware) {
            appendConsoleEntry('error', 'No firmware available. Compile the project first.', 'simulator');
            return;
          }
          const fileName = normalizeFirmwareFileName(latest.artifactName, latest.boardId || 'latest', latest.firmware);
          triggerFirmwareDownload(latest.firmware, fileName);
          appendConsoleEntry('info', `Firmware downloaded: ${fileName}`, 'simulator');
          return;
        }

        const missingBoards = [];
        let downloadedCount = 0;

        boardIds.forEach((boardId, idx) => {
          const artifact = resolveStoredFirmwareArtifact(boardId);
          if (!artifact?.firmware) {
            missingBoards.push(boardId);
            return;
          }

          const fileName = normalizeFirmwareFileName(artifact.artifactName, boardId, artifact.firmware);
          setTimeout(() => triggerFirmwareDownload(artifact.firmware, fileName), idx * 120);
          downloadedCount += 1;
        });

        if (downloadedCount === 0) {
          appendConsoleEntry('error', 'No board firmware found. Compile each board first.', 'simulator');
          return;
        }

        appendConsoleEntry('info', `Downloaded firmware for ${downloadedCount} board(s).`, 'simulator');
        if (missingBoards.length > 0) {
          appendConsoleEntry('warn', `Missing firmware for: ${missingBoards.join(', ')}`, 'simulator');
        }
        return;
      }

      const targetBoardId = normalizedTarget === '__latest__' ? '' : normalizedTarget;
      const artifact = resolveStoredFirmwareArtifact(targetBoardId);

      if (!artifact?.firmware) {
        const missingLabel = targetBoardId
          ? `No firmware found for ${targetBoardId}. Compile this board first.`
          : 'No firmware available. Compile the project first.';
        appendConsoleEntry('error', missingLabel, 'simulator');
        return;
      }

      const fileName = normalizeFirmwareFileName(
        artifact.artifactName,
        artifact.boardId || targetBoardId || 'firmware',
        artifact.firmware,
      );

      triggerFirmwareDownload(artifact.firmware, fileName);
      appendConsoleEntry('info', `Firmware downloaded: ${fileName}`, 'simulator');
    } catch (err) {
      appendConsoleEntry('error', `Download failed: ${err.message}`, 'simulator');
    }
  }, [appendConsoleEntry, firmwareBoardOptions, normalizeFirmwareFileName, resolveStoredFirmwareArtifact, triggerFirmwareDownload]);

  const openFirmwareDownloadDialog = useCallback(() => {
    setFirmwareDownloadTarget(firmwareBoardOptions[0]?.id || '__latest__');
    setShowFirmwareDownloadDialog(true);
  }, [firmwareBoardOptions]);

  const openFirmwareUploadDialog = useCallback(() => {
    setFirmwareUploadTarget(firmwareBoardOptions[0]?.id || '');
    setFirmwareUploadFile(null);
    setShowFirmwareUploadDialog(true);
    if (firmwareUploadInputRef.current) {
      firmwareUploadInputRef.current.value = '';
    }
  }, [firmwareBoardOptions]);

  const applyUploadedFirmwareToBoard = useCallback(async () => {
    const targetBoardId = String(firmwareUploadTarget || '').trim();
    if (!targetBoardId) {
      appendConsoleEntry('warn', 'Pick a board target before uploading firmware.', 'simulator');
      return;
    }
    if (!(firmwareUploadFile instanceof File)) {
      appendConsoleEntry('warn', 'Select a firmware file before uploading.', 'simulator');
      return;
    }

    const targetBoardComp = boardComponentMap.get(targetBoardId);
    if (!targetBoardComp) {
      appendConsoleEntry('error', `Board ${targetBoardId} is no longer available on canvas.`, 'simulator');
      return;
    }

    setIsApplyingFirmwareUpload(true);
    try {
      const parsed = await parseFirmwareUploadFile(firmwareUploadFile);
      const boardKind = normalizeBoardKind(targetBoardComp.type);
      if (boardKind !== 'rp2040' && parsed.ext !== '.hex') {
        throw new Error('Only RP2040 boards support UF2 firmware uploads. Use .hex for this board.');
      }
      if (!parsed.payload) {
        throw new Error('Firmware file is empty.');
      }

      saveHistory();
      setComponents((prev) => prev.map((comp) => {
        if (comp.id !== targetBoardId) return comp;
        return {
          ...comp,
          attrs: {
            ...(comp.attrs || {}),
            firmwareHex: parsed.payload,
            hex: parsed.payload,
            firmwareArtifactName: String(parsed.fileName || ''),
          },
        };
      }));

      lastCompiledRef.current = null;

      const boardLabel = boardCompToDisplayName(targetBoardComp, boardKind);
      const firmwareKind = parsed.ext === '.uf2' ? 'UF2' : 'HEX';
      appendConsoleEntry(
        'info',
        `Assigned ${firmwareKind} firmware (${parsed.fileName}) to ${boardLabel}. The next run will use this firmware.`,
        'simulator',
      );

      setShowFirmwareUploadDialog(false);
      setFirmwareUploadFile(null);
      if (firmwareUploadInputRef.current) {
        firmwareUploadInputRef.current.value = '';
      }
    } catch (err) {
      appendConsoleEntry('error', `Firmware upload failed: ${err?.message || 'Unknown error'}`, 'simulator');
    } finally {
      setIsApplyingFirmwareUpload(false);
    }
  }, [
    appendConsoleEntry,
    boardComponentMap,
    firmwareUploadTarget,
    firmwareUploadFile,
    parseFirmwareUploadFile,
    saveHistory,
  ]);

  const handleStartGDB = () => {
    appendConsoleEntry('info', 'Connecting to GDB Session...', 'simulator');
    // Note: requires backend running wokwi-gdbserver (e.g. gdbserver.js) on port 3333
    appendConsoleEntry('info', 'Opening local GDB session on http://localhost:3333...', 'simulator');
    window.open('http://localhost:3333', '_blank');
  };

  /** Open the save dialog. Pre-fills with the current project name. */
  const handleSave = () => {
    setSaveDialogName(currentProjectName || 'Untitled');
    setShowSaveDialog(true);
  };

  /** Commit the save from the dialog. */
  const handleConfirmSave = async () => {
    const name = saveDialogName.trim() || 'Untitled';
    const owner = getOwner();
    let id = currentProjectIdRef.current;
    if (!id) {
      id = generateProjectId();
      currentProjectIdRef.current = id;
      setCurrentProjectId(id);
    }
    setCurrentProjectName(name);
    clearTimeout(autoSaveTimerRef.current);
    await saveProject({ id, name, board, components, connections: wires, code, blocklyXml, blocklyGeneratedCode, useBlocklyCode, projectFiles, openCodeTabs, activeCodeFileId, owner });
    setShowSaveDialog(false);
  };

  /** Create a brand-new blank project. */
  const handleNewProject = () => {
    if (components.length > 0 || wires.length > 0) {
      if (!window.confirm('Start a new project? Unsaved changes will be auto-saved first.')) return;
    }
    const id = generateProjectId();
    currentProjectIdRef.current = id;
    setCurrentProjectId(id);
    setCurrentProjectName('Untitled');
    setBoard('arduino_uno');
    setCode('void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n');
    setComponents([]);
    setWires([]);
    setBlocklyXml('');
    setProjectFiles([]);
    setOpenCodeTabs([]);
    setActiveCodeFileId('');
    setHistory({ past: [], future: [] });
    lastCompiledRef.current = null;
  };

  /** Load a project from the My Projects modal. */
  const handleLoadProject = (proj) => {
    if (isRunning) return;
    const normalizedCircuit = normalizeImportedCircuitData(proj.components, proj.connections);
    const normalizedFiles = normalizeProjectFiles(proj.projectFiles);
    const normalizedTabs = normalizeOpenCodeTabs(proj.openCodeTabs, normalizedFiles);
    const preferredActive = String(proj.activeCodeFileId || '').trim();
    const activeId = normalizedFiles.some((f) => f.id === preferredActive)
      ? preferredActive
      : (normalizedTabs[0] || '');
    setBoard(proj.board || 'arduino_uno');
    setCode(proj.code || '');
    setBlocklyXml(proj.blocklyXml || '');
    setBlocklyGeneratedCode(proj.blocklyGeneratedCode || '');
    setUseBlocklyCode(!!proj.useBlocklyCode);
    setComponents(normalizedCircuit.components);
    setWires(normalizedCircuit.wires);
    setProjectFiles(normalizedFiles);
    setOpenCodeTabs(normalizedTabs);
    setActiveCodeFileId(activeId);
    syncNextIds(normalizedCircuit.components, normalizedCircuit.wires);
    setCurrentProjectId(proj.id);
    currentProjectIdRef.current = proj.id;
    setCurrentProjectName(proj.name || 'Untitled');
    setHistory({ past: [], future: [] });
    lastCompiledRef.current = null;
    setShowProjectsSidebar(false);
  };

  /** Delete a project from the My Projects modal. */
  const handleDeleteProject = async (id) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    await deleteProject(id);
    // If the active project was deleted, clear current id
    if (currentProjectIdRef.current === id) {
      currentProjectIdRef.current = null;
      setCurrentProjectId(null);
      setCurrentProjectName('Untitled');
    }
    await refreshProjectList();
  };

  // ─── Inline Rename ─────────────────────────────────────────────────────────
  const handleStartRename = (proj, e) => {
    e.stopPropagation();
    setRenamingProjectId(proj.id);
    setRenameValue(proj.name || 'Untitled');
  };
  const handleConfirmRename = async (id) => {
    const newName = renameValue.trim() || 'Untitled';
    await renameProject(id, newName);
    if (currentProjectIdRef.current === id) setCurrentProjectName(newName);
    setRenamingProjectId(null);
    await refreshProjectList();
  };

  const toggleFavourite = (id) => {
    setFavouriteProjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCopyProject = async (proj) => {
    const newId = generateProjectId();
    const newName = (proj.name || 'Untitled') + ' Copy';
    const projectData = { ...proj, id: newId, name: newName, savedAt: Date.now() };
    await saveProject(projectData);
    await refreshProjectList();
  };

  // ─── Backup / Restore ──────────────────────────────────────────────────────
  const handleBackupWorkflow = async () => {
    const zip = new JSZip();
    const data = buildProjectPayload({
      name: currentProjectName,
      board,
      components,
      wires,
      code,
      blocklyXml,
      blocklyGeneratedCode,
      useBlocklyCode,
      projectFiles,
      openCodeTabs,
      activeCodeFileId,
      exportedAt: new Date().toISOString(),
    });
    zip.file('workflow.json', JSON.stringify(data, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProjectName || 'workflow'}-backup.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleRestoreWorkflow = async (file) => {
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      const wf = zip.file('workflow.json');
      if (!wf) { alert('Invalid backup: workflow.json not found.'); return; }
      const json = JSON.parse(await wf.async('string'));
      if ((components.length > 0 || wires.length > 0) && !window.confirm('Restore backup? Current unsaved changes will be replaced.')) return;
      const normalizedCircuit = normalizeImportedCircuitData(json.components, Array.isArray(json.connections) ? json.connections : json.wires);
      const normalizedFiles = normalizeProjectFiles(Array.isArray(json.projectFiles) ? json.projectFiles : []);
      const normalizedTabs = normalizeOpenCodeTabs(Array.isArray(json.openCodeTabs) ? json.openCodeTabs : [], normalizedFiles);
      const preferredActive = String(json.activeCodeFileId || '').trim();
      const activeId = normalizedFiles.some((f) => f.id === preferredActive)
        ? preferredActive
        : (normalizedTabs[0] || normalizedFiles[0]?.id || '');
      setBoard(json.board || 'arduino_uno');
      setCode(json.code || '');
      setBlocklyXml(json.blocklyXml || '');
      setBlocklyGeneratedCode(json.blocklyGeneratedCode || '');
      setUseBlocklyCode(!!json.useBlocklyCode);
      setComponents(normalizedCircuit.components);
      setWires(normalizedCircuit.wires);
      setProjectFiles(normalizedFiles);
      setOpenCodeTabs(normalizedTabs);
      setActiveCodeFileId(activeId);
      syncNextIds(normalizedCircuit.components, normalizedCircuit.wires);
      setCurrentProjectName(json.name || 'Untitled');
      setHistory({ past: [], future: [] });
      lastCompiledRef.current = null;
    } catch (e) { alert('Failed to restore backup: ' + e.message); }
  };

  // ─── Cloud Sync (placeholder) ───────────────────────────────────────────────
  const handleSyncToCloud = () => { alert('Sync feature coming soon!'); };

  const handleShareSimulation = async () => {
    if (!isAuthenticated) {
      alert('Please sign in to share this simulation.');
      navigate('/login');
      return;
    }

    setShareUrl('');
    setShareCopied(false);
    setShowShareDialog(true);
  };

  const handleGenerateShareUrl = async () => {
    setIsSharingSimulation(true);
    try {
      const response = await createSharedSimulation({
        name: currentProjectName || 'Untitled',
        isPublic: shareVisibility === 'public',
        board,
        components,
        connections: wires,
        code,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
      });

      const url = `${window.location.origin}/simulator/share/${response.shareId}`;
      setShareUrl(url);
      setShareCopied(false);
    } catch (error) {
      console.error('Failed to share simulation', error);
      alert(error?.response?.data?.message || error.message || 'Failed to share simulation.');
    } finally {
      setIsSharingSimulation(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
    } catch (error) {
      console.error('Failed to copy share URL', error);
      alert('Failed to copy share URL.');
    }
  };

  // ─── Simulator Run & Stop Logic ─────────────────────────────────────────────
  const logSerial = (msg, color = 'var(--text)') => {
    // In a real implementation this would push to a serial console state array
    console.log(`[SIM]`, msg);
  };

  const logCompileSummary = useCallback((compiledResult, boardComp, boardKind) => {
    const summaryLines = extractCompileSummaryLines(compiledResult?.stdout || '');
    if (summaryLines.length === 0) return;

    const boardLabel = boardCompToDisplayName(boardComp, boardKind);
    summaryLines.forEach((line) => {
      appendConsoleEntry('info', `[${boardLabel}] ${line}`, 'simulator');
    });
  }, [appendConsoleEntry]);

  const registerGdbArtifact = useCallback((boardId, boardKind, compiledResult) => {
    const compiled = compiledResult && typeof compiledResult === 'object' ? compiledResult : null;
    if (!compiled || !boardId) return;

    const elfPayload = typeof compiled.elf === 'string' ? compiled.elf : '';
    const gdbMeta = compiled.gdb && typeof compiled.gdb === 'object' ? compiled.gdb : null;
    if (!elfPayload && !gdbMeta) return;

    const artifact = {
      boardId,
      boardKind,
      ts: Date.now(),
      elf: elfPayload,
      elfName: compiled.elfName || '',
      firmware: compiled.hex || '',
      artifactType: compiled.artifactType || '',
      gdb: gdbMeta,
    };

    try {
      localStorage.setItem(`openhw_gdb_artifact_${boardId}`, JSON.stringify(artifact));
      localStorage.setItem('openhw_gdb_last_artifact', JSON.stringify(artifact));
    } catch {
      // ignore storage failures
    }

    const gdbName = gdbMeta?.gdb || 'gdb-multiarch';
    const remoteTarget = gdbMeta?.targetRemote || 'localhost:3333';
    const elfLabel = artifact.elfName ? ` (${artifact.elfName})` : '';
    appendConsoleEntry('info', `GDB artifact ready for ${boardId}: ${gdbName} -> target remote ${remoteTarget}${elfLabel}`, 'debug');
    appendConsoleEntry('info', 'Web GDB reference: https://wokwi.github.io/web-gdb/', 'debug');
  }, [appendConsoleEntry]);

  const runCircuitValidation = useCallback(() => {
    try {
      const errs = validateCircuitLocally(components, wires);
      if (errs.length > 0) {
        setValidationErrors(errs);
        setShowValidation(true);
        setValidationToast({
          title: `Circuit validation failed (${errs.length})`,
          reasons: errs.slice(0, 3).map((e) => e.message),
        });
      } else {
        setValidationErrors([]);
        setValidationToast(null);
      }
      return errs.length === 0;
    } catch (err) {
      console.warn('[Validation] Engine failed, continuing run:', err);
      return true;
    }
  }, [components, wires]);

  const getSerialTimestamp = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
  };

  const parseSerialForPlotter = useCallback((chunk) => {
    serialPlotBufferRef.current += chunk;
    const lines = serialPlotBufferRef.current.split('\n');
    if (lines.length <= 1) return;

    const completeLines = lines.slice(0, -1);
    serialPlotBufferRef.current = lines[lines.length - 1];

    completeLines.forEach((line) => {
      const parts = line.split(/[,\s\t]+/).filter(Boolean);
      if (parts.length === 0) return;

      const isNumeric = parts.every((p) => !isNaN(parseFloat(p)));
      if (!isNumeric) {
        serialPlotLabelsRef.current = parts;
        setSelectedPlotPins((prev) => {
          const nextPins = [...prev];
          parts.forEach((lbl) => { if (!nextPins.includes(lbl)) nextPins.push(lbl); });
          return nextPins;
        });
        return;
      }

      latestParsedSerialRef.current = parts.map((p) => parseFloat(p));
      if (serialPlotLabelsRef.current.length < parts.length) {
        for (let i = serialPlotLabelsRef.current.length; i < parts.length; i++) {
          serialPlotLabelsRef.current.push(`SVar${i}`);
        }
      }

      setSelectedPlotPins((prev) => {
        let changed = false;
        const nextPins = [...prev];
        serialPlotLabelsRef.current.slice(0, parts.length).forEach((lbl) => {
          if (!nextPins.includes(lbl)) {
            nextPins.push(lbl);
            changed = true;
          }
        });
        return changed ? nextPins : prev;
      });
    });
  }, []);

  const appendSerialRxChunk = useCallback((chunk, boardId = 'default', source = 'sim') => {
    const normalizedBoardId = String(boardId || 'default');
    const normalizedSource = String(source || 'sim');
    const nowMs = Date.now();
    const arbState = serialIngressArbitrationRef.current.get(normalizedBoardId) || { source: '', lastAcceptedAt: 0 };

    if (!arbState.source) {
      arbState.source = normalizedSource;
    } else if (arbState.source !== normalizedSource) {
      const recentlyAccepted = (nowMs - Number(arbState.lastAcceptedAt || 0)) <= 240;
      // Keep one ingress stream active per board for a short window to avoid
      // USB/UART mirrored duplicate output bursts from RP2040 firmware.
      if (recentlyAccepted) {
        return;
      }
      arbState.source = normalizedSource;
    }

    arbState.lastAcceptedAt = nowMs;
    serialIngressArbitrationRef.current.set(normalizedBoardId, arbState);

    parseSerialForPlotter(chunk);
    const ts = getSerialTimestamp();
    setSerialHistory((prev) => {
      let next = prev.length > 2000 ? prev.slice(prev.length - 1800) : [...prev];
      if (next.length > 0) {
        const last = next[next.length - 1];
        if (last.dir === 'rx' && last.boardId === normalizedBoardId && last.source === normalizedSource && !last.text.endsWith('\n')) {
          next[next.length - 1] = { ...last, text: last.text + chunk };
          return next;
        }
      }
      return [...next, { dir: 'rx', text: chunk, ts, boardId: normalizedBoardId, source: normalizedSource }];
    });
  }, [parseSerialForPlotter]);

  const pushSerialRxChunk = useCallback((chunk, boardId = 'default', source = 'sim') => {
    if (serialPausedRef.current) {
      const queue = serialPausedQueueRef.current;
      queue.push({ chunk, boardId, source });
      if (queue.length > 1000) {
        queue.splice(0, queue.length - 1000);
      }
      return;
    }
    appendSerialRxChunk(chunk, boardId, source);
  }, [appendSerialRxChunk]);

  useEffect(() => {
    if (serialPaused) return;
    const queue = serialPausedQueueRef.current;
    if (!queue.length) return;

    const pending = queue.splice(0, queue.length);
    pending.forEach((entry) => {
      appendSerialRxChunk(entry.chunk, entry.boardId, entry.source);
    });
  }, [serialPaused, appendSerialRxChunk]);

  const pushSerialTxLine = useCallback((text, boardId = 'all', source = 'sim') => {
    setSerialHistory((prev) => [...prev, { dir: 'tx', text, ts: getSerialTimestamp(), boardId, source }]);
  }, []);

  const clearSerialMonitor = useCallback(() => {
    setSerialHistory([]);
    serialPlotBufferRef.current = '';
    serialPlotLabelsRef.current = [];
    latestParsedSerialRef.current = [];
    serialIngressArbitrationRef.current.clear();
    serialPausedQueueRef.current = [];
  }, []);

  const handleHardwareBoardChange = useCallback((nextBoardId) => {
    setHardwareBoardId(nextBoardId);
    if (nextBoardId) setSelected(nextBoardId);
  }, [setSelected]);

  const resolveBoardHex = useCallback(async (boardComp) => {
    if (!boardComp) throw new Error('No board selected for upload.');
    const kind = normalizeBoardKind(boardComp.type);
    const fqbn = resolveBoardFqbnForComponent(boardComp, kind);
    const boardHex = boardComp?.attrs?.firmwareHex || boardComp?.attrs?.hex;
    if (typeof boardHex === 'string' && boardHex.trim()) return boardHex;

    const compileUnit = getBoardCompileFiles(boardComp.id);
    if (!compileUnit.hasMainFile) {
      throw new Error(`No enabled .ino file found for ${boardComp.id}. Enable at least one .ino file before uploading.`);
    }
    const sourceCode = compileUnit.mainCode || '';
    const cacheKeyBoard = `${kind}:${boardComp.id}`;
    const rp2040Builder = resolveComponentAttrString(boardComp?.attrs, 'builder', 'arduino-pico') || 'arduino-pico';
    const buildEngine = kind === 'rp2040' ? rp2040Builder : 'arduino-cli';
    const cacheSource = [
      sourceCode,
      ...compileUnit.files.map((f) => `${f.name}\n${f.content || ''}`),
      fqbn,
      buildEngine,
    ].join('\n/*__SPLIT__*/\n');

    let compiled = await getCachedHex(cacheSource, cacheKeyBoard);
    if (!compiled) {
      compiled = await compileCode({
        code: sourceCode,
        files: compileUnit.files,
        sketchName: compileUnit.sketchName,
        fqbn,
        ...(kind === 'rp2040' ? { builder: rp2040Builder } : {}),
      });
      setCachedHex(cacheSource, cacheKeyBoard, compiled);
    }
    return compiled.hex;
  }, [getBoardCompileFiles]);

  const {
    hardwareAvailablePorts,
    showAllHardwarePorts,
    setShowAllHardwarePorts,
    isLoadingHardwarePorts,
    hardwareBaudRate,
    setHardwareBaudRate,
    hardwareResetMethod,
    setHardwareResetMethod,
    hardwarePortPath,
    setHardwarePortPath,
    resolvedHardwarePort,
    refreshHardwarePorts,
    uploadToHardware,
    isUploadingHardware,
  } = useHardwareFlashing({
    hardwareBoardId,
    boardComponents,
    resolveBoardHex,
    normalizeBoardKind,
    resolveBoardFqbn: resolveBoardFqbnForComponent,
    boardFqbn: BOARD_FQBN,
    flashFirmware,
    pushSerialTxLine,
    pushSerialRxChunk,
    setHardwareStatus,
  });

  const {
    hardwareConnected,
    hardwareConnecting,
    connectHardwareSerial,
    disconnectHardwareSerial,
    sendHardwareSerialLine,
  } = useWebSerialHardware({
    hardwareBoardId,
    hardwareSerialTargetRef,
    boardComponents,
    board,
    hardwareBaudRate,
    showAllHardwarePorts,
    normalizeBoardKind,
    boardDefaultBaud: BOARD_DEFAULT_BAUD,
    pushSerialRxChunk,
    pushSerialTxLine,
    setHardwareStatus,
  });

  useEffect(() => {
    if (!hardwareConnected) {
      setHardwareSerialTargetId(null);
      hardwareSerialTargetRef.current = null;
      return;
    }

    const deviceLabel = String(resolvedHardwarePort || '').trim();
    const nextTarget = deviceLabel
      ? `hw:${deviceLabel}`
      : (hardwareBoardId ? `hw:${hardwareBoardId}` : 'hw:connected');

    setHardwareSerialTargetId(nextTarget);
    hardwareSerialTargetRef.current = nextTarget;
  }, [hardwareConnected, resolvedHardwarePort, hardwareBoardId]);

  const handleUploadToHardware = useCallback(async () => {
    // Disconnect browser Web Serial first to release COM port lock for arduino-cli upload.
    if (hardwareConnected) {
      setHardwareStatus('Disconnecting Web Serial before flash...');
      appendConsoleEntry('info', 'Disconnecting Web Serial to release port for flashing...', 'hardware');
      await disconnectHardwareSerial();
    }

    await uploadToHardware();
  }, [hardwareConnected, disconnectHardwareSerial, uploadToHardware, setHardwareStatus, appendConsoleEntry]);

  const handleRun = async () => {
    try {
      if (runStartGuardRef.current || isRunning || isCompiling) {
        appendConsoleEntry('info', 'Run is already in progress.', 'simulator');
        return;
      }

      runStartGuardRef.current = true;
      appendConsoleEntry('info', 'Run requested.', 'simulator');
      rp2040GdbLastLogRef.current.clear();
      rp2040WirelessLastLogRef.current.clear();
      rp2040UartMicroPythonBoardsRef.current.clear();
      rp2040UartSilentWarnedBoardsRef.current.clear();
      serialIngressArbitrationRef.current.clear();
      serialPausedQueueRef.current = [];
      runComponentUpdateCountsRef.current = {};
      runPinTransitionCountsRef.current = {};
      runLastBoardPinsRef.current = new Map();

      if (!runCircuitValidation()) {
        appendConsoleEntry('warn', 'Run blocked: validation errors found.', 'simulator');
        runStartGuardRef.current = false;
        return;
      }

      setIsRunning(true);
      setIsCompiling(true);
      setRunStartedAtMs(Date.now());
      setRunDurationSec(0);
      const parsedRunBaud = Number(serialBaudRate);
      const selectedRunBaud = Number.isFinite(parsedRunBaud)
        ? parsedRunBaud
        : Number(BOARD_DEFAULT_BAUD[selectedSerialBoardKind] || BOARD_DEFAULT_BAUD.arduino_uno);
      const selectedRunBoardId = serialBoardFilter !== 'all' && serialBoardMap.has(serialBoardFilter)
        ? serialBoardFilter
        : '';
      const boardHexMap = {};
      const boardPythonMap = {};
      const boardPythonFilesMap = {};
      const boardRuntimeEnvMap = {};
      const boardBaudMap = {};
      const programmableBoards = components.filter(c => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type));
      const singleProgrammableBoardId = programmableBoards.length === 1 ? programmableBoards[0]?.id : '';
      const boardsWithoutCompilableSketch = [];
      let result = null;

      if (programmableBoards.length > 0) {
        for (const boardComp of programmableBoards) {
          const kind = normalizeBoardKind(boardComp.type);
          const targetFqbn = resolveBoardFqbnForComponent(boardComp, kind);
          const defaultBaud = Number(BOARD_DEFAULT_BAUD[kind] || BOARD_DEFAULT_BAUD.arduino_uno);
          boardBaudMap[boardComp.id] = selectedRunBoardId
            ? (boardComp.id === selectedRunBoardId ? selectedRunBaud : defaultBaud)
            : selectedRunBaud;

          const uploadedFirmware = String(
            resolveComponentAttrString(boardComp?.attrs, 'firmwareHex', '')
            || resolveComponentAttrString(boardComp?.attrs, 'hex', ''),
          ).trim();
          if (uploadedFirmware) {
            boardHexMap[boardComp.id] = uploadedFirmware;
            const uploadKind = uploadedFirmware.startsWith(UF2_PAYLOAD_PREFIX) ? 'UF2' : 'HEX';
            appendConsoleEntry(
              'info',
              `Using uploaded ${uploadKind} firmware for ${boardCompToDisplayName(boardComp, kind)}.`,
              'simulator',
            );
            if (!result) {
              result = {
                hex: uploadedFirmware,
                artifactName: normalizeFirmwareFileName('', boardComp.id, uploadedFirmware),
              };
            }
            continue;
          }

          const firmwareAssets = getBoardFirmwareAssets(boardComp.id);
          const activeFilePath = String(activeCodeFile?.path || '');
          const activeFileExt = fileExt(activeFilePath);
          const activeFileContent = String(code || '');
          const activeBoardFile = activeFilePath.startsWith(`project/${boardComp.id}/`) ? activeCodeFile : null;
          const activeFileTargetsBoard = !!activeBoardFile || singleProgrammableBoardId === boardComp.id;
          const activeBoardExt = activeBoardFile ? fileExt(activeBoardFile.path) : '';
          const activePythonSource = activeFileExt === '.py'
            && activeFileTargetsBoard
            && !isFileDisabled(activeFilePath)
            ? (activeBoardFile ? String(activeBoardFile.content || '') : activeFileContent)
            : '';
          const boardEnabledFiles = projectFiles
            .filter((f) => f.path.startsWith(`project/${boardComp.id}/`))
            .filter((f) => !isFileDisabled(f.path));
          const boardEnabledPyFiles = boardEnabledFiles.filter((f) => fileExt(f.path) === '.py');
          const pythonSource = activePythonSource || String(firmwareAssets.mainPy?.content || '');
          const hasPythonSource = boardEnabledPyFiles.some((f) => String(f.content || '').trim()) || !!pythonSource.trim();
          const activePrefersIno = activeFileExt === '.ino' && activeFileTargetsBoard;
          const activePrefersPy = activeFileExt === '.py' && activeFileTargetsBoard;
          const preferredMainPath = activeBoardExt === '.ino' && activeBoardFile && !isFileDisabled(activeBoardFile.path)
            ? activeBoardFile.path : '';
          const compileUnit = getBoardCompileFiles(boardComp.id, preferredMainPath);
          const compileSource = useBlocklyCode
            ? blocklyGeneratedCode
            : (activeFileExt === '.py' && activeFileTargetsBoard
              ? (String(activeCodeFile?.content || '') || String(code || ''))
              : (compileUnit.mainCode || getBoardMainCode(boardComp.id) || String(code || '')));

          if (kind !== 'rp2040' && !compileUnit.hasMainFile) {
            boardsWithoutCompilableSketch.push(boardComp.id);
            continue;
          }

          // ── RP2040: emulate UF2 on rp2040js and boot user files from flash filesystem ──
          if (kind === 'rp2040') {
            const configuredEnv = normalizeRp2040Env(resolveComponentAttrString(boardComp?.attrs, 'env', 'native'));
            boardRuntimeEnvMap[boardComp.id] = configuredEnv;

            const configuredMode = configuredEnv === 'native' ? 'ino' : configuredEnv;
            const configuredBuilder = resolveComponentAttrString(boardComp?.attrs, 'builder', 'arduino-pico') || 'arduino-pico';
            const hasNativeSketch = compileUnit.hasMainFile || (activePrefersIno && !!compileSource.trim());
            const hasExplicitPython = activePrefersPy || hasPythonSource;
            const prefersNativeFromSyntax = /\bvoid\s+setup\s*\(|\bvoid\s+loop\s*\(|#include\s*</.test(String(compileSource || ''));
            const selectedSourceMode = resolveRp2040SourceMode({
              configuredMode,
              activePrefersIno,
              activePrefersPy,
              hasNativeSketch,
              hasPythonSource: hasExplicitPython,
              prefersNativeFromSyntax,
            });
            const useMicroPythonPath = selectedSourceMode === 'py';
            const useCircuitPythonPath = selectedSourceMode === 'cp';
            const usePythonPath = useMicroPythonPath || useCircuitPythonPath;

            if (selectedSourceMode === 'ino' && !hasNativeSketch) {
              const msg = `RP2040 source mode is set to .ino for ${boardComp.id}, but no enabled .ino sketch was found.`;
              appendConsoleEntry('warn', msg, 'simulator');
              logSerial(msg, 'var(--orange)');
              boardsWithoutCompilableSketch.push(boardComp.id);
              continue;
            }

            if (usePythonPath) {
              const runtimeEnv = useCircuitPythonPath ? 'circuitpython' : 'micropython';
              const entryFileName = getRp2040PythonEntryFileName(runtimeEnv);
              const firmwareEntryPy = runtimeEnv === 'circuitpython'
                ? (firmwareAssets.pythonFiles || []).find((f) => String(f.name || '').toLowerCase() === 'code.py')
                : firmwareAssets.mainPy;

              let pyToRun = String(firmwareEntryPy?.content || '').trim() || pythonSource.trim();
              if (!pyToRun && looksLikeMicroPythonSource(compileSource)) {
                pyToRun = compileSource;
              }
              if (!pyToRun && runtimeEnv === 'micropython') {
                pyToRun = arduinoSerialToMicroPython(compileSource, boardComp.id);
              }
              if (!pyToRun && runtimeEnv === 'micropython') {
                pyToRun = arduinoBlinkToMicroPython(compileSource, boardComp.id);
              }
              if (!pyToRun) {
                pyToRun = createDefaultMainCode('rp2040', boardComp.id, { rp2040Mode: runtimeEnv });
              }

              if (runtimeEnv === 'micropython') {
                pyToRun = applyRp2040MicroPythonCompat(pyToRun);
              }

              const runtimeFiles = {};
              boardEnabledFiles.forEach((fileObj) => {
                const ext = fileExt(fileObj.path);
                if (!ext) return;
                if (ext === '.uf2') return;
                if (ARDUINO_CODE_EXTENSIONS.has(ext)) return;

                const relPath = toBoardRelativePath(boardComp.id, fileObj.path);
                if (!relPath) return;

                const fileContent = fileObj.id === activeCodeFileId
                  ? String(code || '')
                  : String(fileObj.content || '');
                runtimeFiles[relPath] = fileContent;
              });

              if (!String(runtimeFiles[entryFileName] || '').trim()) {
                runtimeFiles[entryFileName] = pyToRun;
              }

              const rp2040Firmware = firmwareAssets.uf2Payload
                || (runtimeEnv === 'circuitpython'
                  ? await fetchDefaultCircuitPythonUf2Payload()
                  : await fetchDefaultMicroPythonUf2Payload());
              boardHexMap[boardComp.id] = rp2040Firmware;
              boardPythonMap[boardComp.id] = pyToRun;
              boardPythonFilesMap[boardComp.id] = runtimeFiles;

              const runtimeLabel = runtimeEnv === 'circuitpython' ? 'CircuitPython' : 'MicroPython';
              appendConsoleEntry(
                'info',
                `RP2040 running via rp2040js + ${runtimeLabel} flash filesystem on ${boardComp.id} (env: ${configuredEnv}).`,
                'simulator'
              );
              if (!result) result = { hex: rp2040Firmware || '' };
              continue;
            }

            const nativeCompileSource = prepareRp2040SketchForSimulation(compileSource);
            if (nativeCompileSource !== compileSource) {
              appendConsoleEntry('info', `RP2040: routed Serial output to UART0 monitor for ${boardComp.id}.`, 'simulator');
            }

            const cacheKeyBoard = `${kind}:${boardComp.id}`;
            const builder = configuredBuilder;
            const cacheSource = [
              RP2040_SIM_PROTOCOL_VERSION,
              builder,
              configuredMode,
              targetFqbn,
              nativeCompileSource,
              ...compileUnit.files.map((f) => `${f.name}\n${f.content || ''}`),
            ].join('\n/*__SPLIT__*/\n');

            appendConsoleEntry('info', `Compiling for ${boardCompToDisplayName(boardComp, kind)}...`, 'simulator');
            let compiled = await getCachedHex(cacheSource, cacheKeyBoard);
            if (compiled) {
              logSerial(`Using cached compilation for ${boardComp.id}...`);
            } else {
              logSerial(`Compiling ${boardComp.id}...`);
              try {
                compiled = await compileCode({
                  code: nativeCompileSource,
                  files: compileUnit.files,
                  sketchName: compileUnit.sketchName,
                  fqbn: targetFqbn,
                  builder,
                });
                setCachedHex(cacheSource, cacheKeyBoard, compiled);
              } catch (compileErr) {
                if (isRp2040CoreMissingError(compileErr)) {
                  appendConsoleEntry('error', `RP2040 core is not installed for ${boardComp.id}. Native .ino mode cannot run without Arduino-Pico core.`, 'simulator');
                }
                throw compileErr;
              }
            }

            boardHexMap[boardComp.id] = compiled.hex;
            logCompileSummary(compiled, boardComp, kind);
            registerGdbArtifact(boardComp.id, kind, compiled);
            appendConsoleEntry('info', `RP2040 native firmware compiled and running on ${boardComp.id}.`, 'simulator');
            if (!result) result = compiled;
            continue;
          }

          const cacheKeyBoard = `${kind}:${boardComp.id}`;
          const cacheSource = [
            compileSource,
            targetFqbn,
            ...compileUnit.files.map((f) => `${f.name}\n${f.content || ''}`),
          ].join('\n/*__SPLIT__*/\n');

          appendConsoleEntry('info', `Compiling for ${boardCompToDisplayName(boardComp, kind)}...`, 'simulator');
          let compiled = await getCachedHex(cacheSource, cacheKeyBoard);
          if (compiled) {
            logSerial(`Using cached compilation for ${boardComp.id}...`);
          } else {
            logSerial(`Compiling ${boardComp.id}...`);
            try {
              compiled = await compileCode({
                code: compileSource,
                files: compileUnit.files,
                sketchName: compileUnit.sketchName,
                fqbn: targetFqbn,
              });
              setCachedHex(cacheSource, cacheKeyBoard, compiled);
            } catch (compileErr) {
              throw compileErr;
            }
          }

          boardHexMap[boardComp.id] = compiled.hex;
          logCompileSummary(compiled, boardComp, kind);
          registerGdbArtifact(boardComp.id, kind, compiled);
          if (!result) result = compiled;
        }
      }

      if (!result && programmableBoards.length > 0) {
        const blockedMsg = boardsWithoutCompilableSketch.length > 0
          ? `Run blocked: no enabled .ino sketch found for ${boardsWithoutCompilableSketch.join(', ')}.`
          : 'Run blocked: no firmware was produced for programmable boards.';
        appendConsoleEntry('warn', blockedMsg, 'simulator');
        logSerial(blockedMsg, 'var(--orange)');
        setIsCompiling(false);
        setIsRunning(false);
        setRunStartedAtMs(null);
        setRunDurationSec(0);
        runStartGuardRef.current = false;
        return;
      }

      if (!result) {
        const finalCode = useBlocklyCode ? blocklyGeneratedCode : code;
        const fallbackKind = normalizeBoardKind(board);
        const engine = fallbackKind === 'rp2040' ? 'arduino-pico' : 'arduino-cli';
        const cacheStr = [finalCode, engine].join('\n/*__SPLIT__*/\n');
        appendConsoleEntry('info', `Compiling for ${boardKindToDisplayName(fallbackKind)}...`, 'simulator');
        
        const cached = await getCachedHex(cacheStr, board);
        if (cached) {
          logSerial('Using locally cached compilation (offline cache)...');
          result = cached;
        } else {
          logSerial('Compiling...');
          result = await compileCode({
            code: finalCode,
            fqbn: BOARD_FQBN[fallbackKind] || BOARD_FQBN.arduino_uno,
            ...(fallbackKind === 'rp2040' ? { builder: 'arduino-pico' } : {}),
          });
          setCachedHex(cacheStr, board, result);
          registerGdbArtifact(board || 'default', fallbackKind, result);
        }
        logCompileSummary(result, null, fallbackKind);
      }

      lastCompiledRef.current = { code, board, result };
      setIsCompiling(false);
      logSerial('Compiled! Connecting to emulator...');

      // Load Web Worker
      const worker = new Worker(new URL('../../worker/simulation.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = async (event) => {
        const msg = event.data;
        if (msg.type === 'debug' && msg.category === 'rp2040-runtime') {
          const incomingBoardId = String(msg.boardId || '').trim();
          const hasKnownBoard = incomingBoardId && boardComponents.some((b) => b.id === incomingBoardId);
          const singleBoardFallback = boardComponents.length === 1 ? boardComponents[0]?.id : '';
          const resolvedBoardId = hasKnownBoard
            ? incomingBoardId
            : (singleBoardFallback || incomingBoardId || 'default');

          const metrics = msg.metrics || {};
          const reason = String(msg.reason || 'tick');
          const pc = Number(metrics.pc);
          const sp = Number(metrics.sp);
          const gp20 = !!metrics.gp20;
          const gp25 = !!metrics.gp25;
          const tx = Number(metrics.serialTxBytes || 0);
          const rx = Number(metrics.serialRxBytes || 0);
          const inq = Number(metrics.serialInputQueue || 0);
          const cycles = Number(metrics.cycles || 0);
          const steps = Number(metrics.stepCount || 0);
          const stall = Number(metrics.pcStallTicks || 0);
          const running = !!metrics.running;
          const entry = metrics.entry && typeof metrics.entry === 'object' ? metrics.entry : null;
          const ledId = String(metrics.ledId || '').trim();
          const ledOn = typeof metrics.ledOn === 'boolean' ? metrics.ledOn : null;
          const ledAnodeV = Number.isFinite(Number(metrics.ledAnodeV)) ? Number(metrics.ledAnodeV) : null;
          const ledCathodeV = Number.isFinite(Number(metrics.ledCathodeV)) ? Number(metrics.ledCathodeV) : null;
          const ledDeltaV = Number.isFinite(Number(metrics.ledDeltaV)) ? Number(metrics.ledDeltaV) : null;
          const primask = !!metrics.primask;
          const stepsSinceLastEmit = Number(metrics.stepsSinceLastEmit || 0);

          const pcHex = Number.isFinite(pc) ? `0x${(pc >>> 0).toString(16)}` : 'n/a';
          const spHex = Number.isFinite(sp) ? `0x${(sp >>> 0).toString(16)}` : 'n/a';
          const entryVectorHex = Number.isFinite(Number(entry?.vectorBase))
            ? `0x${(Number(entry.vectorBase) >>> 0).toString(16)}`
            : 'n/a';
          const entryResolvedHex = Number.isFinite(Number(entry?.resolvedPC))
            ? `0x${(Number(entry.resolvedPC) >>> 0).toString(16)}`
            : 'n/a';

          const debugBoardComp = components.find((c) => c.id === resolvedBoardId)
            || boardComponents.find((b) => b.id === resolvedBoardId);
          const isRp2040DebugBoard = normalizeBoardKind(debugBoardComp?.type || '') === 'rp2040';
          const startupFallbackEntry = reason === 'start' && !!entry?.usedFallback;
          if (startupFallbackEntry && isRp2040DebugBoard) {
            appendConsoleEntry('warn', `RP2040 startup vector fallback detected on ${resolvedBoardId}; automatic recovery is disabled in deterministic mode.`, 'simulator');
            logSerial(`RP2040 startup fallback on ${resolvedBoardId}. Automatic recovery is disabled in deterministic mode.`, 'var(--orange)');
          }

          const isUartMicroPythonBoard = rp2040UartMicroPythonBoardsRef.current.has(resolvedBoardId);
          const queueDrained = inq <= 0;
          const shouldWarnUartSilent = reason === 'tick'
            && isUartMicroPythonBoard
            && tx === 0
            && rx >= 512
            && (queueDrained || rx >= 2048)
            && stall >= 3
            && cycles >= 120_000_000
            && !rp2040UartSilentWarnedBoardsRef.current.has(resolvedBoardId);

          if (shouldWarnUartSilent) {
            rp2040UartSilentWarnedBoardsRef.current.add(resolvedBoardId);
            appendConsoleEntry(
              'warn',
              `RP2040 MicroPython UART injection appears silent on ${resolvedBoardId} (tx=0, rx=${rx}, inq=${inq}, stall=${stall}). Check script startup logs and wiring.`,
              'simulator'
            );
            logSerial(
              `RP2040 ${resolvedBoardId}: UART injection is silent (tx=0, rx=${rx}, inq=${inq}). Verify script startup and board wiring.`,
              'var(--orange)'
            );
          }

          const prev = rp2040DebugLastLogRef.current.get(resolvedBoardId) || null;
          const now = Date.now();
          const changed = !prev
            || prev.pcHex !== pcHex
            || prev.gp20 !== gp20
            || prev.gp25 !== gp25
            || prev.tx !== tx
            || prev.rx !== rx
            || prev.ledOn !== ledOn
            || prev.ledDeltaV !== ledDeltaV
            || reason !== 'tick';

          const highPins = Array.isArray(metrics.highPins) ? metrics.highPins : [];
          const highPinsLabel = highPins.length > 0
            ? `${highPins.slice(0, 12).join(',')}${highPins.length > 12 ? ',+' : ''}`
            : '-';
          const pinBitmap = typeof metrics.pinBitmap === 'string' ? metrics.pinBitmap : '';

          if (changed || now - (prev?.ts || 0) > 2500) {
            const line = [
              `RP2040 dbg ${resolvedBoardId}`,
              `reason=${reason}`,
              `run=${running ? '1' : '0'}`,
              `pc=${pcHex}`,
              `sp=${spHex}`,
              `cyc=${cycles}`,
              `steps=${steps}`,
              `gp20=${gp20 ? 'H' : 'L'}`,
              `gp25=${gp25 ? 'H' : 'L'}`,
              `uart=${metrics.activeUart ?? 'n/a'}`,
              `usb=${metrics.usbCdcReady ? '1' : '0'}`,
              `tx=${tx}`,
              `rx=${rx}`,
              `inq=${inq}`,
              `stall=${stall}`,
              `pri=${primask ? '1' : '0'}`,
              `dSteps=${stepsSinceLastEmit}`,
              `high=${highPinsLabel}`,
              pinBitmap ? `pins=${pinBitmap}` : '',
              entry ? `entry=${entryVectorHex}->${entryResolvedHex}${entry.usedFallback ? ':fallback' : ''}${entry.strategy ? `:${entry.strategy}` : ''}` : '',
              entry && Number.isFinite(Number(entry.probe0100SP))
                ? `probe0100=sp:0x${(Number(entry.probe0100SP) >>> 0).toString(16)},pc:0x${(Number(entry.probe0100PC) >>> 0).toString(16)}`
                : '',
              entry && Number.isFinite(Number(entry.probe0000SP))
                ? `probe0000=sp:0x${(Number(entry.probe0000SP) >>> 0).toString(16)},pc:0x${(Number(entry.probe0000PC) >>> 0).toString(16)}`
                : '',
              ledId ? `led=${ledId}:${ledOn === null ? 'n/a' : (ledOn ? 'on' : 'off')}` : '',
              ledAnodeV !== null ? `vA=${ledAnodeV.toFixed(2)}` : '',
              ledCathodeV !== null ? `vK=${ledCathodeV.toFixed(2)}` : '',
              ledDeltaV !== null ? `dV=${ledDeltaV.toFixed(2)}` : '',
              metrics.lastGpioPin ? `lastPin=${metrics.lastGpioPin}` : '',
            ].filter(Boolean).join(' | ');

            const warn = reason === 'fault' || stall > 180;
            appendConsoleEntry(warn ? 'warn' : 'info', line, 'debug');
            rp2040DebugLastLogRef.current.set(resolvedBoardId, {
              ts: now,
              pcHex,
              gp20,
              gp25,
              tx,
              rx,
              ledOn,
              ledDeltaV,
            });
          }

          return;
        }
        if (msg.type === 'debug' && msg.category === 'rp2040-wireless-stub') {
          const incomingBoardId = String(msg.boardId || '').trim();
          const hasKnownBoard = incomingBoardId && boardComponents.some((b) => b.id === incomingBoardId);
          const singleBoardFallback = boardComponents.length === 1 ? boardComponents[0]?.id : '';
          const resolvedBoardId = hasKnownBoard
            ? incomingBoardId
            : (singleBoardFallback || incomingBoardId || 'default');

          const wireless = msg.wireless && typeof msg.wireless === 'object' ? msg.wireless : {};
          const mode = String(wireless.mode || 'compat-stub');
          const status = String(wireless.status || (mode === 'off' ? 'off' : 'booting'));
          const connected = !!wireless.connected;
          const ssid = String(wireless.ssid || '');
          const ip = String(wireless.ip || '');
          const note = String(wireless.note || '');

          setOopStates((prev) => ({
            ...prev,
            [resolvedBoardId]: {
              ...(prev[resolvedBoardId] || {}),
              wirelessMode: mode,
              wirelessStatus: status,
              wirelessConnected: connected,
              wirelessSsid: ssid,
              wirelessIp: ip,
              wirelessNote: note,
            },
          }));

          const signature = `${mode}:${status}:${connected ? '1' : '0'}:${ssid}:${ip}`;
          const lastSignature = rp2040WirelessLastLogRef.current.get(resolvedBoardId);
          if (lastSignature !== signature) {
            const line = [
              `Pico W wireless ${resolvedBoardId}`,
              `mode=${mode}`,
              `status=${status}`,
              `connected=${connected ? '1' : '0'}`,
              `ssid=${ssid || '-'}`,
              `ip=${ip || '-'}`,
              note,
            ].filter(Boolean).join(' | ');
            appendConsoleEntry(connected || status === 'off' ? 'info' : 'warn', line, 'debug');
            rp2040WirelessLastLogRef.current.set(resolvedBoardId, signature);
          }
          return;
        }
        if (msg.type === 'debug' && msg.category === 'rp2040-gdb') {
          const incomingBoardId = String(msg.boardId || '').trim();
          const hasKnownBoard = incomingBoardId && boardComponents.some((b) => b.id === incomingBoardId);
          const singleBoardFallback = boardComponents.length === 1 ? boardComponents[0]?.id : '';
          const resolvedBoardId = hasKnownBoard
            ? incomingBoardId
            : (singleBoardFallback || incomingBoardId || 'default');

          const gdb = msg.gdb && typeof msg.gdb === 'object' ? msg.gdb : {};
          const status = String(gdb.status || 'unknown');
          const reason = String(msg.reason || status);
          const detail = String(gdb.detail || gdb.lastError || '').trim();
          const signature = `${reason}:${status}:${detail}`;
          const lastSignature = rp2040GdbLastLogRef.current.get(resolvedBoardId);

          if (lastSignature !== signature) {
            const line = [
              `RP2040 GDB ${resolvedBoardId}`,
              `status=${status}`,
              `reason=${reason}`,
              detail,
            ].filter(Boolean).join(' | ');

            const level = (status === 'error' || status === 'closed') ? 'warn' : 'info';
            appendConsoleEntry(level, line, 'debug');
            rp2040GdbLastLogRef.current.set(resolvedBoardId, signature);
          }
          return;
        }
        if (msg.type === 'sync_heartbeat') {
          if (!rp2040DebugTelemetryEnabled) {
            return;
          }

          const boardId = String(msg.boardId || 'default').trim() || 'default';
          const frameId = Number(msg.frameId || 0);

          const renderPayload = {
            pins: renderPinsByBoardRef.current[boardId] || {},
            analog: renderAnalogByBoardRef.current[boardId] || [],
            components: renderComponentsByBoardRef.current[boardId] || {},
            neopixels: renderNeopixelsByBoardRef.current[boardId] || {},
          };

          const renderedHash = computeRenderSyncHash(renderPayload);
          workerRef.current?.postMessage({
            type: 'RENDER_REPORT',
            boardId,
            frameId,
            hash: renderedHash,
            renderedAt: Date.now(),
          });
          return;
        }
        if (msg.type === 'sync_fault') {
          const boardId = String(msg.boardId || 'default').trim() || 'default';
          appendConsoleEntry(
            'warn',
            `SYNC_FAULT ${boardId}: expected=${String(msg.expectedHash || '')} rendered=${String(msg.renderedHash || '')} mismatches=${Number(msg.mismatches || 0)}`,
            'simulator'
          );
          return;
        }
        if (msg.type === 'fault') {
          const boardId = String(msg.boardId || '');
          const pcHex = Number.isFinite(Number(msg.pc))
            ? `0x${Number(msg.pc).toString(16)}`
            : 'unknown';
          appendConsoleEntry(
            'error',
            `RP2040 runtime fault on ${msg.boardId || 'board'} at ${pcHex}: ${msg.reason || 'invalid execution state'}`,
            'simulator'
          );
          logSerial('Simulation stopped due to RP2040 runtime fault.', 'var(--red)');
          handleStop();
          return;
        }
        if (msg.type === 'state' && msg.pins) {
          const boardIdKey = String(msg.boardId || 'default');
          const prevPins = runLastBoardPinsRef.current.get(boardIdKey) || {};
          Object.keys(msg.pins).forEach((pinId) => {
            const prevValue = !!prevPins[pinId];
            const nextValue = !!msg.pins[pinId];
            if (prevValue !== nextValue) {
              const key = `${boardIdKey}:${pinId}`;
              runPinTransitionCountsRef.current[key] = (runPinTransitionCountsRef.current[key] || 0) + 1;
            }
          });
          runLastBoardPinsRef.current.set(boardIdKey, { ...msg.pins });
          renderPinsByBoardRef.current[boardIdKey] = { ...msg.pins };
          if (Object.prototype.hasOwnProperty.call(msg, 'analog')) {
            renderAnalogByBoardRef.current[boardIdKey] = Array.isArray(msg.analog) ? [...msg.analog] : msg.analog;
          }

          setPinStates(msg.pins);
          // Push to plotData history
          setPlotData(prev => {
            const serialVars = {};
            latestParsedSerialRef.current.forEach((val, idx) => {
              const lbl = serialPlotLabelsRef.current[idx] || `SVar${idx}`;
              serialVars[lbl] = val;
            });
            const newPt = { time: Date.now(), pins: msg.pins, analog: msg.analog || [], serialVars, boardId: msg.boardId || 'default' };
            const next = [...prev, newPt];
            if (next.length > 800) return next.slice(next.length - 800);
            return next;
          });
        }
        if (msg.type === 'state' && msg.neopixels) {
          const boardIdKey = String(msg.boardId || 'default');
          renderNeopixelsByBoardRef.current[boardIdKey] = msg.neopixels;
          setNeopixelData(msg.neopixels);
        }
        if (msg.type === 'state' && msg.components) {
          const boardIdKey = String(msg.boardId || 'default');
          const boardComponentState = {
            ...(renderComponentsByBoardRef.current[boardIdKey] || {}),
          };

          msg.components.forEach((c) => {
            const compId = String(c?.id || '').trim();
            if (!compId) return;
            runComponentUpdateCountsRef.current[compId] = (runComponentUpdateCountsRef.current[compId] || 0) + 1;
            boardComponentState[compId] = c.state;
          });

          renderComponentsByBoardRef.current[boardIdKey] = boardComponentState;

          setOopStates(prev => {
            const next = { ...prev };
            msg.components.forEach(c => {
              next[c.id] = c.state;
            });
            return next;
          });
        }
        if (msg.type === 'serial') {
          const incomingBoardId = String(msg.boardId || '').trim();
          const hasKnownBoard = incomingBoardId && boardComponents.some((b) => b.id === incomingBoardId);
          const singleBoardFallback = boardComponents.length === 1 ? boardComponents[0]?.id : '';
          const resolvedBoardId = hasKnownBoard
            ? incomingBoardId
            : (singleBoardFallback || incomingBoardId || 'default');
          pushSerialRxChunk(msg.data, resolvedBoardId, msg.source || 'sim');
        }
      };

      worker.onerror = (err) => {
        console.error('Worker Error:', err);
        appendConsoleEntry('error', `Worker error: ${err?.message || 'Unknown error'}`, 'simulator');
        logSerial('Worker threw an error', 'var(--red)');
        handleStop();
      };

      logSerial('Simulator started in Web Worker.');

      const neopixelWiring = components
        .filter(c => c.type === 'wokwi-neopixel-matrix')
        .map(c => {
          return null; // Handle Neopixels later
        }).filter(n => n);

      const customLogics = [];
      components.forEach((c) => {
        if (COMPONENT_REGISTRY[c.type]?.logicCode) {
          customLogics.push({
            type: c.type,
            code: COMPONENT_REGISTRY[c.type].logicCode,
            pins: COMPONENT_REGISTRY[c.type].manifest.pins
          });
        }
      });

      worker.postMessage({
        type: 'START',
        hex: result.hex,
        neopixels: neopixelWiring,
        wires: wires,
        components: components,
        customLogics: customLogics,
        boardHexMap: Object.keys(boardHexMap).length > 0 ? boardHexMap : undefined,
        boardPythonMap: Object.keys(boardPythonMap).length > 0 ? boardPythonMap : undefined,
        boardPythonFilesMap: Object.keys(boardPythonFilesMap).length > 0 ? boardPythonFilesMap : undefined,
        boardRuntimeEnvMap: Object.keys(boardRuntimeEnvMap).length > 0 ? boardRuntimeEnvMap : undefined,
        boardBaudMap: Object.keys(boardBaudMap).length > 0 ? boardBaudMap : undefined,
        baudRate: selectedRunBaud,
        debugRp2040: rp2040DebugTelemetryEnabled,
        debugSyncHeartbeat: rp2040DebugTelemetryEnabled,
      });

      runStartGuardRef.current = false;
    } catch (err) {
      runStartGuardRef.current = false;
      rp2040GdbLastLogRef.current.clear();
      rp2040WirelessLastLogRef.current.clear();
      rp2040UartMicroPythonBoardsRef.current.clear();
      rp2040UartSilentWarnedBoardsRef.current.clear();
      setIsRunning(false);
      setIsCompiling(false);
      setRunStartedAtMs(null);
      setRunDurationSec(0);
      appendConsoleEntry('error', `Run failed: ${err?.message || 'Unknown error'}`, 'simulator');
      console.error(err);
      alert(err.message);
    }
  };

  const handleStop = () => {
    const wasRunning = isRunning;
    runStartGuardRef.current = false;
    rp2040GdbLastLogRef.current.clear();
    rp2040WirelessLastLogRef.current.clear();
    rp2040UartMicroPythonBoardsRef.current.clear();
    rp2040UartSilentWarnedBoardsRef.current.clear();

    if (wasRunning) {
      const componentSummary = Object.entries(runComponentUpdateCountsRef.current)
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 10)
        .map(([id, count]) => `${id}:${count}`);
      const pinSummary = Object.entries(runPinTransitionCountsRef.current)
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 12)
        .map(([id, count]) => `${id}:${count}`);

      if (componentSummary.length > 0) {
        appendConsoleEntry('info', `Runtime verification (component updates): ${componentSummary.join(', ')}`, 'simulator');
      }
      if (pinSummary.length > 0) {
        appendConsoleEntry('info', `Runtime verification (pin transitions): ${pinSummary.join(', ')}`, 'simulator');
      }
      if (componentSummary.length === 0 && pinSummary.length === 0) {
        appendConsoleEntry('warn', 'Runtime verification: no component updates or pin transitions detected.', 'simulator');
      }
    }

    runComponentUpdateCountsRef.current = {};
    runPinTransitionCountsRef.current = {};
    runLastBoardPinsRef.current = new Map();
    renderPinsByBoardRef.current = {};
    renderAnalogByBoardRef.current = {};
    renderComponentsByBoardRef.current = {};
    renderNeopixelsByBoardRef.current = {};

    const neopixelOffStates = {};
    const neopixelOffPixels = {};
    components.forEach((comp) => {
      if (!/(neopixel|ws2812|ws2821)/i.test(String(comp?.type || ''))) return;

      const rows = Math.max(1, Number.parseInt(String(comp?.attrs?.rows ?? '8'), 10) || 1);
      const cols = Math.max(1, Number.parseInt(String(comp?.attrs?.cols ?? '8'), 10) || 1);
      const pixelCount = rows * cols;
      const attrsState = (comp?.attrs && typeof comp.attrs === 'object') ? comp.attrs : {};

      neopixelOffStates[comp.id] = {
        ...attrsState,
        rows: String(rows),
        cols: String(cols),
        pixels: new Array(pixelCount).fill(0),
      };

      const pixelTriples = [];
      for (let index = 0; index < pixelCount; index++) {
        pixelTriples.push([Math.floor(index / cols), index % cols, { r: 0, g: 0, b: 0 }]);
      }
      neopixelOffPixels[comp.id] = pixelTriples;
    });

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STOP' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsRunning(false);
    setIsCompiling(false);
    setIsPaused(false);
    setRunStartedAtMs(null);
    setRunDurationSec(0);
    setPinStates({});
    setNeopixelData(neopixelOffPixels);
    setOopStates(neopixelOffStates);
    setSerialHistory([]);
    setPlotData([]);
    setSerialPaused(false);
    setPlotterPaused(false);
    serialPlotBufferRef.current = '';
    serialPlotLabelsRef.current = [];
    latestParsedSerialRef.current = [];
    serialIngressArbitrationRef.current.clear();
    serialPausedQueueRef.current = [];
    appendConsoleEntry('info', 'Simulation stopped.', 'simulator');
  };

  useEffect(() => {
    if (!isRunning || !runStartedAtMs) return;

    const updateElapsed = () => {
      setRunDurationSec(Math.max(0, (Date.now() - runStartedAtMs) / 1000));
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 250);
    return () => clearInterval(timer);
  }, [isRunning, runStartedAtMs]);

  useEffect(() => {
    if (!hardwareStatus) return;
    if (lastHardwareStatusRef.current === hardwareStatus) return;
    lastHardwareStatusRef.current = hardwareStatus;

    const statusLower = String(hardwareStatus).toLowerCase();
    const level = statusLower.includes('failed') || statusLower.includes('lost') ? 'error' : 'info';
    appendConsoleEntry(level, hardwareStatus, 'hardware');
  }, [hardwareStatus, appendConsoleEntry]);

  const handlePause = () => {
    if (workerRef.current) workerRef.current.postMessage({ type: 'PAUSE' });
    setIsPaused(true);
  };

  const handleResume = () => {
    if (workerRef.current) workerRef.current.postMessage({ type: 'RESUME' });
    setIsPaused(false);
  };

  const handleReset = () => {
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: 'RESET' });
      const now = new Date();
      const ts = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
      setSerialHistory(prev => [...prev, { dir: 'sys', text: '--- BOARD RESET ---', ts }]);
    }
  };

  const sendSerialInput = useCallback((targetBoardOverride) => {
    const txt = String(serialInput || '');
    if (!txt.trim()) return;
    const lineEnding = SERIAL_LINE_ENDINGS[serialLineEnding] ?? '\n';
    const payload = txt + lineEnding;

    const requestedBoard = targetBoardOverride || serialBoardFilter;
    const targetBoardId = requestedBoard !== 'all' ? requestedBoard : undefined;

    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({
        type: 'SERIAL_INPUT',
        data: payload,
        targetBoardId,
        baudRate: serialBaudRate,
      });
      pushSerialTxLine(txt, targetBoardId || 'all', 'sim');
      setSerialInput('');
      return;
    }

    if (hardwareConnected) {
      const targetBoard = targetBoardId
        ? targetBoardId
        : (hardwareSerialTargetRef.current || hardwareBoardId || 'hardware');
      sendHardwareSerialLine(payload, targetBoard, txt)
        .then(() => setSerialInput(''))
        .catch((err) => {
          console.error('[WebSerial] TX failed:', err);
          alert(`Hardware serial write failed: ${err?.message || 'Unknown error'}`);
        });
      return;
    }

    alert('Run simulator or connect hardware serial before sending data.');
  }, [serialInput, serialLineEnding, workerRef, isRunning, serialBoardFilter, serialBaudRate, pushSerialTxLine, hardwareConnected, hardwareBoardId, sendHardwareSerialLine]);

  const openComponentEditor = useCallback(() => {
    try {
      navigate('/component-editor');
    } catch (_) {
      window.location.assign('/component-editor');
    }
  }, [navigate]);

  // ── PNG Export ────────────────────────────────────────────────────────────
  const downloadPng = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const canvasEl = canvasRef.current;
      const SCALE = 2;
      const PAD = 60; // padding around content in canvas-space pixels

      // 1. Calculate bounding box of all components + wire waypoints (in canvas-space coords)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      components.forEach(c => {
        const reg = COMPONENT_REGISTRY[c.type];
        const b = typeof reg?.BOUNDS === 'function'
          ? reg.BOUNDS(getComponentStateAttrs(c))
          : (reg?.BOUNDS || { x: 0, y: 0, w: c.w, h: c.h });
        // component body
        minX = Math.min(minX, c.x + b.x);
        minY = Math.min(minY, c.y + b.y);
        maxX = Math.max(maxX, c.x + b.x + b.w);
        maxY = Math.max(maxY, c.y + b.y + b.h);
        // label below component adds ~20px
        maxY = Math.max(maxY, c.y + b.y + b.h + 20);
        // pins (they're positioned relative to component and can extend beyond its box)
        (PIN_DEFS[c.type] || []).forEach(pin => {
          const pp = getPinPos(c.id, pin.id);
          if (pp) {
            minX = Math.min(minX, pp.x - 4);
            minY = Math.min(minY, pp.y - 4);
            maxX = Math.max(maxX, pp.x + 4);
            maxY = Math.max(maxY, pp.y + 4);
          }
        });
      });
      // wire waypoints
      wires.forEach(w => {
        (w.waypoints || []).forEach(wp => {
          minX = Math.min(minX, wp.x);
          minY = Math.min(minY, wp.y);
          maxX = Math.max(maxX, wp.x);
          maxY = Math.max(maxY, wp.y);
        });
        // wire endpoints (from/to pin positions)
        const [fComp, fPin] = (w.from || '').split(':');
        const [tComp, tPin] = (w.to || '').split(':');
        const fp = getPinPos(fComp, fPin);
        const tp = getPinPos(tComp, tPin);
        if (fp) { minX = Math.min(minX, fp.x); minY = Math.min(minY, fp.y); maxX = Math.max(maxX, fp.x); maxY = Math.max(maxY, fp.y); }
        if (tp) { minX = Math.min(minX, tp.x); minY = Math.min(minY, tp.y); maxX = Math.max(maxX, tp.x); maxY = Math.max(maxY, tp.y); }
      });
      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

      minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;

      // 2. Hide overlays and temporarily adjust canvas + zoom wrapper for full-content capture
      const overlays = canvasEl.querySelectorAll('[data-export-ignore="true"]');
      overlays.forEach(el => { el.style.visibility = 'hidden'; });
      // Find the zoom wrapper (first absolutely-positioned child)
      const zoomWrapper = canvasEl.querySelector(':scope > div');

      // Save original styles
      const origStyles = {
        canvasOverflow: canvasEl.style.overflow,
        canvasWidth: canvasEl.style.width,
        canvasHeight: canvasEl.style.height,
        canvasFlex: canvasEl.style.flex,
        canvasMinWidth: canvasEl.style.minWidth,
        canvasMinHeight: canvasEl.style.minHeight,
        canvasBackground: canvasEl.style.backgroundImage,
        zoomTransform: zoomWrapper.style.transform,
        zoomWidth: zoomWrapper.style.width,
        zoomHeight: zoomWrapper.style.height,
      };

      // Temporarily reset to fit all content at scale 1
      canvasEl.style.overflow = 'visible';
      canvasEl.style.width = bboxW + 'px';
      canvasEl.style.height = bboxH + 'px';
      canvasEl.style.flex = 'none';
      canvasEl.style.minWidth = bboxW + 'px';
      canvasEl.style.minHeight = bboxH + 'px';
      canvasEl.style.backgroundImage = 'none'; // hide grid dots from export
      zoomWrapper.style.transform = `translate(${-minX}px, ${-minY}px) scale(1)`;
      zoomWrapper.style.width = bboxW + 'px';
      zoomWrapper.style.height = bboxH + 'px';

      // Tag all open shadow-root elements (wokwi web components) so we can
      // inline their shadow DOM in the cloned document — html2canvas cannot
      // capture shadow DOM content on its own, causing the board image to be
      // blank while pin dots render at correct positions (apparent misalignment).
      const shadowHostEls = [];
      canvasEl.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) {
          el.dataset.h2cShadow = String(shadowHostEls.length);
          shadowHostEls.push(el);
        }
      });

      let circuitCanvas;
      try {
        const html2canvas = await getHtml2canvas();
        circuitCanvas = await html2canvas(canvasEl, {
          backgroundColor: '#070b14',
          scale: SCALE,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: bboxW,
          height: bboxH,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          onclone: (_clonedDoc, clonedEl) => {
            shadowHostEls.forEach((liveEl, idx) => {
              const cloned = clonedEl.querySelector(`[data-h2c-shadow="${idx}"]`);
              if (!cloned || !liveEl.shadowRoot) return;
              const wrapper = _clonedDoc.createElement('div');
              // Preserve inline styles (transform, size, etc.) from the original element
              Array.from(cloned.style).forEach(p =>
                wrapper.style.setProperty(p, cloned.style.getPropertyValue(p))
              );
              // Deep-copy shadow root children into the wrapper so html2canvas sees them
              liveEl.shadowRoot.childNodes.forEach(node =>
                wrapper.appendChild(_clonedDoc.importNode(node, true))
              );
              cloned.replaceWith(wrapper);
            });
          },
        });
      } finally {
        // Restore all original styles
        canvasEl.style.overflow = origStyles.canvasOverflow;
        canvasEl.style.width = origStyles.canvasWidth;
        canvasEl.style.height = origStyles.canvasHeight;
        canvasEl.style.flex = origStyles.canvasFlex;
        canvasEl.style.minWidth = origStyles.canvasMinWidth;
        canvasEl.style.minHeight = origStyles.canvasMinHeight;
        canvasEl.style.backgroundImage = origStyles.canvasBackground;
        zoomWrapper.style.transform = origStyles.zoomTransform;
        zoomWrapper.style.width = origStyles.zoomWidth;
        zoomWrapper.style.height = origStyles.zoomHeight;
        overlays.forEach(el => { el.style.visibility = ''; });
        // Remove temporary shadow-tracking attributes
        shadowHostEls.forEach(el => { delete el.dataset.h2cShadow; });
      }

      const CW = circuitCanvas.width;
      const CH = circuitCanvas.height;

      // 2. Output canvas — circuit only (no header bar)
      const out = document.createElement('canvas');
      out.width = CW;
      out.height = CH;
      const ctx = out.getContext('2d');

      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, CW, CH);
      ctx.drawImage(circuitCanvas, 0, 0);

      // Branding watermark (bottom-right)
      ctx.fillStyle = '#2a3a52';
      ctx.font = `${9 * SCALE}px "Space Grotesk", sans-serif`;
      ctx.fillText('Generated by OpenHW-Studio', CW - 240 * SCALE, CH - 8 * SCALE);

      // 3. Encode FULL metadata (no truncation) for machine-readable round-trip
      const fullMetadata = buildProjectPayload({
        board,
        components,
        wires,
        code,
        blocklyXml,
        blocklyGeneratedCode,
        useBlocklyCode,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
        exportedAt: new Date().toISOString(),
      });
      const MARKER = '\x00OPENHW_META\x00';
      const jsonPayload = MARKER + JSON.stringify(fullMetadata);

      // 4. Append metadata bytes after PNG IEND → still renders fine in all image viewers
      const dateStr = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-').replace(':', '-');
      const filename = `circuit_${board}_${dateStr}.png`;
      out.toBlob(async (blob) => {
        const pngBuf = await blob.arrayBuffer();
        const pngBytes = new Uint8Array(pngBuf);
        const metaBytes = new TextEncoder().encode(jsonPayload);
        const combined = new Uint8Array(pngBytes.length + metaBytes.length);
        combined.set(pngBytes);
        combined.set(metaBytes, pngBytes.length);
        const finalBlob = new Blob([combined], { type: 'image/png' });
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, 'image/png');
    } catch (err) {
      console.error('[PNG Export] Error:', err);
      alert('PNG export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // ── View Panel helpers — SVG Schematic Generator ─────────────────────────
  const generateSchematic = useCallback(() => {
    setSchematicLoading(true);
    setSchematicDataUrl(null);
    try {
      const SW = 1122, SH = 794;           // A4 landscape px
      const OM = 10, GL = 20, TH = 65;     // outer-margin, grid-label, title height
      const FX1 = OM + GL, FY1 = OM + GL;
      const FX2 = SW - OM - GL, FY2 = SH - OM - GL - TH;
      const FW = FX2 - FX1, FH = FY2 - FY1;

      // ── SVG micro helpers ───────────────────────────────────────────────
      const ln = (x1, y1, x2, y2, sw = 1.5, col = '#1a1a1a') =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}"/>`;
      const bx = (x, y, w, h, fill = 'white', sw = 1.5, rx = 0) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="#1a1a1a" stroke-width="${sw}"/>`;
      const tx = (x, y, t, sz = 9, anchor = 'middle', bold = false, fill = '#1a1a1a', font = 'monospace') =>
        `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${sz}" font-family="${font}" ${bold ? 'font-weight="bold"' : ''} fill="${fill}">${t}</text>`;
      const circ = (cx, cy, r, fill = 'white') =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#1a1a1a" stroke-width="1.5"/>`;

      // ── Symbol library ──────────────────────────────────────────────────
      const SYMS = {};

      // LED
      SYMS['wokwi-led'] = {
        w: 72, h: 44, refPrefix: 'D',
        pins: { A: { dx: 0, dy: 22 }, K: { dx: 72, dy: 22 } },
        draw(x, y, comp, ref) {
          const c = comp.attrs?.color || 'red';
          const fill = c === 'green' ? '#2a7a2a30' : c === 'blue' ? '#2a2a9a30' : c === 'yellow' ? '#8a7a0030' : '#c0202030';
          return [
            ln(x, y + 22, x + 16, y + 22),
            `<polygon points="${x + 16},${y + 6} ${x + 16},${y + 38} ${x + 48},${y + 22}" fill="${fill}" stroke="#1a1a1a" stroke-width="1.5"/>`,
            ln(x + 48, y + 6, x + 48, y + 38), ln(x + 48, y + 22, x + 72, y + 22),
            ln(x + 38, y + 6, x + 52, y - 5, 1), ln(x + 32, y + 6, x + 46, y - 5, 1),
            `<polygon points="${x + 50},${y - 7} ${x + 52},${y - 5} ${x + 48},${y - 4}" fill="#1a1a1a"/>`,
            `<polygon points="${x + 44},${y - 7} ${x + 46},${y - 5} ${x + 42},${y - 4}" fill="#1a1a1a"/>`,
            tx(x + 36, y + 54, ref, 9, 'middle', true),
            tx(x + 5, y + 18, '+', 7, 'middle', false, '#777'), tx(x + 64, y + 18, '−', 7, 'middle', false, '#777'),
          ].join('');
        }
      };

      // Resistor
      SYMS['wokwi-resistor'] = {
        w: 70, h: 32, refPrefix: 'R',
        pins: { p1: { dx: 0, dy: 16 }, p2: { dx: 70, dy: 16 } },
        draw(x, y, comp, ref) {
          const v = parseFloat(comp.attrs?.value || 220);
          const u = v >= 1e6 ? `${v / 1e6}M\u03A9` : v >= 1000 ? `${v / 1000}k\u03A9` : `${v}\u03A9`;
          return [ln(x, y + 16, x + 12, y + 16), bx(x + 12, y + 6, 46, 20), ln(x + 58, y + 16, x + 70, y + 16),
          tx(x + 35, y + 44, ref, 9, 'middle', true), tx(x + 35, y + 53, u, 8, 'middle', false, '#555')].join('');
        }
      };

      // Push button
      SYMS['wokwi-pushbutton'] = {
        w: 62, h: 48, refPrefix: 'S',
        pins: { '1': { dx: 0, dy: 28 }, '2': { dx: 62, dy: 28 } },
        draw(x, y, comp, ref) {
          return [
            ln(x, y + 28, x + 16, y + 28), ln(x + 16, y + 14, x + 16, y + 42),
            ln(x + 40, y + 14, x + 40, y + 42), ln(x + 16, y + 14, x + 46, y + 9),
            ln(x + 40, y + 28, x + 62, y + 28),
            ln(x + 28, y + 9, x + 28, y + 2), ln(x + 23, y + 2, x + 33, y + 2, 1.5),
            tx(x + 31, y + 60, ref, 9, 'middle', true),
          ].join('');
        }
      };

      // Buzzer
      SYMS['wokwi-buzzer'] = {
        w: 52, h: 48, refPrefix: 'BZ',
        pins: { '1': { dx: 0, dy: 24 }, '2': { dx: 52, dy: 24 } },
        draw(x, y, comp, ref) {
          return [
            ln(x, y + 24, x + 10, y + 24), bx(x + 10, y + 10, 32, 28),
            `<path d="M${x + 21},${y + 16} Q${x + 26},${y + 11} ${x + 31},${y + 16}" fill="none" stroke="#1a1a1a" stroke-width="1"/>`,
            `<path d="M${x + 17},${y + 13} Q${x + 26},${y + 5} ${x + 35},${y + 13}" fill="none" stroke="#1a1a1a" stroke-width="1"/>`,
            ln(x + 26, y + 24, x + 26, y + 30, 1.5), ln(x + 42, y + 24, x + 52, y + 24),
            tx(x + 6, y + 22, '+', 7, 'middle', false, '#777'),
            tx(x + 26, y + 60, ref, 9, 'middle', true),
          ].join('');
        }
      };

      // Power supply
      SYMS['wokwi-power-supply'] = {
        w: 52, h: 70, refPrefix: 'PS',
        pins: { '5V': { dx: 26, dy: 0 }, 'GND': { dx: 26, dy: 70 } },
        draw(x, y, comp, ref) {
          const v = comp.attrs?.voltage || '5V';
          return [
            ln(x + 26, y, x + 26, y + 16), ln(x + 14, y + 16, x + 38, y + 16, 2),
            ln(x + 26, y + 50, x + 26, y + 70),
            ln(x + 14, y + 50, x + 38, y + 50), ln(x + 18, y + 56, x + 34, y + 56), ln(x + 22, y + 62, x + 30, y + 62),
            tx(x + 26, y - 4, `+${v}`, 9), tx(x + 26, y + 32, ref, 8, 'middle', false, '#555'),
          ].join('');
        }
      };

      // Potentiometer
      SYMS['wokwi-potentiometer'] = {
        w: 80, h: 72, refPrefix: 'RV',
        pins: { '1': { dx: 0, dy: 36 }, '2': { dx: 80, dy: 36 }, 'SIG': { dx: 40, dy: 72 } },
        draw(x, y, comp, ref) {
          const v = parseFloat(comp.attrs?.value || 50000);
          const u = v >= 1e6 ? `${v / 1e6}M\u03A9` : v >= 1000 ? `${v / 1000}k\u03A9` : `${v}\u03A9`;
          return [
            ln(x, y + 36, x + 12, y + 36), bx(x + 12, y + 26, 56, 20), ln(x + 68, y + 36, x + 80, y + 36),
            ln(x + 40, y + 46, x + 40, y + 60),
            `<polygon points="${x + 34},${y + 46} ${x + 46},${y + 46} ${x + 40},${y + 36}" fill="#1a1a1a"/>`,
            ln(x + 40, y + 60, x + 40, y + 72),
            tx(x + 40, y + 22, u, 7), tx(x + 40, y + 84, ref, 9, 'middle', true),
          ].join('');
        }
      };

      // Servo
      SYMS['wokwi-servo'] = {
        w: 90, h: 56, refPrefix: 'SV',
        pins: { 'GND': { dx: 18, dy: 56 }, 'V+': { dx: 45, dy: 56 }, 'PWM': { dx: 72, dy: 56 } },
        draw(x, y, comp, ref) {
          return [
            bx(x + 5, y + 5, 80, 36, undefined, 1.5, 3), tx(x + 45, y + 28, 'SERVO', 10, 'middle', true, '#1a1a1a', 'sans-serif'),
            ln(x + 18, y + 41, x + 18, y + 56), ln(x + 45, y + 41, x + 45, y + 56), ln(x + 72, y + 41, x + 72, y + 56),
            tx(x + 18, y + 66, 'GND', 7), tx(x + 45, y + 66, 'V+', 7), tx(x + 72, y + 66, 'PWM', 7),
            tx(x + 45, y + 76, ref, 9, 'middle', true),
          ].join('');
        }
      };

      // DC Motor
      SYMS['wokwi-motor'] = {
        w: 60, h: 52, refPrefix: 'M',
        pins: { '1': { dx: 0, dy: 26 }, '2': { dx: 60, dy: 26 } },
        draw(x, y, comp, ref) {
          return [ln(x, y + 26, x + 8, y + 26), circ(x + 30, y + 26, 18), tx(x + 30, y + 30, 'M', 14, 'middle', true, '#1a1a1a', 'sans-serif'),
          ln(x + 52, y + 26, x + 60, y + 26), tx(x + 30, y + 56, ref, 9, 'middle', true)].join('');
        }
      };

      // NeoPixel
      SYMS['wokwi-neopixel-matrix'] = {
        w: 80, h: 62, refPrefix: 'NP',
        pins: { 'DIN': { dx: 0, dy: 31 }, 'VCC': { dx: 40, dy: 0 }, 'GND': { dx: 40, dy: 62 } },
        draw(x, y, comp, ref) {
          return [
            bx(x + 10, y + 10, 60, 42, '#111'), ln(x, y + 31, x + 10, y + 31),
            ln(x + 40, y, x + 40, y + 10), ln(x + 40, y + 52, x + 40, y + 62),
            `<circle cx="${x + 30}" cy="${y + 26}" r="5" fill="#f00" opacity="0.9"/>`,
            `<circle cx="${x + 40}" cy="${y + 26}" r="5" fill="#0f0" opacity="0.9"/>`,
            `<circle cx="${x + 50}" cy="${y + 26}" r="5" fill="#00f" opacity="0.9"/>`,
            `<circle cx="${x + 35}" cy="${y + 38}" r="5" fill="#ff0" opacity="0.9"/>`,
            `<circle cx="${x + 45}" cy="${y + 38}" r="5" fill="#0ff" opacity="0.9"/>`,
            tx(x + 40, y + 76, ref, 9, 'middle', true),
          ].join('');
        }
      };

      // 74HC595 Shift Register
      SYMS['shift_register'] = {
        w: 120, h: 210, refPrefix: 'IC',
        pins: {
          vcc: { dx: 60, dy: 0 }, gnd: { dx: 60, dy: 210 },
          ser: { dx: 0, dy: 40 }, srclk: { dx: 0, dy: 58 }, rclk: { dx: 0, dy: 76 }, oe: { dx: 0, dy: 94 }, srclr: { dx: 0, dy: 112 },
          q0: { dx: 120, dy: 40 }, q1: { dx: 120, dy: 58 }, q2: { dx: 120, dy: 76 }, q3: { dx: 120, dy: 94 },
          q4: { dx: 120, dy: 112 }, q5: { dx: 120, dy: 130 }, q6: { dx: 120, dy: 148 }, q7: { dx: 120, dy: 166 }, q7s: { dx: 120, dy: 184 },
        },
        draw(x, y, comp, ref) {
          const LP = [['SER', 40], ['SRCLK', 58], ['RCLK', 76], ['~OE', 94], ['~SRCLR', 112]];
          const RP = [['Q0', 40], ['Q1', 58], ['Q2', 76], ['Q3', 94], ['Q4', 112], ['Q5', 130], ['Q6', 148], ['Q7', 166], ["Q7'", 184]];
          return [
            bx(x + 15, y + 12, 90, 186), tx(x + 60, y + 28, '74HC595', 9, 'middle', true), tx(x + 60, y + 10, ref, 7, 'middle', false, '#555'),
            ln(x + 60, y, x + 60, y + 12), tx(x + 60, y - 2, 'VCC', 7),
            ln(x + 60, y + 198, x + 60, y + 210), tx(x + 60, y + 220, 'GND', 7),
            ...LP.map(([l, dy]) => ln(x, y + dy, x + 15, y + dy) + `<text x="${x + 18}" y="${y + dy + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`),
            ...RP.map(([l, dy]) => ln(x + 105, y + dy, x + 120, y + dy) + `<text x="${x + 102}" y="${y + dy + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`),
          ].join('');
        }
      };

      // L298N Motor Driver
      SYMS['wokwi-motor-driver'] = {
        w: 130, h: 170, refPrefix: 'MD',
        pins: {
          ENA: { dx: 0, dy: 30 }, IN1: { dx: 0, dy: 50 }, IN2: { dx: 0, dy: 70 }, IN3: { dx: 0, dy: 90 }, IN4: { dx: 0, dy: 110 }, ENB: { dx: 0, dy: 130 },
          OUT1: { dx: 130, dy: 30 }, OUT2: { dx: 130, dy: 50 }, OUT3: { dx: 130, dy: 90 }, OUT4: { dx: 130, dy: 110 },
          '12V': { dx: 30, dy: 0 }, 'GND': { dx: 65, dy: 0 }, '5V': { dx: 100, dy: 0 },
        },
        draw(x, y, comp, ref) {
          const LP = [['ENA', 30], ['IN1', 50], ['IN2', 70], ['IN3', 90], ['IN4', 110], ['ENB', 130]];
          const RP = [['OUT1', 30], ['OUT2', 50], ['OUT3', 90], ['OUT4', 110]];
          const TP = [['12V', 30], ['GND', 65], ['5V', 100]];
          return [
            bx(x + 15, y + 12, 100, 148), tx(x + 65, y + 34, 'L298N', 10, 'middle', true, '#1a1a1a', 'sans-serif'), tx(x + 65, y + 10, ref, 7, 'middle', false, '#555'),
            ...LP.map(([l, dy]) => ln(x, y + dy, x + 15, y + dy) + `<text x="${x + 18}" y="${y + dy + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`),
            ...RP.map(([l, dy]) => ln(x + 115, y + dy, x + 130, y + dy) + `<text x="${x + 112}" y="${y + dy + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`),
            ...TP.map(([l, dx]) => ln(x + dx, y, x + dx, y + 12) + `<text x="${x + dx}" y="${y - 2}" text-anchor="middle" font-size="6.5" font-family="monospace" fill="#1a1a1a">${l}</text>`),
          ].join('');
        }
      };

      // Arduino Uno ─────────────────────────────────────────────────────────
      const UL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
      const UR = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'vin', 'gnd_1', 'gnd_2', 'gnd_3', '5V', '3v3', 'rst', 'ioref'];
      const ULL = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5~', 'D6~', 'D7', 'D8', 'D9~', 'D10~', 'D11~', 'D12', 'D13'];
      const URL2 = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'VIN', 'GND', 'GND', 'GND', '5V', '3.3V', 'RST', 'IOREF'];
      const UPS = 18, UW = 148, UH = UL.length * UPS + 46;
      const unoPins = {};
      UL.forEach((id, i) => { unoPins[id] = { dx: 0, dy: 34 + i * UPS }; });
      UR.forEach((id, i) => { unoPins[id] = { dx: UW, dy: 34 + i * UPS }; });
      SYMS['wokwi-arduino-uno'] = {
        w: UW, h: UH, refPrefix: 'U', pins: unoPins,
        draw(x, y, comp, ref) {
          return [
            bx(x + 16, y + 14, UW - 32, UH - 28),
            tx(x + UW / 2, y + 30, 'Arduino Uno', 10, 'middle', true),
            tx(x + UW / 2, y + 10, ref, 8, 'middle', false, '#555'),
            tx(x + UW / 2, y + 44, 'ATmega328P', 7, 'middle', false, '#777'),
            ...UL.map((id, i) => { const py = y + 34 + i * UPS; return ln(x, py, x + 16, py) + `<text x="${x + 19}" y="${py + 3}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${ULL[i]}</text>`; }),
            ...UR.map((id, i) => { const py = y + 34 + i * UPS; return ln(x + UW - 16, py, x + UW, py) + `<text x="${x + UW - 19}" y="${py + 3}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${URL2[i]}</text>`; }),
          ].join('');
        }
      };

      // Generic fallback IC ─────────────────────────────────────────────────
      const makeGenericSym = (comp) => {
        const used = new Set();
        wires.forEach(w => {
          const [ci, pi] = w.from.split(':'); if (ci === comp.id && pi) used.add(pi);
          const [ci2, pi2] = w.to.split(':'); if (ci2 === comp.id && pi2) used.add(pi2);
        });
        const pl = [...used]; const half = Math.ceil(pl.length / 2);
        const lp = pl.slice(0, half), rp = pl.slice(half);
        const rows = Math.max(lp.length, rp.length, 2), gh = rows * 20 + 44, gw = 100;
        const pins = {};
        lp.forEach((id, i) => { pins[id] = { dx: 0, dy: 32 + i * 20 }; });
        rp.forEach((id, i) => { pins[id] = { dx: gw + 30, dy: 32 + i * 20 }; });
        return {
          w: gw + 30, h: gh, refPrefix: 'IC', pins,
          draw(x, y, _c, ref) {
            const sType = _c.type.replace('wokwi-', '');
            return [
              bx(x + 15, y + 12, gw, gh - 24), tx(x + 15 + gw / 2, y + 28, sType, 8, 'middle', true), tx(x + 15 + gw / 2, y + 10, ref, 7, 'middle', false, '#555'),
              ...lp.map((id, i) => ln(x, y + 32 + i * 20, x + 15, y + 32 + i * 20) + `<text x="${x + 18}" y="${y + 36 + i * 20}" font-size="6.5" font-family="monospace" fill="#1a1a1a">${id}</text>`),
              ...rp.map((id, i) => ln(x + gw + 15, y + 32 + i * 20, x + gw + 30, y + 32 + i * 20) + `<text x="${x + gw + 12}" y="${y + 36 + i * 20}" text-anchor="end" font-size="6.5" font-family="monospace" fill="#1a1a1a">${id}</text>`),
            ].join('');
          }
        };
      };

      // ── Layout ────────────────────────────────────────────────────────────
      if (components.length === 0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" fill="white"/><text x="${SW / 2}" y="${SH / 2}" text-anchor="middle" font-size="18" fill="#aaa" font-family="sans-serif">No components on canvas</text></svg>`;
        schematicSvgRef.current = svg;
        setSchematicDataUrl(`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`);
        return;
      }

      // Assign reference designators (sorted left-to-right by canvas x)
      const sorted = [...components].sort((a, b) => a.x - b.x);
      const refCounts = {}, compSymMap = {}, compRefMap = {};
      sorted.forEach(c => {
        let sym = SYMS[c.type]; if (!sym) sym = makeGenericSym(c);
        compSymMap[c.id] = sym;
        const pre = sym.refPrefix; refCounts[pre] = (refCounts[pre] || 0) + 1;
        compRefMap[c.id] = `${pre}${refCounts[pre]}`;
      });

      // Bounding box (canvas component centers)
      let mnX = 1e9, mnY = 1e9, mxX = -1e9, mxY = -1e9;
      components.forEach(c => {
        const cx = c.x + (c.w || 60) / 2, cy = c.y + (c.h || 60) / 2;
        mnX = Math.min(mnX, cx); mnY = Math.min(mnY, cy); mxX = Math.max(mxX, cx); mxY = Math.max(mxY, cy);
      });

      const PAD = 70;
      const availW = FW - PAD * 2, availH = FH - PAD * 2;
      const srcW = Math.max(mxX - mnX, 1), srcH = Math.max(mxY - mnY, 1);
      const sc = Math.min(availW / srcW, availH / srcH, 1.8);

      const toSch = (cx, cy) => ({ x: FX1 + PAD + (cx - mnX) * sc, y: FY1 + PAD + (cy - mnY) * sc });

      // Symbol top-left positions
      const cPos = {};
      components.forEach(c => {
        const sym = compSymMap[c.id];
        const cx = c.x + (c.w || 60) / 2, cy = c.y + (c.h || 60) / 2;
        const s = toSch(cx, cy);
        cPos[c.id] = { x: s.x - sym.w / 2, y: s.y - sym.h / 2 };
      });

      // Pin world position helper
      const pinXY = (compId, pinId) => {
        const c = components.find(cc => cc.id === compId); if (!c) return null;
        const sym = compSymMap[c.id]; if (!sym) return null;
        const pos = cPos[c.id]; const pin = sym.pins[pinId];
        if (!pin) return { x: pos.x + sym.w, y: pos.y + sym.h / 2 };
        return { x: pos.x + pin.dx, y: pos.y + pin.dy };
      };

      // ── Components SVG ────────────────────────────────────────────────────
      const compsSVG = components.map(c => {
        const sym = compSymMap[c.id]; const pos = cPos[c.id]; const ref = compRefMap[c.id];
        return `<g class="comp" id="${c.id}">${sym.draw(pos.x, pos.y, c, ref)}</g>`;
      }).join('\n');

      // ── Wires SVG ─────────────────────────────────────────────────────────
      const wiresSVG = wires.map(w => {
        const [fC, fP] = w.from.split(':'), [tC, tP] = w.to.split(':');
        const p1 = pinXY(fC, fP), p2 = pinXY(tC, tP); if (!p1 || !p2) return '';
        // Route: horizontal from p1 half-way, then vertical, then horizontal to p2
        const midX = (p1.x + p2.x) / 2;
        const d = `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} L${midX.toFixed(1)},${p1.y.toFixed(1)} L${midX.toFixed(1)},${p2.y.toFixed(1)} L${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
        // Junction dot at middle junction if same Y (direct horizontal)
        const dot = (Math.abs(p1.y - p2.y) < 1) ? '' : `<circle cx="${midX.toFixed(1)}" cy="${p1.y.toFixed(1)}" r="2.5" fill="#1a1a1a"/>`;
        return `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${dot}`;
      }).filter(Boolean).join('\n');

      // ── Border + grid coordinates ─────────────────────────────────────────
      const GCOLS = 6, GROWS = 4, GRL = ['A', 'B', 'C', 'D'];
      const cStep = FW / GCOLS, rStep = FH / GROWS;
      let borderSVG = `
        <rect x="${OM}" y="${OM}" width="${SW - OM * 2}" height="${SH - OM * 2}" fill="none" stroke="#cc0000" stroke-width="1.2"/>
        <rect x="${FX1}" y="${FY1}" width="${FW}" height="${FH}" fill="none" stroke="#cc0000" stroke-width="2"/>
      `;
      for (let c = 1; c < GCOLS; c++) {
        const gx = FX1 + c * cStep;
        borderSVG += `${ln(gx, FY1, gx, FY1 - 3, 0.5, '#777')}${ln(gx, FY2, gx, FY2 + 3, 0.5, '#777')}`;
      }
      for (let r = 1; r < GROWS; r++) {
        const gy = FY1 + r * rStep;
        borderSVG += `${ln(FX1, gy, FX1 - 3, gy, 0.5, '#777')}${ln(FX2, gy, FX2 + 3, gy, 0.5, '#777')}`;
      }
      for (let c = 0; c < GCOLS; c++) {
        const cx = FX1 + c * cStep + cStep / 2;
        borderSVG += tx(cx, FY1 - 5, c + 1, 8, 'middle', false, '#444', 'sans-serif');
        borderSVG += tx(cx, FY2 + 14, c + 1, 8, 'middle', false, '#444', 'sans-serif');
      }
      for (let r = 0; r < GROWS; r++) {
        const ry = FY1 + r * rStep + rStep / 2 + 4;
        borderSVG += tx(FX1 - 5, ry, GRL[r], 8, 'end', false, '#444', 'sans-serif');
        borderSVG += tx(FX2 + 5, ry, GRL[r], 8, 'start', false, '#444', 'sans-serif');
      }

      // ── Title block ───────────────────────────────────────────────────────
      const TBY = FY2, TBH2 = SH - OM - GL - FY2, divW = FW / 3;
      const boardLabel = board === 'arduino_uno' ? 'Arduino Uno' : board === 'pico' ? 'Raspberry Pi Pico' : 'ESP32';
      const dateStr = new Date().toISOString().slice(0, 10);
      borderSVG += `
        <rect x="${FX1}" y="${TBY}" width="${FW}" height="${TBH2}" fill="white" stroke="#cc0000" stroke-width="1"/>
        <line x1="${FX1 + divW}" y1="${TBY}" x2="${FX1 + divW}" y2="${TBY + TBH2}" stroke="#bbb" stroke-width="0.5"/>
        <line x1="${FX1 + divW * 2}" y1="${TBY}" x2="${FX1 + divW * 2}" y2="${TBY + TBH2}" stroke="#bbb" stroke-width="0.5"/>
        <text x="${FX1 + 10}" y="${TBY + TBH2 / 2 + 4}" font-size="9" font-family="sans-serif" fill="#666">Made with OpenHW Studio</text>
        <text x="${FX1 + divW * 1.5}" y="${TBY + TBH2 / 2 - 4}" text-anchor="middle" font-size="10" font-weight="bold" font-family="sans-serif" fill="#1a1a1a">Board: ${boardLabel}</text>
        <text x="${FX1 + divW * 1.5}" y="${TBY + TBH2 / 2 + 10}" text-anchor="middle" font-size="8" font-family="sans-serif" fill="#555">${components.length} components · ${wires.length} wires</text>
        <text x="${FX1 + divW * 2.5}" y="${TBY + TBH2 / 2 + 4}" text-anchor="middle" font-size="9" font-family="sans-serif" fill="#444">${dateStr}</text>
        <text x="${FX1 + divW}" y="${TBY + 8}" font-size="6" font-family="sans-serif" fill="#aaa">TITLE</text>
        <text x="${FX1 + divW * 2}" y="${TBY + 8}" font-size="6" font-family="sans-serif" fill="#aaa">DATE</text>
      `;

      // ── Assemble SVG ───────────────────────────────────────────────────────
      const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="white"/>
  ${borderSVG}
  <g id="wires" stroke-linecap="round" stroke-linejoin="round">${wiresSVG}</g>
  <g id="components">${compsSVG}</g>
</svg>`;

      schematicSvgRef.current = svgStr;
      const b64 = btoa(unescape(encodeURIComponent(svgStr)));
      setSchematicDataUrl(`data:image/svg+xml;base64,${b64}`);
    } catch (err) {
      console.error('[Schematic]', err);
    } finally {
      setSchematicLoading(false);
    }
  }, [components, wires, board]);

  const downloadSchematicPng = useCallback(() => {
    const svgStr = schematicSvgRef.current;
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2244; canvas.height = 1588; // 2x high-res
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png', 0.95);
      a.download = 'schematic.png'; a.click();
    };
    img.onerror = () => {
      // Fallback: download SVG
      const a = document.createElement('a'); a.href = url; a.download = 'schematic.svg'; a.click();
    };
    img.src = url;
  }, []);

  const downloadSchematicPdf = useCallback(() => {
    const svgStr = schematicSvgRef.current;
    if (!svgStr) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(
      `<html><head><title>Schematic</title>` +
      `<style>@page{margin:0;size:A4 landscape}body{margin:0;padding:0}svg{width:100%;height:auto;display:block}</style></head>` +
      `<body>${svgStr}<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};}<\/script></body></html>`
    );
    win.document.close();
  }, []);

  const downloadCompCsv = () => {
    const counts = {};
    components.forEach(c => {
      if (!counts[c.type]) counts[c.type] = { type: c.type, label: c.label, count: 0 };
      counts[c.type].count++;
    });
    const rows = Object.values(counts);
    let csv = '#,Component,Type,Quantity\n';
    rows.forEach((row, i) => {
      csv += `${i + 1},"${row.label}","${row.type}",${row.count}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'components.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  // ── PNG Import ────────────────────────────────────────────────────────────
  const importFileRef = useRef(null);

  const applyImportedProjectMeta = (meta, sourceLabel = 'Import') => {
    const importedComponents = Array.isArray(meta?.components) ? meta.components : [];
    const importedConnections = Array.isArray(meta?.connections)
      ? meta.connections
      : (Array.isArray(meta?.wires) ? meta.wires : []);
    const { components: normalizedComponents, wires: normalizedConnections } = normalizeImportedCircuitData(importedComponents, importedConnections);

    const hasExisting = components.length > 0 || wires.length > 0;
    if (hasExisting && !window.confirm(`Import will replace your current circuit (${components.length} components, ${wires.length} wires). Continue?`)) {
      return;
    }

    saveHistory();
    if (meta?.board) setBoard(meta.board);
    if (Object.prototype.hasOwnProperty.call(meta || {}, 'code')) setCode(String(meta.code || ''));
    if (Object.prototype.hasOwnProperty.call(meta || {}, 'blocklyXml')) setBlocklyXml(String(meta.blocklyXml || ''));
    if (Object.prototype.hasOwnProperty.call(meta || {}, 'blocklyGeneratedCode')) setBlocklyGeneratedCode(String(meta.blocklyGeneratedCode || ''));
    if (Object.prototype.hasOwnProperty.call(meta || {}, 'useBlocklyCode')) setUseBlocklyCode(!!meta.useBlocklyCode);

    setComponents(normalizedComponents);
    setWires(normalizedConnections);

    const importedBoards = normalizedComponents.filter((c) => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type));
    let normalizedFiles = normalizeProjectFiles(Array.isArray(meta?.projectFiles) ? meta.projectFiles : []);

    // Backward compatibility: older exports stored only top-level `code`.
    if (normalizedFiles.length === 0 && typeof meta?.code === 'string' && meta.code.trim()) {
      if (importedBoards.length > 0) {
        normalizedFiles = importedBoards.map((bc, idx) => {
          const boardKind = normalizeBoardKind(bc.type);
          const rp2040Mode = boardKind === 'rp2040'
            ? normalizeRp2040Env(resolveComponentAttrString(bc?.attrs, 'env', 'native'))
            : 'native';
          const fileName = getDefaultMainFileName(boardKind, bc.id, { rp2040Mode });
          const path = `project/${bc.id}/${fileName}`;
          return {
            id: path,
            path,
            name: fileName,
            kind: 'code',
            boardId: bc.id,
            boardKind,
            content: idx === 0 ? meta.code : createDefaultMainCode(boardKind, bc.id, { rp2040Mode }),
            dirty: false,
          };
        });
      }
    }

    if (normalizedFiles.length > 0 && typeof meta?.code === 'string' && meta.code.trim()) {
      const codeFileIdx = normalizedFiles.findIndex((f) => f.kind === 'code' || /\.(ino|h|hpp|c|cpp|py)$/i.test(f.name || f.path || ''));
      const hasCodeContent = normalizedFiles.some((f) => {
        if (!(f.kind === 'code' || /\.(ino|h|hpp|c|cpp|py)$/i.test(f.name || f.path || ''))) return false;
        return String(f.content || '').trim().length > 0;
      });
      if (!hasCodeContent && codeFileIdx >= 0) {
        const target = normalizedFiles[codeFileIdx];
        normalizedFiles[codeFileIdx] = { ...target, content: meta.code };
      }
    }

    normalizedFiles = normalizeProjectFiles(normalizedFiles);
    const normalizedTabs = normalizeOpenCodeTabs(Array.isArray(meta?.openCodeTabs) ? meta.openCodeTabs : [], normalizedFiles);
    const preferredActive = typeof meta?.activeCodeFileId === 'string' ? meta.activeCodeFileId.trim() : '';
    const activeId = normalizedFiles.some((f) => f.id === preferredActive)
      ? preferredActive
      : (normalizedTabs[0] || normalizedFiles[0]?.id || '');

    setProjectFiles(normalizedFiles);
    setOpenCodeTabs(normalizedTabs);
    setActiveCodeFileId(activeId);

    syncNextIds(normalizedComponents, normalizedConnections);
    setSelected(null);
    setWireStart(null);
    lastCompiledRef.current = null;
    appendConsoleEntry('info', `${sourceLabel} imported: ${normalizedComponents.length} components, ${normalizedConnections.length} connections.`, 'simulator');
  };

  const importPng = (file) => {
    if (!file) return;
    if (isRunning || isCompiling) {
      alert('Stop the current simulation before importing a project file.');
      if (importFileRef.current) importFileRef.current.value = '';
      return;
    }

    const fileName = String(file.name || '').toLowerCase();
    const isPng = fileName.endsWith('.png');
    const isJson = fileName.endsWith('.json');

    if (!isPng && !isJson) {
      alert('Please select an OpenHW-Studio PNG or JSON file.');
      if (importFileRef.current) importFileRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (isPng) {
          const bytes = new Uint8Array(e.target.result);
          const marker = '\x00OPENHW_META\x00';
          const markerBytes = new TextEncoder().encode(marker);

          // Search payload marker from the end so very large metadata remains importable.
          let markerByteIdx = -1;
          for (let i = bytes.length - markerBytes.length; i >= 0; i--) {
            let ok = true;
            for (let j = 0; j < markerBytes.length; j++) {
              if (bytes[i + j] !== markerBytes[j]) {
                ok = false;
                break;
              }
            }
            if (ok) {
              markerByteIdx = i;
              break;
            }
          }

          if (markerByteIdx === -1) {
            alert('This PNG does not contain OpenHW-Studio circuit data.\nOnly PNGs exported from this simulator can be imported.');
            return;
          }

          const payloadBytes = bytes.slice(markerByteIdx + markerBytes.length);
          const jsonStr = new TextDecoder('utf-8', { fatal: false }).decode(payloadBytes);
          const meta = JSON.parse(jsonStr);
          applyImportedProjectMeta(meta, 'PNG project');
          return;
        }

        const jsonText = String(e.target.result || '');
        const meta = JSON.parse(jsonText);
        applyImportedProjectMeta(meta, 'JSON project');
      } catch (err) {
        const sourceLabel = isPng ? 'PNG' : 'JSON';
        console.error(`[${sourceLabel} Import] Parse error:`, err);
        alert(`Failed to parse circuit data from ${sourceLabel}: ${err.message}`);
      } finally {
        // Reset the file input so the same file can be re-imported.
        if (importFileRef.current) importFileRef.current.value = '';
      }
    };

    if (isPng) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const getComponentStateAttrs = (comp) => {
    let attrs = { ...comp.attrs };

    if (normalizeBoardKind(comp.type) === 'rp2040') {
      attrs.env = mapRp2040EnvForLegacyContextMenu(resolveComponentAttrString(attrs, 'env', 'native'));
    }

    // Remote OOP state takes priority
    const remoteState = oopStates[comp.id];

    if (comp.type === 'wokwi-led') {
      delete attrs.value; // Let ui.tsx handle it
    } else if (comp.type === 'wokwi-servo') {
      if (remoteState && remoteState.angle !== undefined) {
        attrs.angle = remoteState.angle.toString();
      }
    } else if (comp.type === 'wokwi-stepper-motor') {
      if (remoteState && remoteState.angle !== undefined) {
        attrs.angle = remoteState.angle.toString();
      }
    } else if (comp.type === 'wokwi-buzzer') {
      if (remoteState && remoteState.isBuzzing) {
        // Wokwi buzzer visual indicator (if supported) can be driven here
        attrs.color = "red";
      }
    }

    // Pass interactions to the Web Worker
    attrs.onInteract = (event) => {
      console.log(`[SimulatorPage] UI Component ${comp.id} interacted: ${event}. isRunning: ${isRunning}`);

      // Handle physical board reset button presses
      if (isProgrammableBoardType(comp.type) && event === 'RESET') {
        if (isRunning) handleReset();
        return;
      }

      if (workerRef.current && isRunning) {
        workerRef.current.postMessage({
          type: 'INTERACT',
          compId: comp.id,
          event: event
        });
      }
    };

    return attrs;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg)] font-sans text-[var(--text)] min-h-screen" ref={pageRef} >

      {/* ADMIN PREVIEW BANNER — shown when opened via "Test in Simulator" from admin dashboard */}
      {previewBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(90deg, #92400e, #b45309)',
          color: '#fff', padding: '10px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'monospace', fontSize: 13, boxShadow: '0 2px 12px rgba(0,0,0,0.4)'
        }}>
          <span>
            🧪 <strong>Admin Preview Mode</strong> &nbsp;—&nbsp;
            Component <strong style={{ color: '#fde68a' }}>{previewBanner.label}</strong>
            &nbsp;(<code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 3 }}>{previewBanner.id}</code>)
            &nbsp;is injected in <strong>browser memory only</strong>. It is NOT approved or installed on the backend.
          </span>
          <button
            onClick={() => setPreviewBanner(null)}
            style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}
          >✕ Dismiss</button>
        </div>
      )}

      {/* TOP BAR */}
      <TopToolbox board={board} setBoard={setBoard} isRunning={isRunning} isPaused={isPaused} handleRun={handleRun} handlePause={handlePause} handleResume={handleResume} handleStop={handleStop} isCompiling={isCompiling} assessmentMode={assessmentMode} assessmentProjectName={assessmentProjectName} isSubmittingAssessment={isSubmittingAssessment} handleAssessmentSubmit={handleAssessmentSubmit} undo={undo} redo={redo} selected={selected} rotateComponent={rotateComponent} theme={theme} toggleTheme={toggleTheme} showViewPanel={showViewPanel} setShowViewPanel={setShowViewPanel} viewPanelSection={viewPanelSection} setViewPanelSection={setViewPanelSection} schematicDataUrl={schematicDataUrl} setSchematicDataUrl={setSchematicDataUrl} schematicLoading={schematicLoading} setSchematicLoading={setSchematicLoading} downloadSchematicPng={downloadSchematicPng} downloadSchematicPdf={downloadSchematicPdf} generateSchematic={generateSchematic} downloadCompCsv={downloadCompCsv} importFileRef={importFileRef} downloadPng={downloadPng} importPng={importPng} handleSave={handleSave} isExporting={isExporting} refreshProjectList={refreshProjectList} showProjectsDropdown={showProjectsDropdown} setShowProjectsDropdown={setShowProjectsDropdown} handleNewProject={handleNewProject} handleStartRename={handleStartRename} handleConfirmRename={handleConfirmRename} renamingProjectId={renamingProjectId} setRenamingProjectId={setRenamingProjectId} renameValue={renameValue} setRenameValue={setRenameValue} handleLoadProject={handleLoadProject} handleDeleteProject={handleDeleteProject} handleBackupWorkflow={handleBackupWorkflow} backupRestoreInputRef={backupRestoreInputRef} handleRestoreWorkflow={handleRestoreWorkflow} handleSyncToCloud={handleSyncToCloud} user={user} navigate={navigate} isAuthenticated={isAuthenticated} myProjects={myProjects} currentProjectId={currentProjectId} formatProjectDate={formatProjectDate} saveHistory={saveHistory} setWires={setWires} setComponents={setComponents} setSelected={setSelected} history={history} components={components} wires={wires} webSerialSupported={webSerialSupported} hardwareBoards={boardComponents} hardwareBoardId={hardwareBoardId} setHardwareBoardId={handleHardwareBoardChange} hardwarePortPath={hardwarePortPath} setHardwarePortPath={setHardwarePortPath} resolvedHardwarePort={resolvedHardwarePort} hardwareAvailablePorts={hardwareAvailablePorts} showAllHardwarePorts={showAllHardwarePorts} setShowAllHardwarePorts={setShowAllHardwarePorts} refreshHardwarePorts={refreshHardwarePorts} isLoadingHardwarePorts={isLoadingHardwarePorts} hardwareBaudRate={hardwareBaudRate} setHardwareBaudRate={setHardwareBaudRate} hardwareResetMethod={hardwareResetMethod} setHardwareResetMethod={setHardwareResetMethod} connectHardwareSerial={connectHardwareSerial} disconnectHardwareSerial={disconnectHardwareSerial} uploadToHardware={handleUploadToHardware} hardwareConnected={hardwareConnected} hardwareConnecting={hardwareConnecting} isUploadingHardware={isUploadingHardware} hardwareStatus={hardwareStatus} />



      {/* WIRING MODE HINT */}
      {wireStart && (
        <div className="bg-[rgba(255,145,0,.1)] border-b border-[rgba(255,145,0,.25)] text-[var(--orange)] px-5 py-2 text-[13px] flex items-center shrink-0" style={{ background: 'rgba(255,170,0,.12)', borderColor: 'rgba(255,170,0,.3)', color: 'var(--orange)' }}>
          〰 <strong>Wiring in progress</strong> — Click another pin to connect. Press Esc to cancel.
          <span style={{ marginLeft: 12 }}>🔵 Started from <strong>{wireStart.compId} [{wireStart.pinLabel}]</strong></span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden" onClick={() => setProjContextMenu(null)}>

        {/* PALETTE — hover to expand */}
        <aside
          className="bg-[var(--bg2)] border-r border-[var(--border)] overflow-y-auto overflow-x-hidden flex flex-col shrink-0"
          style={{
            width: isPaletteHovered ? 340 : 38,
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            zIndex: 10
          }}
          onMouseEnter={() => setIsPaletteHovered(true)}
          onMouseLeave={() => { if (!paletteContextMenu) { setIsPaletteHovered(false); setShowFilterDropdown(false); } }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {/* Collapsed indicator — visible only when closed */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: isPaletteHovered ? 0 : 1, transition: 'opacity 0.15s', pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>Components</span>
          </div>

          {/* Full palette content */}
          <div style={{
            width: 340, opacity: isPaletteHovered ? 1 : 0, transition: 'opacity 0.2s',
            pointerEvents: isPaletteHovered ? 'auto' : 'none',
            display: 'flex', flexDirection: 'column', height: '100%',
          }}>
            {/* Sticky top section */}
            <div style={{ flexShrink: 0, padding: '10px 8px 0', background: 'var(--bg2)' }}>
              <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-widest px-2 pt-1 pb-2">Components</div>

              {/* Search + Filter + View Toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  <input
                    className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] pl-9 pr-3 rounded-lg text-xs w-full outline-none font-inherit box-border transition-all focus:border-[var(--accent)]"
                    style={{ flex: 1, height: 28, marginBottom: 0 }}
                    placeholder="Search..."
                    value={paletteSearch}
                    onChange={(e) => setPaletteSearch(e.target.value)}
                  />
                  {paletteSearch && (
                    <button onClick={() => setPaletteSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.5, display: 'flex' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>

                <div className="filter-dropdown-container" style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: activeGroupFilter !== 'All' ? 'var(--accent)' : 'var(--card)', color: activeGroupFilter !== 'All' ? '#fff' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    title="Filter by group"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
                  </button>

                  {showFilterDropdown && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 100, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', padding: 4, minWidth: 160 }}>
                      <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-widest px-3 py-1.5 border-b border-[var(--border)] mb-1">Groups</div>
                      {['All', ...CATALOG.map(g => g.group)].map(group => (
                        <button
                          key={group}
                          onClick={() => { setActiveGroupFilter(group); setShowFilterDropdown(false); }}
                          style={{ width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 6, border: 'none', background: activeGroupFilter === group ? 'var(--accent)' : 'transparent', color: activeGroupFilter === group ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}
                          onMouseEnter={e => { if (activeGroupFilter !== group) e.currentTarget.style.background = 'var(--bg3)'; }}
                          onMouseLeave={e => { if (activeGroupFilter !== group) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {group === 'All' ? 'All Groups' : group}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setPaletteViewMode(m => m === 'list' ? 'grid' : 'list')}
                  style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}
                  title={paletteViewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
                >
                  {paletteViewMode === 'list' ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" /><rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" /><rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" /><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor" /><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" /><rect x="1" y="12" width="14" height="2" rx="1" fill="currentColor" /></svg>
                  )}
                </button>
              </div>

              {/* Upload ZIP + Create Component */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                <input type="file" ref={componentZipInputRef} onChange={handleUploadZip} accept=".zip" style={{ display: 'none' }} />
                <button
                  onClick={() => componentZipInputRef.current.click()}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3-4 3 4M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  Upload ZIP
                </button>
                <button
                  onClick={openComponentEditor}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 600 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  Create
                </button>
              </div>

              {/* Favourites section */}
              <div style={{ marginBottom: 6, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', overflow: 'hidden' }}>
                <button
                  onClick={() => setShowFavorites(f => !f)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg3)', border: 'none', borderBottom: showFavorites ? '1px solid var(--border)' : 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3H11l-2.5 1.8.9 3L6 7.2 3.6 9.8l.9-3L2 5h3.5z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0.5" /></svg>
                    Favourites {favoriteComponents.size > 0 ? `(${favoriteComponents.size})` : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {showFavorites
                      ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 7l3-4 3 4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3l3 4 3-4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    }
                  </span>
                </button>
                {showFavorites && (
                  <div style={{ padding: '6px 8px 8px' }}>
                    {favoriteComponents.size === 0 ? (
                      <div style={{ padding: '6px 2px', fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Right-click a component to favourite</div>
                    ) : (
                      (() => {
                        const favItems = [];
                        CATALOG.forEach(g => g.items.forEach(item => { if (favoriteComponents.has(item.type)) favItems.push({ ...item, group: g.group }); }));
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, padding: '2px 0' }}>
                            {favItems.map(item => {
                              const gColor = GROUP_COLORS[item.group] || 'var(--accent)';
                              return (
                                <div
                                  key={`fav-${item.type}`}
                                  draggable
                                  onDragStart={e => onPaletteDragStart(e, item)}
                                  onClick={() => { addComponentAtCenter(item); setSelectedPaletteItem(item); }}
                                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setPaletteContextMenu({ x: e.clientX, y: e.clientY, item }); }}
                                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '6px 4px', borderRadius: 7, border: `1px solid ${gColor}44`, background: 'var(--bg)', cursor: 'pointer', userSelect: 'none', transition: 'all .15s', minHeight: 38, boxSizing: 'border-box' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = gColor; e.currentTarget.style.background = `${gColor}14`; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${gColor}44`; e.currentTarget.style.background = 'var(--bg)'; }}
                                >
                                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 2, paddingRight: 2 }}>{item.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable component list */}
            <div className="palette-scroll" style={{
              flex: 1, overflowY: 'auto',
              display: paletteViewMode === 'grid' ? 'block' : 'flex',
              flexDirection: 'column', gap: paletteViewMode === 'list' ? 2 : 0,
              padding: '4px 8px 8px',
            }}>
              {CATALOG.map((group, index) => {
                const isGroupMatch = activeGroupFilter === 'All' || group.group === activeGroupFilter;
                if (!isGroupMatch) return null;

                const filteredItems = group.items.filter(item =>
                  item.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
                  item.type.toLowerCase().includes(paletteSearch.toLowerCase())
                );
                if (filteredItems.length === 0) return null;
                const groupColor = GROUP_COLORS[group.group] || 'var(--accent)';
                return (
                  <div key={group.group || `group-${index}`} style={{ marginBottom: paletteViewMode === 'grid' ? 10 : 4 }}>
                    <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-widest px-2 py-1 flex items-center gap-1" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {GROUP_ICON_SVG[group.group]?.(groupColor) || <span style={{ width: 6, height: 6, borderRadius: '50%', background: groupColor, display: 'inline-block' }} />}
                      </span>
                      {group.group}
                    </div>

                    {paletteViewMode === 'grid' ? (
                      /* GRID VIEW */
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '4px 0' }}>
                        {filteredItems.map(item => {
                          const compW = item.w || 60;
                          const compH = item.h || 60;
                          /* 84×66 target visible area with breathing room */
                          const previewW = 84, previewH = 66;
                          const rawScale = Math.min(previewW / compW, previewH / compH);
                          const scale = Math.max(0.22, Math.min(1.6, rawScale));
                          const hasUI = !!COMPONENT_REGISTRY[item.type]?.UI;
                          const locked = isPaletteItemLocked(item.type);
                          return (
                            <div
                              key={item.type}
                              draggable={!locked}
                              onDragStart={e => !locked && onPaletteDragStart(e, item)}
                              onClick={() => {
                                if (locked) { showLockToast(item.label, WOKWI_TO_COMP_ID[item.type]); return; }
                                addComponentAtCenter(item); setSelectedPaletteItem({ ...item, group: group.group });
                              }}
                              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setPaletteContextMenu({ x: e.clientX, y: e.clientY, item: { ...item, group: group.group } }); }}
                              title={item.label}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 4px 7px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: locked ? 'not-allowed' : 'pointer', userSelect: 'none', transition: 'all .15s', height: 104, boxSizing: 'border-box', minWidth: 0, overflow: 'hidden', position: 'relative', opacity: locked ? 0.4 : 1, filter: locked ? 'grayscale(1)' : 'none' }}
                              onMouseEnter={e => { if (!locked) { e.currentTarget.style.borderColor = groupColor; e.currentTarget.style.background = `${groupColor}14`; } }}
                              onMouseLeave={e => { if (!locked) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)'; } }}
                            >
                              {/* Overlay for locked state */}
                              {locked && (
                                <div style={{ position: 'absolute', top: 5, right: 6, zIndex: 10, fontSize: 13, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, padding: '2px 4px', color: '#ef4444' }}>
                                  🔒
                                </div>
                              )}
                              {/* Component SVG — absolutely centred in upper area, no inner box */}
                              {hasUI ? (
                                <div style={{ position: 'absolute', top: 'calc(50% - 7px)', left: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center center', pointerEvents: 'none', lineHeight: 0, width: compW, height: compH }}>
                                  {React.createElement(COMPONENT_REGISTRY[item.type].UI, { state: {}, attrs: {}, isRunning: false })}
                                </div>
                              ) : (
                                <div style={{ position: 'absolute', top: 'calc(50% - 7px)', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={groupColor} strokeWidth="1.2" opacity="0.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                                </div>
                              )}
                              {/* Label — pinned to bottom, single line */}
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 2, paddingRight: 2, position: 'relative', zIndex: 1 }}>{item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* LIST VIEW */
                      filteredItems.map(item => {
                        const locked = isPaletteItemLocked(item.type);
                        return (
                          <div
                            key={item.type}
                            draggable={!locked}
                            onDragStart={e => !locked && onPaletteDragStart(e, item)}
                            onClick={() => {
                              if (locked) { showLockToast(item.label, WOKWI_TO_COMP_ID[item.type]); return; }
                              addComponentAtCenter(item); setSelectedPaletteItem({ ...item, group: group.group });
                            }}
                            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setPaletteContextMenu({ x: e.clientX, y: e.clientY, item: { ...item, group: group.group } }); }}
                            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: locked ? 'not-allowed' : 'pointer', userSelect: 'none', marginBottom: 4, borderLeft: `3px solid ${groupColor}`, transition: 'all .15s', opacity: locked ? 0.4 : 1, filter: locked ? 'grayscale(1)' : 'none', position: 'relative' }}
                            onMouseEnter={e => { if (!locked) e.currentTarget.style.background = 'var(--bg3)'; }}
                            onMouseLeave={e => { if (!locked) e.currentTarget.style.background = 'var(--card)'; }}
                          >
                            {locked && (
                              <div style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', fontSize: 13, color: '#ef4444' }}>
                                🔒
                              </div>
                            )}
                            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{item.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>
                              {COMPONENT_REGISTRY[item.type]?.manifest?.description || COMPONENT_DESCRIPTIONS[item.type] || `${item.type} component`}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                );
              })}
              <div key="palette-tip" className="mt-auto px-2 py-2.5 text-[11px] text-[var(--text3)] leading-relaxed">
                Click or drag → drop to place · Del removes selected
              </div>
            </div>
          </div>
        </aside>

        {/* Palette right-click context menu */}
        {paletteContextMenu && (() => {
          const menuH = 175;
          const adjustedY = paletteContextMenu.y + menuH > window.innerHeight
            ? paletteContextMenu.y - menuH
            : paletteContextMenu.y;
          return (
            <div
              onMouseDown={e => e.stopPropagation()}
              style={{ position: 'fixed', left: paletteContextMenu.x, top: adjustedY, zIndex: 9000, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 200, overflow: 'hidden' }}
            >
              <div style={{ padding: '7px 12px 6px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{paletteContextMenu.item.label}</div>
              {[
                {
                  icon: favoriteComponents.has(paletteContextMenu.item.type) ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>,
                  label: favoriteComponents.has(paletteContextMenu.item.type) ? 'Remove from Favourites' : 'Add to Favourites',
                  color: '#f59e0b',
                  action: () => { toggleFavorite(paletteContextMenu.item.type); setPaletteContextMenu(null); setIsPaletteHovered(false); }
                },
                {
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>,
                  label: 'Component Documentation',
                  color: 'var(--text)',
                  action: () => {
                    const doc = COMPONENT_REGISTRY[paletteContextMenu.item.type]?.doc;
                    if (doc) {
                      const b = new Blob([doc], { type: 'text/html' });
                      window.open(URL.createObjectURL(b), '_blank');
                    } else {
                      window.open(`https://wokwi.com/docs/parts/${paletteContextMenu.item.type}`, '_blank');
                    }
                    setPaletteContextMenu(null); setIsPaletteHovered(false);
                  }
                },
                {
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
                  label: 'Edit a Copy',
                  color: 'var(--text)',
                  action: () => {
                    const item = paletteContextMenu.item;
                    const registryInfo = COMPONENT_REGISTRY[item.type];
                    const editCopyData = {
                      manifest: registryInfo?.manifest || item,
                      logic: buildLogicSourceFromRegistry(registryInfo, item.type),
                      ui: buildUiSourceFromRegistry(registryInfo, item.type),
                      validation: buildValidationSourceFromRegistry(registryInfo),
                      index: buildIndexSourceFromRegistry(registryInfo, item.type),
                      docs: registryInfo?.doc || '',
                    };
                    localStorage.setItem('openhw_edit_copy', JSON.stringify(editCopyData));
                    openComponentEditor();
                    setPaletteContextMenu(null);
                    setIsPaletteHovered(false);
                  }
                },
              ].map(({ icon, label, color, action }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none', color, padding: '9px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span>{icon}</span>{label}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Create Component Modal (placeholder) */}
        {showCreateComponentModal && (
          <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={() => setShowCreateComponentModal(false)}>
            <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[360px] shadow-[0_8px_40px_rgba(0,0,0,.4)]" onClick={e => e.stopPropagation()}>
              <div className="text-base font-bold mb-3.5 text-[var(--text)]">Create Component</div>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
                To create a custom component, build a ZIP package with <code>manifest.json</code>, <code>ui.tsx</code>, <code>logic.ts</code>, and optionally <code>validation.ts</code>, then upload via <strong>Upload ZIP to Test</strong>.
              </p>
              <button
                onClick={() => setShowCreateComponentModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Got it
              </button>
            </div>
          </div>
        )}

        {/* CANVAS + SVG WIRE LAYER */}
        <main
          className="flex-1 relative overflow-hidden bg-[var(--canvas-bg)] bg-[length:24px_24px]" style={{
            cursor: segDrag ? (segDrag.isHoriz ? 'ns-resize' : 'ew-resize') : wireStart ? 'crosshair' : isCanvasLocked ? 'default' : 'grab',
            backgroundImage: showGrid
              ? 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)'
              : 'none',
            touchAction: 'none', // Block browser pinch-to-zoom
          }}
          ref={canvasRef}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onDrop={onCanvasDrop}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          onMouseDown={e => {
            if (isCanvasLocked || wireStart || movingComp.current) return;
            if (e.button !== 0 && e.button !== 1) return;
            e.preventDefault();
            didPanRef.current = false;
            isPanningRef.current = true;
            panStartRef.current = { x: e.clientX, y: e.clientY, ox: canvasOffsetRef.current.x, oy: canvasOffsetRef.current.y };
          }}
          onClick={(e) => {
            if (didPanRef.current) return;
            if (wireStart) {
              const r = canvasRef.current.getBoundingClientRect();
              const newPt = { x: (e.clientX - r.left - canvasOffsetRef.current.x) / canvasZoom, y: (e.clientY - r.top - canvasOffsetRef.current.y) / canvasZoom };
              setWireStart(prev => ({ ...prev, waypoints: [...(prev.waypoints || []), newPt] }));
            } else {
              setSelected(null)
              setWireClickPos(null)
            }
          }}
          onDoubleClick={e => {
            if (wireStart || isRunning) return;
            // Don't open search if clicking on an input, button, select, textarea, or inside a context menu
            const tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'button' || tag === 'select') return;
            if (e.target.closest('[data-contextmenu]')) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const canvasX = (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
            const canvasY = (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
            setQuickAdd({ screenX: e.clientX, screenY: e.clientY, canvasX, canvasY });
            setQuickAddSearch('');
            setQuickAddIdx(0);
          }}
        >
          {/* Zoom Wrapper — scales all circuit content */}
          {/* Fix #4: innerCanvasRef is used to apply CSS transform directly during panning.
               React state (canvasOffset) is only committed once on mouseup. */}
          <div ref={innerCanvasRef} style={{
            position: 'absolute', top: 0, left: 0,
            width: '10000px', height: '8000px',
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasZoom})`, transformOrigin: '0 0',
          }}>
            {/* BOTTOM SVG layer for wires (Below Components) */}
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
            >
              {wires.filter(w => w.isBelow === true).map(w => {
                const fromParts = w.from.split(':')
                const toParts = w.to.split(':')
                const p1 = getPinPos(fromParts[0], fromParts[1])
                const p2 = getPinPos(toParts[0], toParts[1])
                if (!p1 || !p2) return null
                const e1 = getPinExitPoint(fromParts[0], fromParts[1]) || p1;
                const e2 = getPinExitPoint(toParts[0], toParts[1]) || p2;
                const isSelectedWire = selected === w.id;
                const wirePath = buildWirePath(p1, e1, e2, p2, w.waypoints);

                return (
                  <g key={w.id} style={{ cursor: 'pointer' }} onClick={(e) => {
                    e.stopPropagation();
                    setSelected(w.id);
                    const rect = canvasRef.current.getBoundingClientRect();
                    setWireClickPos({ x: (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current, y: (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current });
                  }} onDoubleClick={e => e.stopPropagation()}>
                    <path d={wirePath} stroke="transparent" strokeWidth={16} fill="none" style={{ pointerEvents: 'stroke' }} />
                    <path d={wirePath} stroke={isSelectedWire ? 'var(--orange)' : w.color} strokeWidth={isSelectedWire ? 2.5 : 1.5} fill="none" strokeDasharray={isSelectedWire ? "6 4" : "none"} strokeLinecap="round" opacity={0.6} />
                    <circle cx={p1.x} cy={p1.y} r={isSelectedWire ? 4 : 3} fill={isSelectedWire ? 'var(--orange)' : w.color} opacity={0.6} />
                    <circle cx={p2.x} cy={p2.y} r={isSelectedWire ? 4 : 3} fill={isSelectedWire ? 'var(--orange)' : w.color} opacity={0.6} />
                    {wirepointsEnabled && getWirePoints(p1, e1, e2, p2, w.waypoints).reduce((acc, _, i, arr) => {
                      // Skip pin-stub segments (first: p1→e1, last: e2→p2) — only show on routing segments
                      if (i < 1 || i >= arr.length - 2) return acc;
                      const a = arr[i], b = arr[i + 1];
                      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
                      if (segLen < 20) return acc;
                      const isHoriz = Math.abs(b.y - a.y) < 1;
                      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
                      acc.push(
                        <circle key={`sh-${i}`} cx={midX} cy={midY} r={isSelectedWire ? 6 : 4}
                          fill={isSelectedWire ? '#fff' : 'rgba(255,255,255,0.35)'}
                          stroke={isSelectedWire ? 'var(--orange)' : w.color} strokeWidth={1.5}
                          opacity={isSelectedWire ? 1 : 0.55}
                          style={{ pointerEvents: 'all', cursor: isHoriz ? 'ns-resize' : 'ew-resize' }}
                          title={isHoriz ? 'Drag up/down to route' : 'Drag left/right to route'}
                          onMouseDown={ev => {
                            ev.stopPropagation(); ev.preventDefault();
                            if (!isSelectedWire) { setSelected(w.id); return; }
                            const rect = canvasRef.current.getBoundingClientRect();
                            const mx = (ev.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
                            const my = (ev.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
                            const dragData = { wireId: w.id, segIdx: i, isHoriz, startMouseCanvas: { x: mx, y: my }, startPts: arr.map(pt => ({ ...pt })), preWires: wires, hasMoved: false };
                            segDragRef.current = dragData;
                            setSegDrag(dragData);
                          }}
                          onClick={ev => ev.stopPropagation()}
                          onDoubleClick={ev => {
                            ev.stopPropagation(); ev.preventDefault();
                            const newCorners = arr.slice(1, -1)
                              .filter((_, ci) => ci !== i - 1 && ci !== i)
                              .map(pt => ({ x: pt.x, y: pt.y, _corner: true }));
                            saveHistory();
                            setWires(prev => prev.map(ww => ww.id === w.id ? { ...ww, waypoints: newCorners } : ww));
                          }}
                        />
                      );
                      return acc;
                    }, [])}
                  </g>
                )
              })}
            </svg>

            {/* TOP SVG layer for wires (Above Components) & Context Menu */}
            <svg
              ref={svgRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
            >
              {/* Placed wires (Top layer) */}
              {wires.filter(w => w.isBelow !== true).map(w => {
                const fromParts = w.from.split(':')
                const toParts = w.to.split(':')
                const p1 = getPinPos(fromParts[0], fromParts[1])
                const p2 = getPinPos(toParts[0], toParts[1])
                if (!p1 || !p2) return null
                const e1 = getPinExitPoint(fromParts[0], fromParts[1]) || p1;
                const e2 = getPinExitPoint(toParts[0], toParts[1]) || p2;
                const isSelectedWire = selected === w.id;
                const wirePath = buildWirePath(p1, e1, e2, p2, w.waypoints);

                return (
                  <g key={w.id} style={{ cursor: 'pointer' }} onClick={(e) => {
                    e.stopPropagation();
                    setSelected(w.id);
                    const rect = canvasRef.current.getBoundingClientRect();
                    setWireClickPos({ x: (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current, y: (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current });
                  }} onDoubleClick={e => e.stopPropagation()}>
                    <path d={wirePath} stroke="transparent" strokeWidth={16} fill="none" style={{ pointerEvents: 'stroke' }} />
                    <path d={wirePath} stroke={isSelectedWire ? 'var(--orange)' : w.color} strokeWidth={isSelectedWire ? 2.3 : 1.3} fill="none" strokeDasharray={isSelectedWire ? "6 4" : "none"} strokeLinecap="round" opacity={0.9} />
                    <circle cx={p1.x} cy={p1.y} r={isSelectedWire ? 3 : 2} fill={isSelectedWire ? 'var(--orange)' : w.color} />
                    <circle cx={p2.x} cy={p2.y} r={isSelectedWire ? 3 : 2} fill={isSelectedWire ? 'var(--orange)' : w.color} />
                    {wirepointsEnabled && getWirePoints(p1, e1, e2, p2, w.waypoints).reduce((acc, _, i, arr) => {
                      // Skip pin-stub segments (first: p1→e1, last: e2→p2) — only show on routing segments
                      if (i < 1 || i >= arr.length - 2) return acc;
                      const a = arr[i], b = arr[i + 1];
                      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
                      if (segLen < 20) return acc;
                      const isHoriz = Math.abs(b.y - a.y) < 1;
                      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
                      acc.push(
                        <circle key={`sh-${i}`} cx={midX} cy={midY} r={isSelectedWire ? 6 : 4}
                          fill={isSelectedWire ? '#fff' : 'rgba(255,255,255,0.35)'}
                          stroke={isSelectedWire ? 'var(--orange)' : w.color} strokeWidth={1.5}
                          opacity={isSelectedWire ? 1 : 0.55}
                          style={{ pointerEvents: 'all', cursor: isHoriz ? 'ns-resize' : 'ew-resize' }}
                          title={isHoriz ? 'Drag up/down to route' : 'Drag left/right to route'}
                          onMouseDown={ev => {
                            ev.stopPropagation(); ev.preventDefault();
                            if (!isSelectedWire) { setSelected(w.id); return; }
                            const rect = canvasRef.current.getBoundingClientRect();
                            const mx = (ev.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
                            const my = (ev.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
                            const dragData = { wireId: w.id, segIdx: i, isHoriz, startMouseCanvas: { x: mx, y: my }, startPts: arr.map(pt => ({ ...pt })), preWires: wires, hasMoved: false };
                            segDragRef.current = dragData;
                            setSegDrag(dragData);
                          }}
                          onClick={ev => ev.stopPropagation()}
                          onDoubleClick={ev => {
                            ev.stopPropagation(); ev.preventDefault();
                            const newCorners = arr.slice(1, -1)
                              .filter((_, ci) => ci !== i - 1 && ci !== i)
                              .map(pt => ({ x: pt.x, y: pt.y, _corner: true }));
                            saveHistory();
                            setWires(prev => prev.map(ww => ww.id === w.id ? { ...ww, waypoints: newCorners } : ww));
                          }}
                        />
                      );
                      return acc;
                    }, [])}
                  </g>
                )
              })}

              {/* Preview wire while drawing */}
              {wireStart && (
                <path
                  d={multiRoutePath({ x: wireStart.x, y: wireStart.y }, mousePos, wireStart.waypoints)}
                  stroke="var(--orange)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  fill="none"
                  strokeLinecap="round"
                  opacity={0.8}
                />
              )}
            </svg>

            {/* Component Context Menu — rendered at canvas level to avoid overflow:hidden clipping */}
            {(() => {
              const comp = components.find(c => c.id === selected);
              if (!comp) return null;
              const reg = COMPONENT_REGISTRY[comp.type];
              if (!reg?.ContextMenu) return null;
              const showDuringRun = !!reg.contextMenuDuringRun || !!reg.contextMenuOnlyDuringRun;
              if (isRunning && !showDuringRun) return null;
              if (!isRunning && reg.contextMenuOnlyDuringRun) return null;
              return (
                <div key={`cmenu-${comp.id}`} data-contextmenu="true" style={{
                  position: 'absolute',
                  left: comp.x + comp.w / 2,
                  top: comp.y - 14,
                  transform: `translateX(-50%) translateY(-100%) scale(${1 / Math.max(canvasZoom, 0.01)})`,
                  transformOrigin: 'bottom center',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)', cursor: 'default',
                  pointerEvents: 'all', whiteSpace: 'nowrap', zIndex: 200
                }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  onDoubleClick={e => e.stopPropagation()}
                >
                  {React.createElement(reg.ContextMenu, {
                    attrs: getComponentStateAttrs(comp),
                    onUpdate: (key, value) => updateComponentAttr(comp.id, key, value)
                  })}
                  <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--border)' }} />
                  <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--bg2)' }} />
                </div>
              );
            })()}

            {/* HTML Overlay for Wire Context Menus (Bypasses SVG foreignObject event bugs) */}
            {(() => {
              const w = wires.find(w => w.id === selected);
              if (!w || isRunning) return null;

              const fromParts = w.from.split(':')
              const toParts = w.to.split(':')
              const p1 = getPinPos(fromParts[0], fromParts[1])
              const p2 = getPinPos(toParts[0], toParts[1])
              if (!p1 || !p2) return null

              // Use click position, fall back to wire midpoint
              const pts = [p1, ...(w.waypoints || []), p2];
              const midPt = pts[Math.floor(pts.length / 2)];
              const menuPos = wireClickPos || midPt;

              // Build connection label — "LED [anode]" style, no instance number
              const fromComp = components.find(c => c.id === fromParts[0]);
              const toComp = components.find(c => c.id === toParts[0]);
              const fromLabel = `${fromComp?.label || fromParts[0]} [${w.fromLabel || fromParts[1]}]`;
              const toLabel = `${toComp?.label || toParts[0]} [${w.toLabel || toParts[1]}]`;

              return (
                <div key={`menu-${w.id}`} style={{
                  position: 'absolute',
                  left: menuPos.x,
                  top: menuPos.y - 8,
                  transform: 'translateX(-50%) translateY(-100%)',
                  zIndex: 50,
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  padding: '8px 10px', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', cursor: 'default',
                  minWidth: 180,
                }}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}>
                  {/* Row 1: connection info — two lines, centered */}
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5, textAlign: 'center' }}
                    title={`${fromLabel} → ${toLabel}`}>
                    <div style={{ fontSize: 9, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{fromLabel}</div>
                    <div style={{ fontSize: 9, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{toLabel}</div>
                  </div>
                  {/* Row 2: controls — centered */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <input type="color" value={w.color} onChange={e => updateWireColor(w.id, e.target.value)} style={{ width: 22, height: 22, padding: 0, border: 'none', cursor: 'pointer', background: 'transparent', borderRadius: 4 }} title="Change Color" />
                    <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                    <button
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                      onClick={(e) => { e.stopPropagation(); toggleWireLayer(w.id); }}
                      onPointerDown={(e) => { e.stopPropagation(); }}
                      title={w.isBelow ? "Bring to Front" : "Send to Back"}
                    >
                      {w.isBelow ? '↑' : '↓'}
                    </button>
                    <button
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                      title="Reset route to auto"
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        saveHistory();
                        setWires(prev => prev.map(ww => ww.id === w.id ? { ...ww, waypoints: [] } : ww));
                      }}
                    >↺</button>
                    <button style={{ background: 'var(--red)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, padding: '4px 8px', borderRadius: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }} onPointerDown={(e) => { e.stopPropagation(); deleteWire(w.id); }} onClick={(e) => { e.stopPropagation(); deleteWire(w.id); }} title="Delete Wire">✕</button>
                  </div>
                  <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--border)' }} />
                  <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--bg2)' }} />
                </div>
              )
            })()}

            {/* Empty state */}
            {components.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text3)] text-center pointer-events-none">
                <div style={{ fontSize: 52, marginBottom: 16 }}>🔌</div>
                <p style={{ fontSize: 16, marginBottom: 8 }}>Drag components from the left panel</p>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                  Arduino Uno · LED · Resistor · Button · Servo · LCD
                </p>
              </div>
            )}

            {/* Components */}
            {components.map(comp => {
              const pins = PIN_DEFS[comp.type] || []
              const hasError = errorCompIds.has(comp.id)
              const isSelected = selected === comp.id
              const isSerialBoardSelected = serialBoardFilter !== 'all' && serialBoardFilter === comp.id
              return (
                <div
                  key={comp.id}
                  style={{
                    position: 'absolute',
                    left: comp.x, top: comp.y,
                    width: comp.w, height: comp.h,
                    zIndex: isSelected ? 5 : 2,
                    userSelect: 'none',
                    pointerEvents: 'none', // Clicks pass through the manifest wrapper
                    transform: comp.rotation ? `rotate(${comp.rotation}deg)` : undefined,
                    transformOrigin: 'center center',
                  }}
                >
                  {/* Hit Box — captures selection and drag only within BOUNDS */}
                  {(() => {
                    const getBounds = () => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      if (!reg) return { x: 0, y: 0, w: comp.w, h: comp.h };
                      if (typeof reg.BOUNDS === 'function') return reg.BOUNDS(getComponentStateAttrs(comp));
                      return reg.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h };
                    };
                    const b = getBounds();
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          left: b.x, top: b.y,
                          width: b.w, height: b.h,
                          cursor: wireStart ? 'crosshair' : 'move',
                          pointerEvents: 'auto',
                          zIndex: 0, // Below pins and interactive UI elements
                        }}
                        onMouseDown={e => onCompMouseDown(e, comp.id)}
                        onClick={e => onCompClick(e, comp.id)}
                        onDoubleClick={e => e.stopPropagation()}
                      />
                    );
                  })()}

                  {/* Selection ring — uses BOUNDS from ui.tsx for precise sizing */}
                  {isSelected && (() => {
                    const getBounds = () => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      if (!reg) return { x: 0, y: 0, w: comp.w, h: comp.h };
                      if (typeof reg.BOUNDS === 'function') return reg.BOUNDS(getComponentStateAttrs(comp));
                      return reg.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h };
                    };
                    const b = getBounds();
                    return (
                      <div style={{
                        position: 'absolute',
                        left: b.x - 6, top: b.y - 6,
                        width: b.w + 12, height: b.h + 12,
                        borderRadius: 8,
                        border: '2px solid var(--accent)',
                        boxShadow: '0 0 16px var(--glow)',
                        pointerEvents: 'none', zIndex: 10,
                      }} />
                    );
                  })()}
                  {/* Error ring — uses BOUNDS from ui.tsx for precise sizing */}
                  {hasError && (() => {
                    const getBounds = () => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      if (!reg) return { x: 0, y: 0, w: comp.w, h: comp.h };
                      if (typeof reg.BOUNDS === 'function') return reg.BOUNDS(getComponentStateAttrs(comp));
                      return reg.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h };
                    };
                    const b = getBounds();
                    return (
                      <div style={{
                        position: 'absolute',
                        left: b.x - 6, top: b.y - 6,
                        width: b.w + 12, height: b.h + 12,
                        borderRadius: 8,
                        border: '2px solid var(--red)',
                        boxShadow: '0 0 16px rgba(255,68,68,.4)',
                        pointerEvents: 'none', zIndex: 10,
                      }} />
                    );
                  })()}

                  {/* Serial-target board ring */}
                  {isSerialBoardSelected && (() => {
                    const getBounds = () => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      if (!reg) return { x: 0, y: 0, w: comp.w, h: comp.h };
                      if (typeof reg.BOUNDS === 'function') return reg.BOUNDS(getComponentStateAttrs(comp));
                      return reg.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h };
                    };
                    const b = getBounds();
                    return (
                      <>
                        <div style={{
                          position: 'absolute',
                          left: b.x - 10, top: b.y - 10,
                          width: b.w + 20, height: b.h + 20,
                          borderRadius: 10,
                          border: '2px dashed #38bdf8',
                          boxShadow: '0 0 18px rgba(56,189,248,.45)',
                          pointerEvents: 'none', zIndex: 9,
                        }} />
                        <div style={{
                          position: 'absolute',
                          left: b.x - 10,
                          top: b.y - 26,
                          background: '#0c4a6e',
                          color: '#e0f2fe',
                          border: '1px solid #38bdf8',
                          borderRadius: 6,
                          fontSize: 9,
                          padding: '1px 6px',
                          letterSpacing: '0.04em',
                          fontFamily: 'JetBrains Mono, monospace',
                          pointerEvents: 'none',
                          zIndex: 11,
                        }}>
                          SERIAL TARGET
                        </div>
                      </>
                    );
                  })()}

                  {/* Component Render — wrapped to allow pass-through to Hit Box */}
                  <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 1 }}>
                    {COMPONENT_REGISTRY[comp.type] ? (
                      // Local UI component rendering SVG
                      React.createElement(COMPONENT_REGISTRY[comp.type].UI, {
                        state: oopStates[comp.id] || {},
                        attrs: getComponentStateAttrs(comp),
                        isRunning: isRunning
                      })
                    ) : (
                      // Fallback for unsupported components (if any left)
                      <div
                        style={{ width: '100%', height: '100%', pointerEvents: 'none', background: '#444', border: '1px solid #777' }}
                        ref={el => {
                          if (comp.type === 'wokwi-neopixel-matrix' && el) {
                            neopixelRefs.current[comp.id] = el;
                          }
                        }}
                        dangerouslySetInnerHTML={{
                          __html: `<${comp.type} ${Object.entries(getComponentStateAttrs(comp)).map(([k, v]) => `${k}="${v}"`).join(' ')}></${comp.type}>`,
                        }}
                      />
                    )}
                  </div>

                  {/* Pins */}
                  {pins.map(pin => {
                    const pinStrRef = `${comp.id}:${pin.id}`;
                    const isHovered = hoveredPin === pinStrRef;
                    const isWireStartPin = wireStart?.compId === comp.id && wireStart?.pinId === pin.id;

                    // Hovered pin's category for passive highlighting
                    const hoverCompId = hoveredPin?.split(':')[0];
                    const hoverPinId = hoveredPin?.split(':')[1];
                    const hoverComp = hoverCompId ? components.find(c => c.id === hoverCompId) : null;
                    const hoverCat = (hoverComp && hoverPinId) ? getPinCategory(hoverPinId, '', hoverComp.type) : null;

                    const startCat = wireStart ? getPinCategory(wireStart.pinId, wireStart.pinLabel, wireStart.compType) : null;
                    const currentCat = getPinCategory(pin.id, pin.description, comp.type);

                    const isSuggested = startCat && currentCat && hasCategoryIntersection(startCat, currentCat) && !isWireStartPin;
                    const isRelated = hoverCat && currentCat && hasCategoryIntersection(hoverCat, currentCat) && !isHovered;

                    const isHighlight = isWireStartPin || isHovered || isSuggested || isRelated;

                    // Check if a wire is connected to this pin
                    const connectedWire = wires.find(w => w.from === pinStrRef || w.to === pinStrRef);
                    const pinColor = connectedWire ? connectedWire.color : (isHighlight ? '#f1c40f' : 'rgba(255,255,255,0.2)');
                    const pinBorder = connectedWire ? connectedWire.color : (isHighlight ? '#fff' : 'rgba(255,255,255,0.8)');

                    return (
                      <div
                        key={pin.id}
                        title={`${pin.description || pin.id} — click to wire`}
                        style={{
                          position: 'absolute',
                          left: pin.x, top: pin.y,
                          width: 5, height: 5,
                          background: pinColor,
                          border: `1px solid ${pinBorder}`,
                          borderRadius: '0%', /* matching task3.html */
                          cursor: 'crosshair',
                          zIndex: isHovered || isSuggested ? 30 : 20, /* matching task3.html hover and port z-index */
                          transform: `translate(-50%, -50%)${isHovered || isSuggested ? ' scale(1.5)' : ''}`, /* matching task3.html scale */
                          transition: '0.2s', /* matching task3.html transition */
                          pointerEvents: 'all', /* Fix hit detection */
                          boxShadow: isSuggested ? '0 0 8px #f1c40f' : 'none',
                        }}
                        onMouseEnter={() => setHoveredPin(pinStrRef)}
                        onMouseLeave={() => setHoveredPin(null)}
                        onClick={e => onPinClick(e, comp.id, pin.id, pin.description || pin.id)}
                      >
                        {/* Pin label tooltip */}
                        {isHovered && (
                          <div style={{
                            position: 'absolute', bottom: 18, left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#111', color: '#fff',
                            padding: '4px 8px', borderRadius: 4,
                            fontSize: 10, whiteSpace: 'nowrap', zIndex: 9999,
                            pointerEvents: 'none', border: '1px solid #444',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                          }}>
                            {pin.description || pin.id}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Component label */}
                  <div style={{
                    position: 'absolute',
                    top: (() => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      const b = typeof reg?.BOUNDS === 'function'
                        ? reg.BOUNDS(getComponentStateAttrs(comp))
                        : (reg?.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h });
                      return b.y + b.h + 4;
                    })(),
                    left: (() => {
                      const reg = COMPONENT_REGISTRY[comp.type];
                      const b = typeof reg?.BOUNDS === 'function'
                        ? reg.BOUNDS(getComponentStateAttrs(comp))
                        : (reg?.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h });
                      return b.x + b.w / 2;
                    })(),
                    transform: 'translateX(-50%)',
                    fontSize: 10, color: hasError ? 'var(--red)' : 'var(--text3)',
                    whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace',
                    pointerEvents: 'none',
                  }}>
                    {comp.label}
                  </div>

                </div>
              )
            })}
          </div>{/* end zoom wrapper */}

          {/* Runtime mini panel (top-left) */}
          {isRunning && !isCompiling && (
            <div
              data-export-ignore="true"
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                zIndex: 90,
                width: 188,
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 }}>
                Simulation Runtime
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: 'var(--text3)' }}>Speed</span>
                <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{simulationSpeedPercent}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--text3)' }}>Duration</span>
                <span style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{formatRunDuration(runDurationSec)}</span>
              </div>
              {isPaused && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--orange)', fontWeight: 600 }}>Paused</div>
              )}
            </div>
          )}

          {/* Component Description Panel — shows info of canvas-selected component */}
          {showComponentDesc && selectedComponentInfo && (
            <div
              data-export-ignore="true"
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 90, width: 220, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', overflow: 'hidden' }}
            >
              {/* Header */}
              <div style={{
                padding: '16px 16px 14px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                background: 'linear-gradient(to bottom, var(--bg2), var(--bg1))'
              }}>
                <div style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--text)',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.1'
                }}>
                  {selectedComponentInfo.label}
                </div>

                {/* Description - Preserved from Local */}
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                  {COMPONENT_REGISTRY[selectedComponentInfo.type]?.manifest?.description || COMPONENT_DESCRIPTIONS[selectedComponentInfo.type] || `${selectedComponentInfo.type} component`}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  {/* Category Chip */}
                  <div style={{
                    height: 24,
                    fontSize: 9,
                    fontWeight: 800,
                    color: GROUP_COLORS[selectedComponentInfo.group] || 'var(--accent)',
                    background: `${GROUP_COLORS[selectedComponentInfo.group] || 'var(--accent)'}12`,
                    borderRadius: 6,
                    padding: '0 10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${GROUP_COLORS[selectedComponentInfo.group] || 'var(--accent)'}22`
                  }}>
                    {selectedComponentInfo.group}
                  </div>

                  <button
                    onClick={() => {
                      const doc = COMPONENT_REGISTRY[selectedComponentInfo.type]?.doc;
                      if (doc) {
                        const b = new Blob([doc], { type: 'text/html' });
                        window.open(URL.createObjectURL(b), '_blank');
                      } else {
                        window.open(`https://wokwi.com/docs/parts/${selectedComponentInfo.type}`, '_blank');
                      }
                    }}
                    style={{
                      height: 24,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      padding: '0 12px',
                      color: 'var(--text2)',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      borderRadius: 6,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--bg4)';
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.color = 'var(--accent)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--bg3)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text2)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                    }}
                  >
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    Documentation
                  </button>
                </div>
              </div>

              {/* Pin Wiring Dropdowns */}
              <div className="panel-scroll" style={{ padding: '10px 12px', flex: 1, overflowY: 'auto' }}>
                <div
                  onClick={() => setIsPinMappingExpanded(!isPinMappingExpanded)}
                  style={{
                    fontSize: 11,
                    fontWeight: 'bold',
                    color: 'var(--text3)',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '4px 0'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text2)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
                >
                  <span>Pin Mapping</span>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                    style={{
                      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isPinMappingExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      opacity: 0.6
                    }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
                {isPinMappingExpanded && (() => {
                  const compPins = LOCAL_PIN_DEFS[selectedComponentInfo.type] || [];
                  if (compPins.length === 0) {
                    return <div style={{ fontSize: 12, color: 'var(--text3)' }}>No pins exposed.</div>;
                  }

                  // Gather ALL components for destination endpoints (excluding self)
                  const validTargets = components.filter(c => c.id !== selectedComponentInfo.id);
                  const targetOptions = [];
                  validTargets.forEach(b => {
                    const bPins = LOCAL_PIN_DEFS[b.type] || [];
                    bPins.forEach(p => targetOptions.push({
                      id: `${b.id}:${p.id}`,
                      label: `${b.label || b.id} : ${p.id}`,
                      type: b.type,
                      description: p.description
                    }));
                  });

                  return compPins.map(pin => {
                    const pinIdStr = `${selectedComponentInfo.id}:${pin.id}`;
                    const currentPinCat = getPinCategory(pin.id, pin.description, selectedComponentInfo.type);

                    // Filter target options to show only compatible pins for special categories (GND, POWER, etc.)
                    const filteredOptions = targetOptions.filter(opt => {
                      if (!currentPinCat) return true; // Show all for unmapped/general pins
                      const targetPinCat = getPinCategory(opt.id.split(':')[1], opt.description, opt.type);
                      return hasCategoryIntersection(currentPinCat, targetPinCat);
                    });

                    // Find if any wire is connected to this pin specifically
                    const connectedWire = wires.find(w => w.from === pinIdStr || w.to === pinIdStr);
                    // Determine current dropdown value
                    let currentVal = '';
                    if (connectedWire) {
                      currentVal = connectedWire.from === pinIdStr ? connectedWire.to : connectedWire.from;
                    }

                    const pinPreferredColor = pendingPinColors[pinIdStr] || (connectedWire ? connectedWire.color : wireColor(pin.id));

                    return (
                      <div key={pin.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0, width: 44 }} title={pin.description || pin.id}>
                          {pin.id}
                        </span>

                        {/* Interactive Arrow & Color Picker */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            const picker = e.currentTarget.querySelector('input[type="color"]');
                            if (picker) picker.click();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            opacity: connectedWire ? 1 : 0.6,
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            padding: '0 4px',
                            flexShrink: 0
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.opacity = connectedWire ? '1' : '0.6';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          title={connectedWire ? "Change wire color" : "Set wire color before connecting"}
                        >
                          <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke={pinPreferredColor}
                            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                          </svg>
                          <input
                            type="color"
                            value={pinPreferredColor}
                            onChange={(e) => {
                              const newColor = e.target.value;
                              setPendingPinColors(prev => ({ ...prev, [pinIdStr]: newColor }));
                              if (connectedWire) {
                                updateWireColor(connectedWire.id, newColor);
                              }
                            }}
                            style={{
                              position: 'absolute',
                              top: 0, left: 0, width: 0, height: 0, opacity: 0, padding: 0, border: 'none', pointerEvents: 'none'
                            }}
                          />
                        </div>

                        <select
                          value={currentVal}
                          onChange={(e) => {
                            const selectedTarget = e.target.value;
                            setWires(prev => {
                              // 1. Generate the exact same wire syntax as manual mapping
                              const toPinLabel = selectedTarget ? (selectedTarget.includes(':') ? selectedTarget.split(':').slice(1).join(':') : '') : '';
                              const finalColor = pendingPinColors[pinIdStr] || wireColor(toPinLabel);

                              const newWire = selectedTarget ? {
                                id: `w${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                                from: pinIdStr,
                                to: selectedTarget,
                                fromLabel: pin.id,
                                toLabel: toPinLabel,
                                color: finalColor,
                                waypoints: []
                              } : null;

                              // 2. Filter cleanly using a map proxy to avoid reference staleness
                              const filtered = prev.filter(w => w.from !== pinIdStr && w.to !== pinIdStr);

                              setWireStart(null); // Cancel manual wire draw
                              return newWire ? [...filtered, newWire] : filtered;
                            });
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '3px 6px',
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            color: currentVal ? 'var(--accent)' : 'var(--text2)',
                            borderRadius: 4,
                            fontSize: 10,
                            fontFamily: 'JetBrains Mono, monospace',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="">-- Disconnected --</option>
                          {filteredOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Canvas Zoom Toolbar — anchored inside canvas so it moves with code panel resize */}
          {validationToast && (
            <div
              className="validation-toast-canvas"
              role="alert"
              data-export-ignore="true"
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            >
              <div className="validation-toast-canvas__header">
                <span>{validationToast.title}</span>
                <button
                  type="button"
                  className="validation-toast-canvas__close"
                  onClick={() => setValidationToast(null)}
                  aria-label="Close validation notification"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <ul className="validation-toast-canvas__list">
                {validationToast.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div
            data-export-ignore="true"
            style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 100, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 6px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
          >
            <button
              className="zoom-btn"
              onClick={() => setIsConsoleOpen(v => !v)}
              style={{
                background: isConsoleOpen ? 'var(--card)' : 'none',
                border: isConsoleOpen ? '1px solid var(--accent)' : 'none',
                color: isConsoleOpen ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px 7px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center'
              }}
              title="Toggle Console"
            >
              <TerminalIcon size={16} />
            </button>
            <button
              className="zoom-btn"
              onClick={() => setCanvasZoom(z => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
              style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', lineHeight: 1, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
              title="Zoom Out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button
              onClick={() => setCanvasZoom(1)}
              style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 6, minWidth: 40, fontFamily: 'JetBrains Mono, monospace' }}
              title="Reset Zoom"
            >{Math.round(canvasZoom * 100)}%</button>
            <button
              className="zoom-btn"
              onClick={() => setCanvasZoom(z => Math.min(2, parseFloat((z + 0.25).toFixed(2))))}
              style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', lineHeight: 1, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
              title="Zoom In"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowCanvasMenu(m => !m)}
                style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 16, padding: '2px 7px', borderRadius: 6 }}
                title="Canvas Menu"
              >⋮</button>
              {showCanvasMenu && (
                <div
                  style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 190, zIndex: 200, padding: '4px' }}
                  onMouseLeave={() => setShowCanvasMenu(false)}
                >
                  <button className="canvas-menu-item" onClick={() => { setCanvasZoom(1); setCanvasOffset({ x: 0, y: 0 }); setShowCanvasMenu(false); }}>Fit to Canvas</button>
                  <button className={`canvas-menu-item${history.past.length === 0 || isRunning ? ' canvas-menu-item--disabled' : ''}`} onClick={() => { undo(); setShowCanvasMenu(false); }} disabled={history.past.length === 0 || isRunning}>Undo</button>
                  <button className={`canvas-menu-item${history.future.length === 0 || isRunning ? ' canvas-menu-item--disabled' : ''}`} onClick={() => { redo(); setShowCanvasMenu(false); }} disabled={history.future.length === 0 || isRunning}>Redo</button>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  <button className="canvas-menu-item" onClick={() => { setShowGrid(g => !g); setShowCanvasMenu(false); }}>{showGrid ? 'Hide Grid' : 'Show Grid'}</button>
                  <button className="canvas-menu-item" onClick={() => { setIsCanvasLocked(l => !l); setShowCanvasMenu(false); }}>{isCanvasLocked ? 'Unlock Canvas' : 'Lock Canvas'}</button>
                  <button className="canvas-menu-item" onClick={() => { toggleFullscreen(); setShowCanvasMenu(false); }}>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button>
                  <button className="canvas-menu-item" onClick={() => {
                    const enabling = !wirepointsEnabled;
                    setWirepointsEnabled(enabling);
                    setShowCanvasMenu(false);
                  }}>{wirepointsEnabled ? 'Disable Wire Waypoints' : 'Enable Wire Waypoints'}</button>
                  <button className="canvas-menu-item" onClick={() => { setShowComponentDesc(d => !d); setShowCanvasMenu(false); }}>{showComponentDesc ? 'Hide Component Info' : 'Show Component Info'}</button>
                  <button className="canvas-menu-item" onClick={() => { setShowConnectionsPanel(p => !p); setShowCanvasMenu(false); }}>{showConnectionsPanel ? 'Hide Connections Panel' : 'Show Connections Panel'}</button>
                  <button
                    className="canvas-menu-item"
                    onClick={() => {
                      const next = !blocklyDisabled;
                      setBlocklyDisabled(next);
                      try { localStorage.setItem('ohw_blockly_disabled', String(next)); } catch (_) {}
                      setShowCanvasMenu(false);
                    }}
                    title={blocklyDisabled ? 'Re-enable block code editor (uses more CPU)' : 'Disable block code editor to improve canvas performance'}
                  >
                    {blocklyDisabled ? 'Enable Block Coding' : 'Disable Block Coding'}
                  </button>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  <button className="canvas-menu-item canvas-menu-item--danger" onClick={() => { if (!isRunning) { saveHistory(); setComponents([]); setWires([]); setSelected(null); } setShowCanvasMenu(false); }}>Clear Canvas</button>
                </div>
              )}
            </div>
          </div>

          <SimulationConsolePanel
            isOpen={isConsoleOpen}
            height={consoleHeight}
            entries={consoleEntries}
            onResizeStart={onMouseDownConsoleResize}
            onClose={() => setIsConsoleOpen(false)}
            onClear={clearConsoleEntries}
            onDownload={downloadConsoleLog}
          />

          {/* ── Quick-Add Popup (double-click on canvas) ── */}
          {quickAdd && (() => {
            const q = quickAddSearch.trim().toLowerCase();
            const results = [];
            if (q) {
              outer: for (const group of LOCAL_CATALOG) {
                for (const item of group.items) {
                  if (item.label.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)) {
                    results.push(item);
                    if (results.length >= 4) break outer;
                  }
                }
              }
            }
            const selIdx = Math.max(0, Math.min(quickAddIdx, results.length - 1));
            const VW = window.innerWidth, VH = window.innerHeight;
            const menuW = 240, approxH = 44 + results.length * 38 + (results.length === 0 ? 38 : 0);
            const left = quickAdd.screenX + menuW > VW ? quickAdd.screenX - menuW - 4 : quickAdd.screenX + 4;
            const top = quickAdd.screenY + approxH > VH ? quickAdd.screenY - approxH - 4 : quickAdd.screenY + 4;
            return (
              <div
                data-quickadd="true"
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'fixed', left, top, zIndex: 9999,
                  width: menuW,
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
                  overflow: 'hidden',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {/* Search input */}
                <div style={{ padding: '8px 10px', borderBottom: results.length > 0 ? '1px solid var(--border)' : 'none' }}>
                  <input
                    ref={quickAddInputRef}
                    data-quickadd="true"
                    value={quickAddSearch}
                    onChange={e => { setQuickAddSearch(e.target.value); setQuickAddIdx(0); }}
                    onKeyDown={e => {
                      if (e.key === 'Escape') { e.preventDefault(); setQuickAdd(null); }
                      else if (e.key === 'ArrowDown') { e.preventDefault(); setQuickAddIdx(i => Math.min(i + 1, results.length - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setQuickAddIdx(i => Math.max(i - 1, 0)); }
                      else if (e.key === 'Enter' && results.length > 0) {
                        e.preventDefault();
                        addComponentAt(results[selIdx], quickAdd.canvasX, quickAdd.canvasY);
                        setQuickAdd(null);
                      }
                    }}
                    placeholder="Search component..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'var(--bg3)', border: '1px solid var(--border2)',
                      color: 'var(--text)', padding: '7px 10px',
                      borderRadius: 7, fontFamily: 'inherit', fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
                {/* Result list */}
                {results.map((item, i) => (
                  <div
                    key={`${item.type}-${i}`}
                    data-quickadd="true"
                    onMouseEnter={() => setQuickAddIdx(i)}
                    onMouseDown={e => { e.preventDefault(); addComponentAt(item, quickAdd.canvasX, quickAdd.canvasY); setQuickAdd(null); }}
                    style={{
                      padding: '8px 12px',
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: i === selIdx ? 'var(--accent)' : 'transparent',
                      color: i === selIdx ? '#fff' : 'var(--text)',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontWeight: 600, flex: 1 }}>{item.label}</span>
                    {i === selIdx && <span style={{ fontSize: 10, opacity: 0.75 }}>↵</span>}
                  </div>
                ))}
                {/* Empty state */}
                {q && results.length === 0 && (
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>No components found</div>
                )}
                {!q && (
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>Type to search components...</div>
                )}
              </div>
            );
          })()}
        </main>


        {/* RIGHT PANEL */}
        <RightPanel
          isPanelOpen={isPanelOpen} panelWidth={panelWidth} isDragging={isDragging} onMouseDownResize={onMouseDownResize} setIsPanelOpen={setIsPanelOpen}
          explorerWidth={explorerWidth} isExplorerDragging={isExplorerDragging} onMouseDownExplorerResize={onMouseDownExplorerResize}
          selected={selected} setSelected={setSelected}
          validationErrors={validationErrors} showValidation={showValidation} setShowValidation={setShowValidation}
          codeTab={codeTab} setCodeTab={setCodeTab} code={code} setCode={setCode}
          blocklyXml={blocklyXml} setBlocklyXml={setBlocklyXml}
          blocklyGeneratedCode={blocklyGeneratedCode} setBlocklyGeneratedCode={setBlocklyGeneratedCode}
          useBlocklyCode={useBlocklyCode} setUseBlocklyCode={setUseBlocklyCode}
          blocklyDisabled={blocklyDisabled} setBlocklyDisabled={setBlocklyDisabled}
          projectFiles={projectFiles} openCodeTabs={openCodeTabs} activeCodeFileId={activeCodeFileId} showCodeExplorer={showCodeExplorer}
          onToggleCodeExplorer={() => setShowCodeExplorer(v => !v)} onOpenCodeFile={openCodeFile} onCloseCodeTab={closeCodeTab}
          onSaveCodeFile={saveCodeFile} onDuplicateCodeFile={duplicateCodeFile} onRenameCodeFile={renameCodeFile} onDeleteCodeFile={deleteCodeFile} onDownloadCodeFile={downloadCodeFile}
          onToggleCodeFileDisabled={toggleCodeFileDisabled}
          onCreateCodeFile={createCodeFile} onCreateCodeTab={createCodeTab} onUploadCodeFile={uploadCodeFile}
          libQuery={libQuery} setLibQuery={setLibQuery} handleSearchLibraries={handleSearchLibraries} isSearchingLib={isSearchingLib} libMessage={libMessage} libInstalled={libInstalled} libResults={libResults} handleInstallLibrary={handleInstallLibrary} installingLib={installingLib}
          serialPaused={serialPaused} setSerialPaused={setSerialPaused} isRunning={isRunning} serialHistory={serialHistory} setSerialHistory={setSerialHistory} serialOutputRef={serialOutputRef} serialInput={serialInput} setSerialInput={setSerialInput} sendSerialInput={sendSerialInput} clearSerialMonitor={clearSerialMonitor}
          serialViewMode={serialViewMode} setSerialViewMode={setSerialViewMode} serialBoardFilter={serialBoardFilter} setSerialBoardFilter={setSerialBoardFilter} serialBoardOptions={serialBoardOptions} serialBoardLabels={serialBoardLabels} serialBoardKinds={serialBoardKinds} serialBoardSourceModes={rp2040BoardSourceModes} serialBaudRate={serialBaudRate} setSerialBaudRate={setSerialBaudRate} serialBaudOptions={serialBaudOptions} serialLineEnding={serialLineEnding} setSerialLineEnding={setSerialLineEnding}
          hardwareConnected={hardwareConnected}
          plotterPaused={plotterPaused} setPlotterPaused={setPlotterPaused} plotData={plotData} setPlotData={setPlotData} selectedPlotPins={selectedPlotPins} setSelectedPlotPins={setSelectedPlotPins} plotterCanvasRef={plotterCanvasRef} serialPlotLabelsRef={serialPlotLabelsRef}
          showConnectionsPanel={showConnectionsPanel} wires={wires} updateWireColor={updateWireColor} deleteWire={deleteWire}
        />

        {/* MY PROJECTS SIDEBAR */}
        <aside
          className="bg-[var(--bg2)] border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden transition-[width] duration-200"
          style={{ width: showProjectsSidebar ? 320 : 0, borderLeft: showProjectsSidebar ? '1px solid var(--border)' : 'none' }}
        >
          {showProjectsSidebar && (
            <>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                <span className="text-sm font-bold text-[var(--text)] tracking-tight">My Projects</span>
                <button 
                  onClick={() => setShowProjectsSidebar(false)} 
                  className="bg-[var(--card)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text3)] hover:text-[var(--text)] rounded-lg w-7 h-7 flex items-center justify-center transition-all active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>

              <div className="px-5 pb-4 shrink-0">
                <div className="flex p-1 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                  {[
                    { id: 'favourites', label: 'Fav' },
                    { id: 'projects', label: 'Projects' },
                    { id: 'custom', label: 'Custom' },
                    { id: 'settings', label: 'Settings' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setProjectsSidebarTab(tab.id)}
                      className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all duration-200
                        ${projectsSidebarTab === tab.id 
                          ? 'bg-[var(--card)] text-[var(--accent)] shadow-sm' 
                          : 'text-[var(--text3)] hover:text-[var(--text2)]'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {projectsSidebarTab === 'favourites' && (
                  <div>
                    <div className="text-[11px] text-[var(--text3)] px-1 py-1.5">Starred projects appear here.</div>
                    {myProjects.filter(p => favouriteProjectIds.includes(p.id)).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-4 text-[var(--text3)]">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        </div>
                        <div className="text-sm font-bold text-[var(--text)] mb-1">No Favourites Yet</div>
                        <div className="text-[11px] text-[var(--text3)] leading-normal max-w-[180px]">Star a project from the Projects tab to see it here.</div>
                      </div>
                    ) : myProjects.filter(p => favouriteProjectIds.includes(p.id)).map(proj => (
                      <ProjectCard
                        key={proj.id}
                        proj={proj}
                        currentProjectId={currentProjectId}
                        renamingProjectId={renamingProjectId}
                        renameValue={renameValue}
                        setRenameValue={setRenameValue}
                        handleConfirmRename={handleConfirmRename}
                        setRenamingProjectId={setRenamingProjectId}
                        handleLoadProject={handleLoadProject}
                        isRunning={isRunning}
                        setShowProjectsSidebar={setShowProjectsSidebar}
                        onContextMenu={(projData, x, y) => setProjContextMenu({ proj: projData, x, y })}
                        formatProjectDate={formatProjectDate}
                      />
                    ))}
                  </div>
                )}

                {projectsSidebarTab === 'projects' && (
                  <div>
                    <div className="flex justify-between items-center mb-4 px-1">
                      <div className="text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-wider">Your Library</div>
                      <button 
                        onClick={() => { setShowProjectsSidebar(false); handleNewProject(); }}
                        className="flex items-center gap-1.5 bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        NEW
                      </button>
                    </div>
                    {myProjects.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg)]/30">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-4 text-[var(--text3)]">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                        </div>
                        <div className="text-sm font-bold text-[var(--text)] mb-1">No saved projects</div>
                        <div className="text-[11px] text-[var(--text3)] leading-normal max-w-[180px]">Your circuits are auto-saved as you work.</div>
                      </div>
                    ) : myProjects.map(proj => (
                      <ProjectCard
                        key={proj.id}
                        proj={proj}
                        currentProjectId={currentProjectId}
                        renamingProjectId={renamingProjectId}
                        renameValue={renameValue}
                        setRenameValue={setRenameValue}
                        handleConfirmRename={handleConfirmRename}
                        setRenamingProjectId={setRenamingProjectId}
                        handleLoadProject={handleLoadProject}
                        isRunning={isRunning}
                        setShowProjectsSidebar={setShowProjectsSidebar}
                        onContextMenu={(projData, x, y) => setProjContextMenu({ proj: projData, x, y })}
                        formatProjectDate={formatProjectDate}
                      />
                    ))}
                  </div>
                )}

                {projectsSidebarTab === 'custom' && (
                  <div>
                    <div className="flex justify-between items-center mb-4 px-1">
                      <div className="text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-wider">Custom Parts</div>
                      <button 
                        onClick={() => setShowCreateComponentModal(true)}
                        className="flex items-center gap-1.5 bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        CREATE
                      </button>
                    </div>
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-[var(--border)] rounded-xl">
                       <div className="text-sm font-bold text-[var(--text)] mb-1 opacity-50">Nothing here yet</div>
                       <div className="text-[11px] text-[var(--text3)] leading-normal">Custom components will appear here.</div>
                    </div>
                  </div>
                )}

                {projectsSidebarTab === 'settings' && (
                  <div className="flex flex-col gap-2 py-1">
                    <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider px-1 py-1.5">Preferences</div>
                    <div className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2.5 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-bold text-[var(--text)]">Auto-save Projects</span>
                        <span className="text-[9px] text-[var(--text3)]">Saves changes every 2.5s</span>
                      </div>
                      <button 
                        onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                        className={`w-9 h-5 rounded-full relative transition-all duration-300 ${autoSaveEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg3)]'}`}
                      >
                        <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${autoSaveEnabled ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>

                    <div className="h-px bg-[var(--border)] my-1 opacity-50" />
                    <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider px-1 py-1.5">Data Management</div>
                    <button className="w-full flex items-center gap-2.5 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2.5 text-[13px]" onClick={handleBackupWorkflow}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                      Backup
                      <span className="ml-auto text-[11px] text-[var(--text3)]">Download ZIP</span>
                    </button>
                    <button className="w-full flex items-center gap-2.5 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2.5 text-[13px]" onClick={() => backupRestoreInputRef.current?.click()}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                      Restore
                      <span className="ml-auto text-[11px] text-[var(--text3)]">From ZIP</span>
                    </button>
                    {isAuthenticated && (
                      <button className="w-full flex items-center gap-2.5 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2.5 text-[13px]" onClick={handleSyncToCloud}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
                        Sync to Cloud
                        <span className="ml-auto text-[11px] text-[var(--text3)]">Upload</span>
                      </button>
                    )}
                    {isAuthenticated && (
                      <>
                        <div className="h-px bg-[var(--border)] my-1" />
                        <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider px-1 py-1.5">Account</div>
                        <button className="w-full flex items-center gap-2.5 bg-[var(--card)] border border-[var(--red)] text-[var(--red)] rounded-lg px-3 py-2.5 text-[13px]" onClick={() => { logout(); setShowProjectsSidebar(false); }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                          Logout
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--border)] p-4 bg-[var(--bg2)] flex flex-col gap-3 shrink-0">
                {!isAuthenticated ? (
                  <button 
                    onClick={() => { const lastEmail = localStorage.getItem('ohw_last_email'); navigate('/login', { state: { email: lastEmail, from: window.location.pathname } }); }}
                    className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                    Sign In to Sync
                  </button>
                ) : (
                  <div 
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] group cursor-pointer hover:border-[var(--text3)] transition-all"
                    onClick={() => {
                      if (user?.role === 'teacher') navigate('/teacher/dashboard')
                      else if (user?.role === 'student') navigate('/student/dashboard')
                      else navigate('/user/dashboard')
                    }}
                    title="Go to dashboard"
                  >
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] text-xs font-bold uppercase">
                      {user?.name?.[0] || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-[var(--text)] truncate">{user?.name || 'User'}</div>
                      <div className="text-[9px] text-[var(--text3)] font-medium uppercase tracking-tight">{user?.role || 'Developer'}</div>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  </div>
                )}

                <div className="flex p-1 bg-[var(--bg)] rounded-xl border border-[var(--border)] shadow-inner">
                  <button
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all
                      ${!isAuthenticated 
                        ? 'bg-[var(--card)] text-[var(--accent)] shadow-sm border border-[var(--border)]' 
                        : 'text-[var(--text3)] hover:text-[var(--text2)]'}`}
                    onClick={() => { if (isAuthenticated) { if (user?.email) localStorage.setItem('ohw_last_email', user.email); logout(); } }}
                  >
                    Local
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all
                      ${isAuthenticated 
                        ? 'bg-[var(--accent)] text-white shadow-md' 
                        : 'text-[var(--text3)] hover:text-[var(--text2)]'}`}
                    onClick={() => { if (!isAuthenticated) { const lastEmail = localStorage.getItem('ohw_last_email'); navigate('/login', { state: { email: lastEmail, from: window.location.pathname } }); } }}
                  >
                    Cloud
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* GAMIFICATION GUIDE PANEL */}
        {gamificationMode && gamPanelOpen && (
          <aside style={{
            width: 280, background: '#0a0d1a', borderLeft: '1px solid rgba(255,255,255,.07)',
            display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
              {[{ id: 'components', label: '🔧 Parts' }, { id: 'wiring', label: '〰 Wiring' }, { id: 'concepts', label: '📚 Code' }].map(tab => (
                <button key={tab.id} onClick={() => setGamTab(tab.id)} style={{
                  flex: 1, padding: '9px 4px', background: 'none', border: 'none',
                  borderBottom: `2px solid ${gamTab === tab.id ? '#00b4ff' : 'transparent'}`,
                  color: gamTab === tab.id ? '#00b4ff' : 'rgba(255,255,255,.4)',
                  fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>{tab.label}</button>
              ))}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 80px' }}>

              {gamTab === 'components' && (
                <div>
                  <div style={{
                    padding: '9px 12px', borderRadius: 9, marginBottom: 14,
                    background: gamAllUnlocked ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
                    border: `1px solid ${gamAllUnlocked ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
                    fontSize: 12, fontWeight: 600,
                    color: gamAllUnlocked ? '#22c55e' : '#ef4444',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {gamAllUnlocked ? '✅ All components unlocked' : `⚠️ ${gamLockedCount} need unlocking`}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {(gamProjectComponents || []).map((c, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '9px 11px', borderRadius: 9,
                        background: c.isLocked ? 'rgba(239,68,68,.05)' : 'rgba(34,197,94,.05)',
                        border: `1px solid ${c.isLocked ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.18)'}`,
                      }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{c.isLocked ? '🔒' : (c.compDef?.icon || '✅')}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: c.isLocked ? 'rgba(255,255,255,.45)' : '#fff' }}>
                            {c.qty > 1 ? `${c.qty}× ` : ''}{c.label}
                          </div>
                          <div style={{ fontSize: 9, color: c.isLocked ? '#ef4444' : '#22c55e', marginTop: 2 }}>
                            {c.isLocked ? 'Study theory to unlock' : 'Available in palette'}
                          </div>
                        </div>
                        {c.isLocked && c.compId && (
                          <button
                            onClick={() => navigate(`/components/${c.compId}/theory`)}
                            style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.35)', color: '#ef4444', borderRadius: 6, padding: '3px 7px', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                          >Unlock →</button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button onClick={() => navigate('/components')} style={{ marginTop: 16, width: '100%', padding: '9px', background: 'rgba(0,180,255,.06)', border: '1px solid rgba(0,180,255,.2)', color: '#00b4ff', borderRadius: 9, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    🔓 Unlock More Components
                  </button>
                </div>
              )}

              {gamTab === 'wiring' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {gamProject?.wiring?.length > 0 ? gamProject.wiring.map((w, i) => (
                    <div key={i} style={{ padding: '9px 11px', borderRadius: 8, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,180,255,.15)', border: '1px solid rgba(0,180,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#00b4ff', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>
                        <span style={{ color: '#00b4ff', fontFamily: 'monospace' }}>{w.from}</span>
                        <span style={{ color: 'rgba(255,255,255,.3)', margin: '0 5px' }}>→</span>
                        <span style={{ color: '#22c55e', fontFamily: 'monospace' }}>{w.to}</span>
                      </div>
                    </div>
                  )) : (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '32px 0' }}>No wiring guide yet.</div>
                  )}
                </div>
              )}

              {gamTab === 'concepts' && gamProject && (
                <div>
                  {gamProject.concepts?.length > 0 && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Concepts</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
                        {gamProject.concepts.map((c, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                            <span style={{ color: gamProject.color || '#22c55e', fontSize: 11 }}>▸</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', fontFamily: 'monospace' }}>{c}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {gamProject.starterCode && (
                    <>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Starter Code</div>
                      <div style={{ background: 'rgba(0,0,0,.4)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 9, padding: '11px', overflow: 'auto' }}>
                        <pre style={{ margin: 0, fontSize: 10, color: '#a5f3fc', lineHeight: 1.7, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>{gamProject.starterCode}</pre>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {gamProject && (
              <div style={{ flexShrink: 0, padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.07)', background: 'rgba(0,0,0,.3)' }}>
                <button
                  onClick={handleGamificationSubmit}
                  disabled={!gamAllUnlocked}
                  style={{ width: '100%', padding: '10px', background: gamAllUnlocked ? (gamProject.color || '#22c55e') : 'rgba(255,255,255,.05)', border: gamAllUnlocked ? 'none' : '1px solid rgba(255,255,255,.1)', color: gamAllUnlocked ? '#fff' : 'rgba(255,255,255,.25)', borderRadius: 9, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: gamAllUnlocked ? 'pointer' : 'not-allowed', marginBottom: 7 }}
                  title={gamAllUnlocked ? '' : `Unlock ${gamLockedCount} component${gamLockedCount > 1 ? 's' : ''} first`}
                >
                  {gamAllUnlocked ? '▶ Submit Assessment' : `🔒 Unlock ${gamLockedCount} first`}
                </button>
                <button onClick={() => navigate(`/${gamProject.slug}/guide`)} style={{ width: '100%', padding: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.35)', borderRadius: 9, fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  📖 Full Guide
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── SAVE DIALOG ──────────────────────────────────────────────────────── */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[360px] shadow-[0_8px_40px_rgba(0,0,0,.4)]" onClick={e => e.stopPropagation()}>
            <div className="text-base font-bold mb-3.5 text-[var(--text)]">Save Project</div>
            <input
              autoFocus
              className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-2.5 py-1.5 rounded-lg text-xs w-full mb-2 outline-none font-inherit box-border" style={{ marginBottom: 16, fontSize: 14, padding: '10px 12px' }}
              placeholder="Project name..."
              value={saveDialogName}
              onChange={e => setSaveDialogName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmSave(); if (e.key === 'Escape') setShowSaveDialog(false); }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowSaveDialog(false)}>Cancel</Btn>
              <Btn color="var(--accent)" onClick={handleConfirmSave}>Save</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── FIRMWARE DOWNLOAD DIALOG ─────────────────────────────────────── */}
      {showFirmwareDownloadDialog && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={() => setShowFirmwareDownloadDialog(false)}>
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[390px] shadow-[0_8px_40px_rgba(0,0,0,.4)]" onClick={e => e.stopPropagation()}>
            <div className="text-base font-bold mb-2 text-[var(--text)]">Download Firmware</div>
            <div className="text-xs text-[var(--text3)] mb-4">
              Choose a board firmware artifact to download, or download all compiled board firmwares.
            </div>

            <label className="text-xs font-semibold text-[var(--text2)] block mb-2">Target</label>
            <select
              className="w-full bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-3 py-2 rounded-lg text-sm mb-4"
              value={firmwareDownloadTarget}
              onChange={(e) => setFirmwareDownloadTarget(e.target.value)}
            >
              <option value="__latest__">Latest compiled firmware</option>
              {firmwareBoardOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
              <option value="__all__">All boards</option>
            </select>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowFirmwareDownloadDialog(false)}>Cancel</Btn>
              <Btn
                color="var(--accent)"
                onClick={async () => {
                  await handleDownloadFirmware(firmwareDownloadTarget || '__latest__');
                  setShowFirmwareDownloadDialog(false);
                }}
              >
                Download
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── FIRMWARE UPLOAD DIALOG ───────────────────────────────────────── */}
      {showFirmwareUploadDialog && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={() => setShowFirmwareUploadDialog(false)}>
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[420px] shadow-[0_8px_40px_rgba(0,0,0,.4)]" onClick={e => e.stopPropagation()}>
            <div className="text-base font-bold mb-2 text-[var(--text)]">Upload Firmware to Board</div>
            <div className="text-xs text-[var(--text3)] mb-4">
              Upload a firmware artifact for a specific board on canvas. Use <strong>.hex</strong> for Arduino/ESP32/STM32 and <strong>.uf2</strong> (or .hex) for RP2040.
              Uploaded firmware is used on the next simulation run for that board.
            </div>

            <label className="text-xs font-semibold text-[var(--text2)] block mb-2">Board target</label>
            <select
              className="w-full bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-3 py-2 rounded-lg text-sm mb-4"
              value={firmwareUploadTarget}
              onChange={(e) => setFirmwareUploadTarget(e.target.value)}
              disabled={firmwareBoardOptions.length === 0}
            >
              {firmwareBoardOptions.length === 0 ? (
                <option value="">No programmable board on canvas</option>
              ) : firmwareBoardOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>

            <input
              ref={firmwareUploadInputRef}
              type="file"
              accept=".hex,.uf2"
              style={{ display: 'none' }}
              onChange={(e) => setFirmwareUploadFile(e.target.files?.[0] || null)}
            />

            <div className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Btn onClick={() => firmwareUploadInputRef.current?.click()} disabled={firmwareBoardOptions.length === 0}>
                Choose Firmware File
              </Btn>
              <div className="text-xs text-[var(--text3)]" style={{ minHeight: 18 }}>
                {firmwareUploadFile?.name || 'No file selected'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowFirmwareUploadDialog(false)}>Cancel</Btn>
              <Btn
                color="var(--accent)"
                disabled={!firmwareUploadTarget || !firmwareUploadFile || isApplyingFirmwareUpload}
                onClick={applyUploadedFirmwareToBoard}
              >
                {isApplyingFirmwareUpload ? 'Applying...' : 'Upload & Use'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* F1 MENU */}
      {showF1Menu && (
        <div 
          className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]"
          onClick={() => setShowF1Menu(false)}
        >
          <div 
            className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[420px] shadow-[0_8px_40px_rgba(0,0,0,.4)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-base font-bold mb-4 text-[var(--text)]">Quick Actions (F1)</div>
            <div className="flex flex-col gap-2">
              <button 
                className="w-full px-4 py-3 text-left text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--card)] transition-colors text-[var(--text2)] hover:text-[var(--text)]"
                onClick={() => {
                  downloadSimulationJson();
                  setShowF1Menu(false);
                }}
              >
                🧾 Download Simulation JSON
              </button>
              <button 
                className="w-full px-4 py-3 text-left text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--card)] transition-colors text-[var(--text2)] hover:text-[var(--text)]"
                onClick={() => {
                  openFirmwareDownloadDialog();
                  setShowF1Menu(false);
                }}
              >
                📥 Download Firmware
              </button>
              <button 
                className="w-full px-4 py-3 text-left text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--card)] transition-colors text-[var(--text2)] hover:text-[var(--text)]"
                onClick={() => {
                  openFirmwareUploadDialog();
                  setShowF1Menu(false);
                }}
              >
                📤 Upload Firmware to Board
              </button>
              <button
                className="w-full px-4 py-3 text-left text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--card)] transition-colors text-[var(--text2)] hover:text-[var(--text)]"
                onClick={() => {
                  setRp2040DebugTelemetryEnabled((prev) => !prev);
                  setShowF1Menu(false);
                }}
              >
                {rp2040DebugTelemetryEnabled ? '🐞 Disable RP2040 dbg Telemetry' : '🐞 Enable RP2040 dbg Telemetry'}
              </button>
              <button 
                className="w-full px-4 py-3 text-left text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--card)] transition-colors text-[var(--text2)] hover:text-[var(--text)]"
                onClick={() => {
                  handleStartGDB();
                  setShowF1Menu(false);
                }}
              >
                🐛 Start GDB Session
              </button>
            </div>
            <button 
              className="mt-4 w-full px-3 py-2 text-xs text-[var(--text3)] hover:text-[var(--text)] transition-colors"
              onClick={() => setShowF1Menu(false)}
            >
              Close (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Project right-click context menu */}
      {projContextMenu && (
        <div
          className="fixed z-[9999] bg-[var(--bg2)] border border-[var(--border)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] min-w-[200px] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ left: projContextMenu.x, top: Math.min(projContextMenu.y, window.innerHeight - 240) }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-4 py-2.5 text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg)]/40 flex items-center justify-between">
            <span className="truncate mr-2">{projContextMenu.proj.name || 'Untitled Project'}</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/50" />
            </div>
          </div>
          
          <div className="p-1 flex flex-col gap-0.5">
            <button 
              className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-semibold text-[var(--text2)] hover:text-[var(--text)] rounded-lg transition-all hover:bg-[var(--card)] group"
              onClick={() => { toggleFavourite(projContextMenu.proj.id); setProjContextMenu(null); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={favouriteProjectIds.includes(projContextMenu.proj.id) ? "var(--orange, #f59e0b)" : "none"} stroke={favouriteProjectIds.includes(projContextMenu.proj.id) ? "var(--orange, #f59e0b)" : "currentColor"} strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              {favouriteProjectIds.includes(projContextMenu.proj.id) ? 'Unfavourite' : 'Favourite'}
            </button>
            
            <button 
              className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-semibold text-[var(--text2)] hover:text-[var(--text)] rounded-lg transition-all hover:bg-[var(--card)]"
              onClick={() => { handleCopyProject(projContextMenu.proj); setProjContextMenu(null); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Make a Copy
            </button>
            
            <button 
              className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-semibold text-[var(--text2)] hover:text-[var(--text)] rounded-lg transition-all hover:bg-[var(--card)]"
              onClick={() => { handleStartRename(projContextMenu.proj, { stopPropagation: () => {} }); setProjContextMenu(null); setProjectsSidebarTab('projects'); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Rename Project
            </button>
            
            <div className="h-px bg-[var(--border)] my-1 mx-2 opacity-50" />
            
            <button 
              className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-semibold text-red-500 hover:text-red-600 rounded-lg transition-all hover:bg-red-500/10"
              onClick={() => { handleDeleteProject(projContextMenu.proj.id); setProjContextMenu(null); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
              Delete Project
            </button>
          </div>
        </div>
      )}


    </div>
  )
}


    </div >
  )
}


