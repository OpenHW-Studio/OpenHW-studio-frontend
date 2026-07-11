// Autofix Worker v3.0 — powered by the Autowire WASM engine
// Strategy: for each violation, BFS to find board pin + helper components,
// tear them all down, then let the autowire engine reconnect correctly.

let wasmInit: any;
let wasmReset: any;
let wasmIngestComponent: any;
let wasmGenerateAutonomousSetup: any;

let isWasmInitialized = false;

// ─── Board / Passive component patterns ─────────────────────────────────────

const BOARD_TYPE_PATTERNS = [
  'arduino-uno', 'arduino-nano', 'arduino-mega',
  'rp2040', 'pico', 'raspberry-pi-pico',
  'esp32', 'esp8266',
];

// Passive components whose internal pins are electrically connected
// (BFS traverses through these transparently)
const PASSIVE_THROUGH: Record<string, [string, string][]> = {
  'openhw-resistor':    [['p1', 'p2'], ['1', '2']],
  'wokwi-resistor':     [['p1', 'p2'], ['1', '2']],
  'openhw-led':         [['A', 'K']],
  'wokwi-led':          [['A', 'K']],
  'openhw-pushbutton':  [['1l', '1r'], ['2l', '2r']],
  'wokwi-pushbutton':   [['1l', '1r'], ['2l', '2r']],
};

// Types considered "helper" components (passives, converters)
const HELPER_TYPE_PATTERNS = [
  'resistor', 'capacitor', 'inductor',
  'logic-level-shifter', 'level-shifter', 'level-converter',
  'transistor', 'mosfet', 'bjt',
  'diode', 'zener',
];

function isHelperType(type: string): boolean {
  const t = (type || '').toLowerCase();
  return HELPER_TYPE_PATTERNS.some(p => t.includes(p));
}

function isBoardType(type: string): boolean {
  const t = (type || '').toLowerCase().replace(/[-_]/g, '');
  return BOARD_TYPE_PATTERNS.some(p => t.includes(p.replace(/[-_]/g, '')));
}

// ─── BFS Utilities ──────────────────────────────────────────────────────────

type Wire = { from: string; to: string; color?: string; id?: string };
type Component = { id: string; type: string; x: number; y: number; w?: number; h?: number; rotation?: number; [key: string]: any };

/**
 * Build a bidirectional adjacency map from a wire list.
 * Each key is a "compId:pinId" node; values are connected nodes.
 */
function buildAdj(wires: Wire[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const w of wires) {
    const f = String(w.from || '');
    const t = String(w.to || '');
    if (!f || !t) continue;
    if (!adj.has(f)) adj.set(f, []);
    if (!adj.has(t)) adj.set(t, []);
    adj.get(f)!.push(t);
    adj.get(t)!.push(f);
  }
  return adj;
}

/**
 * BFS from `compId:pinId` through the wire graph.
 * Crosses through passive components transparently.
 * Returns the board pin string (e.g. "13", "A0") when an MCU pin is reached,
 * or null if no board pin found.
 */
function resolveBoardPin(
  compId: string,
  pinId: string,
  wires: Wire[],
  components: Component[],
): string | null {
  // Build type lookup
  const compTypeById = new Map<string, string>();
  const boardIds = new Set<string>();
  for (const c of components) {
    compTypeById.set(c.id, c.type || '');
    if (isBoardType(c.type)) boardIds.add(c.id);
  }

  const adj = buildAdj(wires);
  const start = `${compId}:${pinId}`;
  const visited = new Set<string>([start]);
  const queue: string[] = [start];

  while (queue.length > 0) {
    const node = queue.shift()!;
    const colon = node.indexOf(':');
    if (colon < 0) continue;
    const nodeComp = node.slice(0, colon);
    const nodePin  = node.slice(colon + 1);

    // Found a board pin (not a power rail)
    if (nodeComp !== compId && boardIds.has(nodeComp)) {
      const upper = nodePin.toUpperCase();
      if (upper === 'GND' || upper === '5V' || upper === '3V3' || upper === 'VIN') continue;
      return nodePin;
    }

    // Follow wire connections
    for (const nb of (adj.get(node) || [])) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }

    // Traverse through passive component internals
    const cType = compTypeById.get(nodeComp);
    if (cType) {
      const pairs = PASSIVE_THROUGH[cType];
      if (pairs) {
        for (const [a, b] of pairs) {
          const other = a === nodePin ? b : b === nodePin ? a : null;
          if (other) {
            const otherNode = `${nodeComp}:${other}`;
            if (!visited.has(otherNode)) {
              visited.add(otherNode);
              queue.push(otherNode);
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * Find all component IDs reachable from `startCompId` through the wire graph.
 * Returns a Set of component ID strings.
 */
function findSubgraphCompIds(
  startCompId: string,
  wires: Wire[],
): Set<string> {
  const adj = buildAdj(wires);
  const visited = new Set<string>();
  const compIds = new Set<string>([startCompId]);
  
  // Seed queue with all nodes of the start component
  const queue: string[] = [];
  for (const [node] of adj) {
    if (node.startsWith(`${startCompId}:`)) {
      if (!visited.has(node)) {
        visited.add(node);
        queue.push(node);
      }
    }
  }

  while (queue.length > 0) {
    const node = queue.shift()!;
    const colon = node.indexOf(':');
    if (colon >= 0) {
      compIds.add(node.slice(0, colon));
    }
    for (const nb of (adj.get(node) || [])) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return compIds;
}

/**
 * Find helper components that exclusively serve the broken component's circuit.
 * A helper is: reachable from brokenComp, is a passive/converter type,
 * and ALL its wires are internal to the subgraph (it connects nothing outside).
 *
 * Returns { helperIds, relatedWires } where relatedWires includes all wires
 * touching the broken component or any of its helpers.
 */
function findHelpers(
  brokenCompId: string,
  allComponents: Component[],
  allWires: Wire[],
): { helperIds: string[]; relatedWires: Wire[] } {
  const boardIds = new Set(allComponents.filter(c => isBoardType(c.type)).map(c => c.id));
  const subgraphCompIds = findSubgraphCompIds(brokenCompId, allWires);

  // Confirm helpers: in subgraph, passive type, no wires to outside
  const helperIds: string[] = [];
  for (const candidateId of subgraphCompIds) {
    if (candidateId === brokenCompId) continue;
    if (boardIds.has(candidateId)) continue;

    const comp = allComponents.find(c => c.id === candidateId);
    if (!comp || !isHelperType(comp.type)) continue;

    // Check all wires of this candidate stay inside the subgraph
    const candidateWires = allWires.filter(w =>
      w.from.startsWith(`${candidateId}:`) || w.to.startsWith(`${candidateId}:`)
    );
    const allInternal = candidateWires.every(w => {
      const fComp = w.from.split(':')[0];
      const tComp = w.to.split(':')[0];
      return subgraphCompIds.has(fComp) && subgraphCompIds.has(tComp);
    });

    if (allInternal) {
      helperIds.push(candidateId);
    }
  }

  // Collect all wires touching brokenComp or any helper
  const affected = new Set([brokenCompId, ...helperIds]);
  const relatedWires = allWires.filter(w => {
    const fComp = w.from.split(':')[0];
    const tComp = w.to.split(':')[0];
    return affected.has(fComp) || affected.has(tComp);
  });

  return { helperIds, relatedWires };
}

/**
 * Find the MCU board component ID.
 */
function findBoardId(components: Component[]): string | null {
  const board = components.find(c => isBoardType(c.type));
  return board?.id || null;
}

// ─── WASM Initialization ────────────────────────────────────────────────────

async function initWasm() {
  if (isWasmInitialized) return;
  console.log('[AutofixWorker v3] Loading autowire WASM engine...');
  const mod = await import('../wasm/autowiring/openhw_studio_autowiring_engine.js');
  wasmInit = mod.default || mod;
  wasmReset = mod.reset;
  wasmIngestComponent = mod.ingestComponent;
  wasmGenerateAutonomousSetup = mod.generateAutonomousSetup;
  await wasmInit();
  isWasmInitialized = true;
  console.log('[AutofixWorker v3] Autowire WASM engine ready.');
}

// ─── Message Handler ─────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    // Lazy-init WASM on first use
    if (!isWasmInitialized) {
      await initWasm();
    }

    if (type === 'analyze') {
      await handleAnalyze(payload);
    }

  } catch (err) {
    console.error('[AutofixWorker v3] Error:', err);
    self.postMessage({
      type: 'results',
      payload: { planCount: 0, suggestions: [] },
    });
  }
};

async function handleAnalyze(payload: any) {
  const {
    diagram,
    violations,
    pinDefs,    // componentType → pins[]
    registry,   // componentType → { manifest, ... }
  } = payload;

  const originalComponents: Component[] = diagram?.components || [];
  const originalConnections: Wire[]     = diagram?.connections || [];

  if (!violations || violations.length === 0) {
    self.postMessage({ type: 'results', payload: { planCount: 0, suggestions: [] } });
    return;
  }

  self.postMessage({ type: 'status', payload: `🔍 Analyzing ${violations.length} violation(s) with autowire engine...` });

  let currentComponents = [...originalComponents];
  let currentWires      = [...originalConnections];
  const suggestions: any[] = [];

  for (const violation of violations) {
    const ruleId  = violation.ruleId || violation.id || 'unknown';
    const msg     = (violation.message || '').toLowerCase();
    const rawIds  = violation.componentIds || violation.compIds || [];
    const compIds = Array.isArray(rawIds) ? rawIds : [rawIds];
    const brokenCompId = compIds[0];

    console.log(`[AutofixWorker v3] Processing violation: [${ruleId}] ${violation.message}`);

    // ── Special case: Short circuit — just remove the wire ──────────────────
    if (ruleId === 'validateShortCircuits' || msg.includes('short circuit')) {
      const shortWire = currentWires.find(w => {
        const fUp = (w.from || '').toUpperCase();
        const tUp = (w.to || '').toUpperCase();
        const fIsVcc = fUp.includes('5V') || fUp.includes('VCC') || fUp.includes('3V3');
        const tIsGnd = tUp.includes('GND');
        const tIsVcc = tUp.includes('5V') || tUp.includes('VCC') || tUp.includes('3V3');
        const fIsGnd = fUp.includes('GND');
        return (fIsVcc && tIsGnd) || (tIsVcc && fIsGnd);
      });

      if (shortWire) {
        suggestions.push({
          description: 'Remove short circuit wire',
          targetRuleId: ruleId,
          addedComponents: [],
          addedWires: [],
          removedComponents: [],
          removedWires: [{ from: shortWire.from, to: shortWire.to }],
          transformations: [],
          reasoning: [
            `Violation: ${violation.message}`,
            'Detected direct VCC→GND short circuit wire.',
            'Removing the offending wire.',
          ],
          confidence: 1.0,
        });
        currentWires = currentWires.filter(w => w !== shortWire);
      }
      continue;
    }

    // ── Informational-only violations (no structural fix) ───────────────────
    const infoOnly = [
      'validateDuplicateI2CAddress', 'validatePowerDissipation',
      'validateTotalPowerBudget', 'validateThermalLimits',
      'validateBatteryLife', 'validateVoltageDrops',
      'validateDeadlocks', 'validateSignalIntegrity',
      'validateCrossComponentInteractions', 'validateSerialPinConflict',
      'validateI2CDeviceWithoutMcu',
    ];
    if (infoOnly.includes(ruleId)) {
      suggestions.push({
        description: `ℹ️ ${violation.message}`,
        targetRuleId: ruleId,
        addedComponents: [], addedWires: [], removedComponents: [],
        removedWires: [], transformations: [],
        reasoning: [violation.message, 'This violation requires manual review.'],
        confidence: 0.0,
      });
      continue;
    }

    // ── Main path: rewire using autowire engine ──────────────────────────────
    if (!brokenCompId) continue;

    const brokenComp = currentComponents.find(c => c.id === brokenCompId);
    if (!brokenComp) {
      console.warn(`[AutofixWorker v3] Component not found: ${brokenCompId}`);
      continue;
    }

    const boardId = findBoardId(currentComponents);
    if (!boardId) {
      console.warn('[AutofixWorker v3] No board found in circuit.');
      continue;
    }

    // Manifest for the broken component
    const manifest = registry?.[brokenComp.type]?.manifest || {};

    // Step 1: BFS — find which board pin the component is connected to
    const compPinDefs: any[] = pinDefs?.[brokenComp.type] || [];
    let resolvedBoardPin: string | null = null;
    for (const pin of compPinDefs) {
      const bp = resolveBoardPin(brokenCompId, pin.id, currentWires, currentComponents);
      if (bp) { resolvedBoardPin = bp; break; }
    }
    console.log(`[AutofixWorker v3] Resolved board pin for ${brokenCompId}: ${resolvedBoardPin || '(not found)'}`);

    // Step 2: Find helper components and all related wires
    const { helperIds, relatedWires } = findHelpers(brokenCompId, currentComponents, currentWires);
    console.log(`[AutofixWorker v3] Helpers to remove for ${brokenCompId}:`, helperIds);
    console.log(`[AutofixWorker v3] Related wires to remove:`, relatedWires.length);

    // Step 3: Build cleaned state (strip broken component's circuit)
    const cleanedWires = currentWires.filter(w => !relatedWires.includes(w));
    const cleanedComponents = currentComponents.filter(c => !helperIds.includes(c.id));

    // Step 4: Ingest cleaned state into autowire engine
    self.postMessage({ type: 'status', payload: `🔧 Re-wiring ${brokenCompId} with autowire engine...` });
    wasmReset();

    for (const c of cleanedComponents) {
      const pins = pinDefs?.[c.type] || [];
      wasmIngestComponent(c.id, c.type, c.x, c.y, c.w || 40, c.h || 40, pins);
    }
    // Also ingest the broken component so the engine knows where it sits
    wasmIngestComponent(
      brokenComp.id, brokenComp.type,
      brokenComp.x, brokenComp.y,
      brokenComp.w || 40, brokenComp.h || 40,
      compPinDefs,
    );

    // Step 5: Call autowire with isRewire: true
    let plan: any;
    try {
      plan = wasmGenerateAutonomousSetup(
        brokenComp,    // the component to fix
        manifest,      // its manifest (for helper component rules like resistors)
        boardId,       // which board to connect to
        cleanedWires,  // remaining wires MINUS the broken circuit
        false,         // allowBreadboard
        true,          // isRewire: true — engine clears old connections & rewires
      );
    } catch (err) {
      console.error('[AutofixWorker v3] generateAutonomousSetup failed:', err);
      continue;
    }

    if (!plan || typeof plan === 'string') {
      console.warn('[AutofixWorker v3] Engine returned no plan or an error string:', plan);
      continue;
    }

    // Step 6a: Pin substitution — replace any non-power-rail board pin the engine
    // picked with the pin the user originally used (resolved via BFS above).
    // This prevents autowire from switching, e.g., pin 10 → pin 13 just because
    // pin 13 is its hardcoded default.
    const POWER_RAILS = new Set(['GND', '5V', '3V3', 'VIN', 'AREF', 'RESET', 'IOREF', 'VCC', 'VBUS', 'VBAT']);
    if (resolvedBoardPin) {
      const addedWires: any[] = plan.addedWires || plan.added_wires || [];
      const substituted = addedWires.map((w: any) => {
        const substituteEndpoint = (endpoint: string): string => {
          if (!endpoint) return endpoint;
          const colon = endpoint.indexOf(':');
          if (colon < 0) return endpoint;
          const eComp = endpoint.slice(0, colon);
          const ePin  = endpoint.slice(colon + 1);
          // Only substitute the board's signal pin — never power rails
          if (eComp === boardId && !POWER_RAILS.has(ePin.toUpperCase())) {
            if (ePin !== resolvedBoardPin) {
              console.log(
                `[AutofixWorker v3] Pin substitution: ${boardId}:${ePin} → ${boardId}:${resolvedBoardPin}`,
              );
              return `${boardId}:${resolvedBoardPin}`;
            }
          }
          return endpoint;
        };
        return { ...w, from: substituteEndpoint(w.from), to: substituteEndpoint(w.to) };
      });
      if (plan.addedWires) plan.addedWires = substituted;
      else plan.added_wires = substituted;
      console.log('[AutofixWorker v3] addedWires after pin substitution:', substituted);
    }

    // Step 6b: Merge the torn-down wires and helper component removals into the plan
    plan.removedWires = [
      ...(plan.removedWires || plan.removed_wires || []),
      ...relatedWires.map(w => ({ from: w.from, to: w.to })),
    ];
    plan.removedComponents = [
      ...(plan.removedComponents || plan.removed_components || []),
      ...helperIds,
    ];
    plan.targetRuleId = ruleId;
    plan.confidence   = 0.92;
    plan.description  = plan.description || `Re-wire ${brokenCompId} correctly`;
    plan.reasoning    = [
      `Violation: [${ruleId}] ${violation.message}`,
      `Broken component: ${brokenCompId} (${brokenComp.type})`,
      resolvedBoardPin
        ? `Previously connected to board pin: ${resolvedBoardPin} (preserved from user's wiring)`
        : 'Board pin could not be traced — autowire chose a default pin',
      helperIds.length > 0
        ? `Removed ${helperIds.length} helper component(s): ${helperIds.join(', ')}`
        : 'No helper components found to remove.',
      'Rewired using autowire engine (isRewire: true) — connections are correct by construction.',
    ];

    suggestions.push(plan);

    // Step 7: Apply plan to scratchpad state for subsequent iterations
    currentWires = cleanedWires;
    currentComponents = cleanedComponents;
    if (Array.isArray(plan.addedWires || plan.added_wires)) {
      currentWires = [...currentWires, ...(plan.addedWires || plan.added_wires)];
    }
    if (Array.isArray(plan.addedComponents || plan.added_components)) {
      currentComponents = [...currentComponents, ...(plan.addedComponents || plan.added_components)];
    }
  }

  console.log(`[AutofixWorker v3] Done. Generated ${suggestions.length} plan(s).`);
  self.postMessage({
    type: 'results',
    payload: {
      planCount: suggestions.length,
      suggestions,
      masterPlan: true,
    },
  });
}
