// Perf (bundle-split): single lazy entry point for the @openhw/emulator
// package (17MB src: ~100 component logic+UI modules + circuit-validation +
// protocol-handlers). It used to ride the SimulatorPage chunk statically via
// `import *`, costing ~843KB of blocking JS before the simulator could paint.
//
// Design:
// - getEmulator() dynamically imports the package ONCE (cached promise) and
//   returns the namespace. Vite splits it into its own chunk loaded on demand.
// - The simulator route starts loading it immediately on mount (idle-time
//   preload in SimulatorPage) so it is warm before the user hits Run — but it
//   never blocks first paint.
// - Mutable registry slots (COMPONENT_REGISTRY etc.) are filled by
//   ensureEmulatorRegistry() and then RE-EXPORTED BY REFERENCE so existing
//   importers (hooks, utils, SimulatorPage) keep working with zero changes:
//   the objects are empty at module-eval time and populated before first use.
// - Validation entry points (FullCircuitValidator, runUnifiedValidation, …)
//   resolve through the same loader with a clear error if called too early
//   (UI gates Run behind registry-ready state).

let emulatorPromise = null;

export const getEmulator = () => {
  if (!emulatorPromise) {
    emulatorPromise = import('@openhw/emulator');
  }
  return emulatorPromise;
};

// Prefetch without awaiting — call on simulator route mount / hover of Run.
export const preloadEmulator = () => {
  try {
    getEmulator().catch(() => {});
  } catch (_) {}
};

// ---- Mutable registry slots (populated by ensureEmulatorRegistry) ---------
// These are the SAME object identities importers hold; we mutate in place so
// no importer needs to re-import after load.
export const COMPONENT_REGISTRY = {};
export const LOCAL_PIN_DEFS = {};
export const BUILTIN_COMPONENT_TYPES = new Set();
export const LOCAL_CATALOG = [];
export const COMPONENT_RAW_SOURCES = {};

let registryPromise = null;

export const ensureEmulatorRegistry = () => {
  if (!registryPromise) {
    registryPromise = (async () => {
      const [{ GROUP_MAPPING }, emulator, rawSources] = await Promise.all([
        import('../constants/simulatorConstants.js'),
        getEmulator(),
        collectRawComponentSources(),
      ]);
      Object.assign(COMPONENT_RAW_SOURCES, rawSources);
      buildRegistryInto(emulator, COMPONENT_RAW_SOURCES, {
        COMPONENT_REGISTRY,
        LOCAL_PIN_DEFS,
        BUILTIN_COMPONENT_TYPES,
        LOCAL_CATALOG,
      }, GROUP_MAPPING);
      return emulator;
    })();
  }
  return registryPromise;
};

export const isEmulatorRegistryReady = () =>
  BUILTIN_COMPONENT_TYPES.size > 0;

// ---- Lazy raw-source collection (was: eager import.meta.glob at module top)
// import.meta.glob itself is compile-time, but marking it inside a function
// keeps the raw text blobs out of the initial module graph evaluation path
// and next to the registry build that consumes them.
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

// Registry builder parameterized by the emulator namespace (was inline in
// componentRegistry.js closing over the static `import *`). Logic identical.
export function buildRegistryInto(EmulatorComponents, rawSources, slots, groupMapping) {
  const { COMPONENT_REGISTRY, LOCAL_PIN_DEFS, BUILTIN_COMPONENT_TYPES, LOCAL_CATALOG } = slots;
  const registry = COMPONENT_REGISTRY;
  const pinDefs = LOCAL_PIN_DEFS;

  Object.entries(EmulatorComponents).forEach(([key, module]) => {
    if (key === 'BaseComponent') return;

    if (module && module.manifest) {
      const compId = module.manifest.type || module.manifest.id || key;
      const raw = rawSources[compId] || rawSources[key] || rawSources[compId.replace('openhw-', 'wokwi-')];
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

  Object.values(EmulatorComponents)
    .filter((m) => m && m.manifest)
    .map((m) => m.manifest.type || m.manifest.id)
    .filter(Boolean)
    .forEach((t) => BUILTIN_COMPONENT_TYPES.add(t));

  const catalog = buildCatalog(registry, groupMapping);
  LOCAL_CATALOG.length = 0;
  catalog.forEach((g) => LOCAL_CATALOG.push(g));
}

// Local catalog builder (groupMapping passed in from simulatorConstants so
// the loader itself stays free of extra static imports).
export function buildCatalog(registry, groupMapping) {
  const catalog = [];
  Object.values(registry).forEach((module) => {
    const manifest = module.manifest;
    if (!manifest || manifest.hiddenAlias) return;

    const groupName = groupMapping ? groupMapping[manifest.group || 'Misc'] || (manifest.group || 'Misc') : (manifest.group || 'Misc');
    let group = catalog.find((g) => g.group === groupName);
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

export function sortCatalog(catalog) {
  const GROUP_ORDER = ['Boards', 'Board Variants', 'Basic', 'Display', 'Input', 'Sensor', 'Output', 'Actuators', 'Misc', 'Logic'];
  catalog.sort((a, b) => {
    const groupA = String(a?.group || 'Misc');
    const groupB = String(b?.group || 'Misc');
    const idxA = GROUP_ORDER.indexOf(groupA);
    const idxB = GROUP_ORDER.indexOf(groupB);
    if (idxA === -1 && idxB === -1) return groupA.localeCompare(groupB);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}
