// Perf (bundle-split): thin re-export shim over ./emulatorLoader.js.
//
// History: this module statically imported the 17MB @openhw/emulator package
// (`import *`) AND eagerly inlined ~1.5MB of raw component sources via
// import.meta.glob — both landed in the initial SimulatorPage chunk. Now the
// emulator loads on demand; these bindings are live references to the loader's
// mutable slots (populated by ensureEmulatorRegistry() before first use), so
// ALL existing importers (hooks, utils, SimulatorPage) work unchanged.
//
// Pure helper functions (sortCatalog, buildCatalog, inject*, build*Source)
// are defined here and take explicit args — same behavior, no hidden imports.
import React from 'react';
import { toPascalCase, extractFunctionSource, resolveUiExport } from './simulatorUtils';
import { GROUP_MAPPING } from '../constants/simulatorConstants';
import {
  COMPONENT_REGISTRY,
  LOCAL_PIN_DEFS,
  BUILTIN_COMPONENT_TYPES,
  LOCAL_CATALOG,
  COMPONENT_RAW_SOURCES,
  collectRawComponentSources,
  ensureEmulatorRegistry,
  isEmulatorRegistryReady,
  getEmulator,
  preloadEmulator,
  sortCatalog as sortCatalogImpl,
} from './emulatorLoader';

export {
  COMPONENT_REGISTRY,
  LOCAL_PIN_DEFS,
  BUILTIN_COMPONENT_TYPES,
  LOCAL_CATALOG,
  COMPONENT_RAW_SOURCES,
  collectRawComponentSources,
  ensureEmulatorRegistry,
  isEmulatorRegistryReady,
  getEmulator,
  preloadEmulator,
};

export function sortCatalog(catalog) {
  return sortCatalogImpl(catalog);
}

export function normalizeGroupName(name, groupMapping = GROUP_MAPPING) {
  return groupMapping[name] || name;
}

export function buildCatalog(registry, groupMapping) {
  const catalog = [];
  Object.values(registry).forEach(module => {
    const manifest = module.manifest;
    if (!manifest || manifest.hiddenAlias) return;

    const groupName = normalizeGroupName(manifest.group || 'Misc', groupMapping);
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

      // ── Render-probe: catch stale/broken cached transpiled code before it ──
      // reaches React's render tree. If the component throws synchronously
      // (e.g. "can't access property BOUNDS, _constants is null"), we skip
      // this entry. The IDB DB_VERSION bump will evict the stale cache so the
      // next load fetches fresh, correct transpiled code automatically.
      try {
        const probeEl = React.createElement(uiComponent, {
          state: {}, attrs: {}, isRunning: false,
        });
        // Render-probe: call directly to catch stale transpiled reference errors
        if (typeof uiComponent === 'function') {
          uiComponent({ state: {}, attrs: {}, isRunning: false });
        }
      } catch (probeErr) {
        // If it throws a hook error, the component successfully ran up to the hook and is likely valid.
        if (probeErr.message && probeErr.message.includes('Invalid hook call')) {
          // Pass the probe safely
        } else {
          console.warn(`[ComponentCache] Skipping stale/broken cached component "${id}" (probe failed: ${probeErr.message}). Will re-fetch on next load.`);
          continue;
        }
      }

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

      const groupName = normalizeGroupName(manifest.group || 'Misc', groupMapping);
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
