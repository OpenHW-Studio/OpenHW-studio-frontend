// cache bust 1
let init: any;
let reset: any;
let ingestComponent: any;
let generateAutonomousSetup: any;
let generateCodeForComponent: any;

let isWasmInitialized = false;

// Board type patterns used to identify the MCU board via component ID or type
const BOARD_TYPE_PATTERNS = [
  'arduino-uno', 'arduino-nano', 'arduino-mega',
  'rp2040', 'pico', 'raspberry-pi-pico',
  'esp32', 'esp8266',
];

// Map types to ID patterns for components whose ID doesn't match (e.g. ID "uno1" type "wokwi-arduino-uno")
const BOARD_TYPE_TO_PATTERN: Record<string, string> = {};
for (const p of BOARD_TYPE_PATTERNS) {
  BOARD_TYPE_TO_PATTERN[p.replace(/[-_]/g, '')] = p;
}

/**
 * BFS through the wire graph from `compId:pinId` to find the connected board pin.
 * Handles passive components (resistors, breadboards) in the path.
 */
function resolveBoardPin(compId: string, pinId: string, wires: any[], components?: any[]): string | null {
  // Pre-compute board IDs by type if components are available
  const boardIdsByType = new Set<string>();
  if (components) {
    for (const c of components) {
      const type = (c.type || '').toLowerCase().replace(/[-_]/g, '');
      if (BOARD_TYPE_TO_PATTERN[type]) boardIdsByType.add(c.id);
    }
  }

  // Build adjacency from both wire directions
  const adj = new Map<string, string[]>();
  for (const w of wires) {
    const f = String(w.from || '');
    const t = String(w.to || '');
    if (!adj.has(f)) adj.set(f, []);
    adj.get(f)!.push(t);
    if (!adj.has(t)) adj.set(t, []);
    adj.get(t)!.push(f);
  }

  const start = `${compId}:${pinId}`;
  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const colon = node.indexOf(':');
    if (colon < 0) continue;
    const nodeComp = node.slice(0, colon);
    const nodePin  = node.slice(colon + 1);

    // Board pins are GND, 5V, 3V3, or numeric / A-prefixed pins
    const isBoardByPattern = nodeComp !== compId && BOARD_TYPE_PATTERNS.some(p => nodeComp.toLowerCase().includes(p));
    const isBoardByType = boardIdsByType.has(nodeComp);
    if ((nodeComp !== compId && isBoardByPattern) || isBoardByType) {
      const upper = nodePin.toUpperCase();
      if (upper === 'GND' || upper === '5V' || upper === '3V3' || upper === 'VIN') continue;
      return nodePin; // e.g. "13", "A0", "9"
    }

    const neighbors = adj.get(node) || [];
    for (const nb of neighbors) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }

  return null;
}

/**
 * Post-process a code snippet to extract globals from the manifest and
 * split them out of `setup` (the WASM engine may concatenate them).
 */
function extractGlobalsFromManifest(snippet: any, manifest: any): void {
  if (!snippet || !manifest?.autocoding) return;
  if (snippet.globals) return; // already set

  for (const variant of ['arduino', 'esp32', 'pico']) {
    const raw = manifest.autocoding[variant]?.globals;
    if (!raw) continue;
    snippet.globals = raw;
    // WASM sometimes concatenates globals into setup — remove them
    if (snippet.setup && snippet.setup.includes(raw)) {
      snippet.setup = snippet.setup.replace(raw, '').replace(/^\s*\n\s*/, '').trim();
    }
    break;
  }
}

/**
 * Post-process a code snippet to replace pin placeholders (e.g. `${A}`, `${PWM}`, `${IN}`)
 * with the actual board pin number found by tracing the wire graph.
 */
function resolvePinPlaceholders(snippet: any, compId: string, wires: any[], components: any[]): any {
  const pinPattern = /\$\{([A-Z][A-Z0-9_]*)\}/g;

  for (const key of ['globals', 'setup', 'loop']) {
    if (!snippet[key]) continue;
    snippet[key] = snippet[key].replace(pinPattern, (match: string, pinId: string) => {
      const resolved = resolveBoardPin(compId, pinId, wires, components);
      return resolved !== null ? resolved : match;
    });
  }

  return snippet;
}

/**
 * Replace remaining `${ATTR_NAME}` placeholders with values from manifest.attrs.
 * Runs after pin resolution so already-resolved pins are left alone.
 * Uses a permissive regex matching any alphanumeric/underscore name so camelCase
 * attribute names like `icType` are also caught.
 */
function resolveAttributePlaceholders(snippet: any, manifest: any): any {
  const attrs = manifest?.attrs || {};
  const attrPattern = /\$\{(\w+)\}/g;

  for (const key of ['globals', 'setup', 'loop']) {
    if (!snippet[key]) continue;
    snippet[key] = snippet[key].replace(attrPattern, (match: string, attrName: string) => {
      if (attrs[attrName] !== undefined) {
        return String(attrs[attrName]);
      }
      return match;
    });
  }

  return snippet;
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;

    try {
    if (!isWasmInitialized) {
      console.log('[AutowiringWorker] Dynamically importing WASM wrapper...');
      const mod = await import('../wasm/autowiring/openhw_studio_autowiring_engine.js');
      init = mod.default || mod;
      reset = mod.reset;
      ingestComponent = mod.ingestComponent;
      generateAutonomousSetup = mod.generateAutonomousSetup;
      generateCodeForComponent = mod.generateCodeForComponent;

      console.log('[AutowiringWorker] Initializing WASM...');
      await init();
      isWasmInitialized = true;
      console.log('[AutowiringWorker] WASM Initialized successfully.');
    }

    console.log('[AutowiringWorker] Received message:', type, payload);

    switch (type) {
      case 'GENERATE_AUTONOMOUS_SETUP': {
        let { components, wires, newComp, manifest, boardId, allowBreadboard, isRewire } = payload;
        
        reset();
        
        // Ingest current state
        components.forEach((c: any) => {
          const pins = payload.pinDefs?.[c.type] || [];
          ingestComponent(c.id, c.type, c.x, c.y, c.w || 40, c.h || 40, pins);
        });

        // Ingest the target component
        const newPins = payload.pinDefs?.[newComp.type] || [];
        ingestComponent(newComp.id, newComp.type, newComp.x, newComp.y, newComp.w || 40, newComp.h || 40, newPins);

        // Generate the autonomous plan
        // Rust engine now handles boardId selection if empty AND re-wiring cleanup if isRewire is true
        const plan = generateAutonomousSetup(newComp, manifest, boardId || '', wires || [], allowBreadboard || false, !!isRewire);
        
        if (typeof plan === 'string') {
          throw new Error(plan);
        }

        // Forward library dependencies from manifest
        if (manifest?.autocoding?.libraries) {
            plan.libraries = manifest.autocoding.libraries;
        }

        // Post-process: replace placeholders the WASM engine left unresolved
        if (plan && plan.code_snippet && typeof plan.code_snippet === 'object') {
          extractGlobalsFromManifest(plan.code_snippet, manifest);
          ['globals', 'setup', 'loop'].forEach(key => {
            if (plan.code_snippet[key]) {
              plan.code_snippet[key] = plan.code_snippet[key].replace(/\$\{COMP_SUFFIX\}/g, newComp.id);
            }
          });
          resolvePinPlaceholders(plan.code_snippet, newComp.id, wires || [], components || []);
          console.log('[AutowiringWorker] Before attr resolve:', plan.code_snippet?.setup);
          resolveAttributePlaceholders(plan.code_snippet, manifest);
          console.log('[AutowiringWorker] After attr resolve:', plan.code_snippet?.setup);
          console.log('[AutowiringWorker] manifest.attrs:', JSON.stringify(manifest?.attrs));
        }

        console.log('[AutowiringWorker] Generated Plan:', plan);
        console.log('[AutowiringWorker] Resolved setup:', plan.code_snippet?.setup);
        console.log('[AutowiringWorker] Resolved loop:', plan.code_snippet?.loop);
        self.postMessage({ type: 'AUTONOMOUS_RESULT', payload: plan });
        break;
      }

      case 'GENERATE_CODE_SNIPPET': {
        let { compId, wires, manifest, components } = payload;
        
        reset(); // reset engine state just in case, though this pure function might not strictly need it
        
        const snippet = generateCodeForComponent(compId, wires || [], manifest, components || []);
        
        // Post-process: replace placeholders the WASM engine left unresolved
        if (snippet && typeof snippet === 'object') {
          extractGlobalsFromManifest(snippet, manifest);
          ['globals', 'setup', 'loop'].forEach(key => {
            if (snippet[key]) {
              snippet[key] = snippet[key].replace(/\$\{COMP_SUFFIX\}/g, compId);
            }
          });
          resolvePinPlaceholders(snippet, compId, wires || [], components || []);
          console.log('[AutowiringWorker] Before attr resolve:', snippet?.setup);
          resolveAttributePlaceholders(snippet, manifest);
          console.log('[AutowiringWorker] After attr resolve:', snippet?.setup);
          console.log('[AutowiringWorker] manifest.attrs:', JSON.stringify(manifest?.attrs));
        }
        
        let plan: any = { code_snippet: snippet };
        if (manifest?.autocoding?.libraries) {
            plan.libraries = manifest.autocoding.libraries;
        }

        console.log('[AutowiringWorker] Generated Code Snippet:', snippet);
        self.postMessage({ type: 'AUTONOMOUS_RESULT', payload: plan });
        break;
      }

      default:
        console.warn('[AutowiringWorker] Unknown message type:', type);
    }
  } catch (err) {
    console.error('[AutowiringWorker] Error:', err);
    self.postMessage({ type: 'ERROR', payload: String(err) });
  }
};
