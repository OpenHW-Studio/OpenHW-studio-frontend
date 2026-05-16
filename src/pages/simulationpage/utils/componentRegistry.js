import React from 'react';
import * as EmulatorComponents from "@openhw/emulator";
import { toPascalCase, extractFunctionSource, resolveUiExport } from './simulatorUtils';
import { GROUP_MAPPING } from '../constants/simulatorConstants';

export function collectRawComponentSources() {
  const rawFiles = {
    ...import.meta.glob('../../../../../openhw-studio-emulator/src/components/*/ui.tsx?raw', { eager: true, import: 'default' }),
    ...import.meta.glob('../../../../../openhw-studio-emulator/src/components/*/logic.ts?raw', { eager: true, import: 'default' }),
    ...import.meta.glob('../../../../../openhw-studio-emulator/src/components/*/validation.ts?raw', { eager: true, import: 'default' }),
    ...import.meta.glob('../../../../../openhw-studio-emulator/src/components/*/index.ts?raw', { eager: true, import: 'default' }),
    ...import.meta.glob('../../../../../openhw-studio-emulator/src/components/*/doc/index.html?raw', { eager: true, import: 'default' }),
  };

  const out = {};
  Object.entries(rawFiles).forEach(([filePath, raw]) => {
    const normalized = String(filePath || '').replace(/\\/g, '/').replace(/\?raw$/, '');
    const match = normalized.match(/\/components\/([^/]+)\/(.+)$/);
    if (!match) return;

    const [, componentType, leaf] = match;
    if (!out[componentType]) out[componentType] = {};
    const text = String(raw || '');

    if (leaf === 'ui.tsx') out[componentType].uiRaw = text;
    if (leaf === 'logic.ts') out[componentType].logicRaw = text;
    if (leaf === 'validation.ts') out[componentType].validationRaw = text;
    if (leaf === 'index.ts') out[componentType].indexRaw = text;
    if (leaf === 'doc/index.html') out[componentType].docRaw = text;
  });

  return out;
}

export const COMPONENT_RAW_SOURCES = collectRawComponentSources();

export function buildComponentRegistry() {
  const registry = {};
  const pinDefs = {};

  Object.entries(EmulatorComponents).forEach(([key, module]) => {
    if (key === 'BaseComponent') return;

    if (module && module.manifest) {
      const compId = module.manifest.type || module.manifest.id || key;
      const raw = COMPONENT_RAW_SOURCES[compId] || COMPONENT_RAW_SOURCES[key] || COMPONENT_RAW_SOURCES[compId.replace('openhw-', 'wokwi-')];
      registry[compId] = raw
        ? {
          ...module,
          ...raw,
          ...(raw.docRaw ? { doc: raw.docRaw } : {}),
        }
        : module;

      if (module.manifest.pins) {
        pinDefs[compId] = module.manifest.pins;
      }

      if (compId.startsWith('openhw-')) {
        const legacyId = compId.replace('openhw-', 'wokwi-');
        if (!registry[legacyId]) {
          registry[legacyId] = raw
            ? {
              ...module,
              ...raw,
              manifest: { ...module.manifest, type: legacyId, hiddenAlias: true },
              ...(raw.docRaw ? { doc: raw.docRaw } : {}),
            }
            : { ...module, manifest: { ...module.manifest, type: legacyId, hiddenAlias: true } };
          if (module.manifest.pins) {
            pinDefs[legacyId] = module.manifest.pins;
          }
        }
      } else if (compId.startsWith('wokwi-')) {
        const modernId = compId.replace('wokwi-', 'openhw-');
        if (!registry[modernId]) {
          registry[modernId] = raw
            ? {
              ...module,
              ...raw,
              manifest: { ...module.manifest, type: modernId, hiddenAlias: true },
              ...(raw.docRaw ? { doc: raw.docRaw } : {}),
            }
            : { ...module, manifest: { ...module.manifest, type: modernId, hiddenAlias: true } };
          if (module.manifest.pins) {
            pinDefs[modernId] = module.manifest.pins;
          }
        }
      }
    }
  });

  // Compatibility aliases
  const neopixelBaseModule = registry['wokwi-neopixel-matrix'];
  if (neopixelBaseModule?.manifest) {
    ['wokwi-ws2812b', 'wokwi-ws2821b'].forEach((aliasType) => {
      if (registry[aliasType]) return;
      registry[aliasType] = {
        ...neopixelBaseModule,
        manifest: {
          ...neopixelBaseModule.manifest,
          type: aliasType,
          hiddenAlias: true,
        },
      };
    });
  }

  return { registry, pinDefs };
}

export const { registry: COMPONENT_REGISTRY, pinDefs: LOCAL_PIN_DEFS } = buildComponentRegistry();

export const BUILTIN_COMPONENT_TYPES = new Set(
  Object.values(EmulatorComponents)
    .filter(m => m && m.manifest)
    .map(m => m.manifest.type || m.manifest.id)
    .filter(Boolean)
);

export const LOCAL_CATALOG = buildCatalog(COMPONENT_REGISTRY, GROUP_MAPPING);

export function sortCatalog(catalog) {
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

function normalizeGroupName(name, groupMapping) {
  return groupMapping[name] || name;
}

export function buildCatalog(registry, groupMapping) {
  const catalog = [];
  Object.values(registry).forEach(module => {
    const manifest = module.manifest;
    if (!manifest || manifest.hiddenAlias) return;

    const groupName = normalizeGroupName(manifest.group, groupMapping);
    let group = catalog.find(g => g.group === groupName);
    if (!group) {
      group = { group: groupName, items: [] };
      catalog.push(group);
    }

    const { pins: _pins, group: _, ...catalogItem } = manifest;
    group.items.push(catalogItem);
  });
  sortCatalog(catalog);
  return catalog;
}

export function injectComponentsIntoRegistry(comps) {
  const registry = COMPONENT_REGISTRY;
  const pinDefs = LOCAL_PIN_DEFS;
  const builtinTypes = BUILTIN_COMPONENT_TYPES;
  const catalog = LOCAL_CATALOG;
  const groupMapping = GROUP_MAPPING;

  for (const comp of comps) {
    const { id, manifest, transpiledUI, transpiledLogic, uiRaw, logicRaw, validationRaw, indexRaw } = comp;
    if (!manifest || !transpiledUI) continue;

    if (builtinTypes.has(manifest.type)) continue;
    try {
      const exportsUI = {};
      const evalUI = new Function('exports', 'require', 'React', transpiledUI);
      evalUI(exportsUI, (mod) => {
        if (mod === 'react') return React;
        if (mod.endsWith('manifest.json')) return manifest;
        return null;
      }, React);

      const uiComponent = resolveUiExport(exportsUI);
      if (!uiComponent) continue;

      registry[manifest.type] = {
        manifest,
        UI: uiComponent,
        BOUNDS: exportsUI.BOUNDS,
        ContextMenu: exportsUI[Object.keys(exportsUI).find(k => k.toLowerCase().includes('contextmenu'))] || null,
        contextMenuDuringRun: !!(exportsUI.contextMenuDuringRun || manifest.contextMenuDuringRun),
        contextMenuOnlyDuringRun: !!(exportsUI.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun),
        logicCode: transpiledLogic,
        uiRaw: uiRaw || '',
        logicRaw: logicRaw || '',
        validationRaw: validationRaw || '',
        indexRaw: indexRaw || '',
        isDynamic: true,
      };

      if (manifest.pins) pinDefs[manifest.type] = manifest.pins;

      const groupName = normalizeGroupName(manifest.group, groupMapping);
      let group = catalog.find(g => g.group === groupName);
      if (!group) { group = { group: groupName, items: [] }; catalog.push(group); }
      group.items = group.items.filter(i => i.type !== manifest.type);
      const { pins: _p, group: _g, ...catalogItem } = manifest;
      group.items.push(catalogItem);
    } catch (err) {
      console.warn(`[ComponentCache] Failed to inject component ${id}:`, err);
    }
  }
  sortCatalog(catalog);
}



export function buildUiSourceFromRegistry(registryInfo, fallbackType) {
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

export function buildLogicSourceFromRegistry(registryInfo, fallbackType) {
  if (registryInfo?.logicRaw) return registryInfo.logicRaw;

  const logicClassSrc = extractFunctionSource(registryInfo?.LogicClass);
  if (logicClassSrc.startsWith('class ')) {
    return `import { BaseComponent } from '../BaseComponent';\n\nexport ${logicClassSrc}\n`;
  }

  const name = toPascalCase(registryInfo?.manifest?.type || fallbackType || 'component');
  return `import { BaseComponent } from '../BaseComponent';\n\nexport class ${name}Logic extends BaseComponent {\n  reset() {}\n  update() {}\n}\n`;
}

export function buildValidationSourceFromRegistry(registryInfo) {
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

export function buildIndexSourceFromRegistry(registryInfo, fallbackType) {
  if (registryInfo?.indexRaw) return registryInfo.indexRaw;
  const manifest = registryInfo?.manifest || {};
  const name = toPascalCase(manifest.type || fallbackType || 'component');
  const hasCtxMenu = typeof registryInfo?.ContextMenu === 'function';
  const hasDuringRun = !!(registryInfo?.contextMenuDuringRun || manifest.contextMenuDuringRun);
  const hasOnlyDuringRun = !!(registryInfo?.contextMenuOnlyDuringRun || manifest.contextMenuOnlyDuringRun);

  return `import manifest from './manifest.json';\nimport { ${name}UI, BOUNDS${hasDuringRun ? ', contextMenuDuringRun' : ''}${hasOnlyDuringRun ? ', contextMenuOnlyDuringRun' : ''}${hasCtxMenu ? ', ContextMenu' : ''} } from './ui';\nimport { ${name}Logic } from './logic';\nimport { validation } from './validation';\n\nexport default {\n  manifest,\n  UI: ${name}UI,\n  LogicClass: ${name}Logic,\n  BOUNDS,\n  validation,${hasCtxMenu ? '\n  ContextMenu,' : ''}${hasDuringRun ? '\n  contextMenuDuringRun,' : ''}${hasOnlyDuringRun ? '\n  contextMenuOnlyDuringRun,' : ''}\n};\n`;
}
