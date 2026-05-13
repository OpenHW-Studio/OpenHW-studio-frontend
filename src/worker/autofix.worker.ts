if (typeof window === 'undefined') {
    (self as any).window = self;
    (self as any).document = {
        createElement: () => ({ style: {} }),
        getElementsByTagName: () => [],
        createTextNode: () => ({}),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
    };
}
(self as any).$RefreshReg$ = () => {};
(self as any).$RefreshSig$ = () => () => (type: any) => type;

/**
 * Autofix Web Worker (Rust WASM Edition)
 * Bridges the high-performance Rust engine with the simulator UI.
 */

import init, * as engine from '../wasm/openhw_studio_autofix_rust.js';
import wasmUrl from '../wasm/openhw_studio_autofix_rust_bg.wasm?url';
import { FullCircuitValidator } from '@openhw/emulator';
import { calculateProjectPlanApplication } from '../pages/simulationpage/projectUtils.js';

self.onerror = (msg, url, line, col, error) => {
  console.error(`[AutofixWorker] Global Error: ${msg} at ${line}:${col}`, error);
  return false;
};

let isInitialized = false;

async function initEngine() {
  if (isInitialized) return;
  console.log("[AutofixWorker] Initializing Rust Engine (v2.0.0-rust)...");
  
  // wasm-bindgen handles the instantiation and memory management
  await init({ module_or_path: wasmUrl });
  
  isInitialized = true;
  console.log("Autofix Rust WASM Engine initialized.");
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    self.postMessage({ type: 'status', payload: 'Initializing Rust Engine...' });
    try {
      await initEngine();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      console.error("[AutofixWorker] Initialization failed:", err);
      self.postMessage({ type: 'status', payload: 'ERROR: Initialization failed' });
    }
    return;
  }

  if (!isInitialized) return;

  switch (type) {
    case 'analyze':
      try {
        const { diagram, violations } = payload;
        console.group('[AutofixWorker] Starting Autofix Macro-Loop');
        console.log('[AutofixWorker] Initial Violations:', violations);
        console.log('[AutofixWorker] Initial Diagram State:', diagram);
        
        let currentDiagram = { components: [...(diagram.components || [])], connections: [...(diagram.connections || [])] };
        let currentViolations = [...(violations || [])];
        let totalSuggestions = [];
        let limit = 0;
        const MACRO_LIMIT = 5; // Prevent infinite recursive autofixing

        // Dynamic Iterative Loop
        while (currentViolations.length > 0 && limit < MACRO_LIMIT) {
          console.group(`[AutofixWorker] Iteration ${limit + 1}`);
          console.log('[AutofixWorker] Feeding violations to Rust Engine:', currentViolations);
          
          self.postMessage({ type: 'status', payload: `Analyzing iteration ${limit + 1} (Rust)...` });
          engine.reset();

          // 1. Ingest current components
          currentDiagram.components.forEach((c) => {
            engine.ingestComponent(c.id, c.type, c.x || 0, c.y || 0, c.rotation || 0);
          });

          // 2. Ingest wires
          currentDiagram.connections.forEach((w) => {
            engine.ingestWire(w.from, w.to, w.color || 'green');
          });

          // 3. Ingest current violations
          currentViolations.forEach((v) => {
            const rawIds = v.componentIds || v.compIds || [];
            const compIdsStr = (Array.isArray(rawIds) ? rawIds : [rawIds]).join(',');
            const ruleId = v.ruleId || v.id || 'unknown-rule';
            engine.ingestViolation(ruleId, v.message || 'Unknown issue', compIdsStr, v.severity || 'error');
          });

          // 4. Generate partial plan
          self.postMessage({ type: 'status', payload: `🧠 Calculating optimal repair strategy (${limit + 1}/5)...` });
          
          const planCount = engine.getFixPlanCount();

          if (planCount === 0) break; // Engine gave up / ran out of patterns

          // Take the primary fix (most severe usually sorted first)
          const i = 0; 
          const description = engine.getFixDescription(i);
          
          const addedComponents = [];
          for (let j = 0; j <  engine.getFixAddedComponentCount(i); j++) {
            addedComponents.push({
              id: engine.getAddedComponentId(i, j),
              type: engine.getAddedComponentType(i, j),
              x: engine.getAddedComponentX(i, j),
              y: engine.getAddedComponentY(i, j),
              w: 0, h: 0, rotation: 0
            });
          }

          const addedWires = [];
          for (let j = 0; j < engine.getFixAddedWireCount(i); j++) {
            const path = [];
            for (let k = 0; k < engine.getAddedWirePathPointCount(i, j); k++) {
              path.push({ x: engine.getAddedWirePathPointX(i, j, k), y: engine.getAddedWirePathPointY(i, j, k) });
            }
            addedWires.push({
              from: engine.getAddedWireFrom(i, j).replace('.', ':'),
              to: engine.getAddedWireTo(i, j).replace('.', ':'),
              color: '#38bdf8', isNew: true,
              path: path.length > 0 ? path : null
            });
          }

          const removedWires = [];
          for (let j = 0; j < engine.getFixRemovedWireCount(i); j++) {
            removedWires.push({
              from: engine.getRemovedWireFrom(i, j).replace('.', ':'),
              to: engine.getRemovedWireTo(i, j).replace('.', ':')
            });
          }

          const transformations = [];
          for (let j = 0; j < engine.getFixTransformationCount(i); j++) {
            transformations.push({
              componentId: engine.getTransformationComponentId(i, j),
              rotation: engine.getTransformationRotation(i, j)
            });
          }

          const reasoning = [];
          for (let j = 0; j < engine.getFixReasoningCount(i); j++) {
            reasoning.push(engine.getFixReasoningStep(i, j));
          }

          const iterPlan = {
            description,
            targetRuleId: engine.getFixTargetRuleId(i),
            addedComponents, addedWires, removedWires, transformations, reasoning
          };

          console.log('[AutofixWorker] Rust Engine generated plan:', iterPlan);
          console.log('[AutofixWorker] Applying patch and re-validating...');

          totalSuggestions.push(iterPlan);

          // 5. Recursion Step - Simulate applying the patch
          const nextComponents = [];
          const nextWires = [];
          try {
            const result = calculateProjectPlanApplication(
              iterPlan, 
              currentDiagram.components, 
              currentDiagram.connections, 
              {} // PIN_DEFS
            );
            nextComponents.push(...result.components);
            nextWires.push(...result.wires);
          } catch(e) {
            console.error(e);
            break;
          }

          currentDiagram.components = nextComponents;
          currentDiagram.connections = nextWires;

          // 6. Re-validate
          const engineConnectionsFormat = nextWires.map(w => ({ from: w.from.replace(':', '.'), to: w.to.replace(':', '.') }));
          const validator = new FullCircuitValidator({ components: nextComponents, connections: engineConnectionsFormat });
          const isSafe = validator.runValidation({ profile: 'balanced' });
          console.log('[AutofixWorker] Post-Patch Validation Results:', validator.errors);

          if (isSafe || validator.errors.length === 0) {
            console.log('[AutofixWorker] Circuit is now completely fixed!');
            console.groupEnd();
            break;
          } else {
            // Re-assign for the next cycle
            currentViolations = validator.errors;
            console.log('[AutofixWorker] Remaining issues to fix in next tick:', currentViolations);
          }

          console.groupEnd();
          limit++;
        }
        console.log('[AutofixWorker] Complete Autofix Pipeline Finished. Final Plans:', totalSuggestions);
        console.groupEnd();
        
        self.postMessage({ 
          type: 'results', 
          payload: { planCount: totalSuggestions.length, suggestions: totalSuggestions, masterPlan: true } 
        });
      } catch (err) {
        console.error('[AutofixWorker] Rust execution error:', err);
        self.postMessage({ 
          type: 'status', 
          payload: 'ERROR: ' + (err instanceof Error ? err.message : String(err)) 
        });
        self.postMessage({ 
          type: 'results', 
          payload: { planCount: 0, suggestions: [] } 
        });
      }

    case 'stop':
      isInitialized = false;
      self.postMessage({ type: 'stopped' });
      break;
  }
};
