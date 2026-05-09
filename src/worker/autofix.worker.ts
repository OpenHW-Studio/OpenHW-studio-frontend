/**
 * Autofix Web Worker (Rust WASM Edition)
 * Bridges the high-performance Rust engine with the simulator UI.
 */

import init, * as engine from '../wasm/autofix_rust.js';
import wasmUrl from '../wasm/autofix_rust.wasm?url';

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
        
        // 0. Reset state
        self.postMessage({ type: 'status', payload: 'Analyzing diagram (Rust)...' });
        engine.reset();

        // 1. Ingest components
        const components = diagram.components || [];
        self.postMessage({ type: 'status', payload: `📥 Ingesting ${components.length} components...` });
        components.forEach((c: any) => {
          engine.ingestComponent(c.id, c.type, c.x || 0, c.y || 0, c.rotation || 0);
        });

        // 2. Ingest wires
        const wires = diagram.connections || [];
        self.postMessage({ type: 'status', payload: `📥 Ingesting ${wires.length} wires...` });
        wires.forEach((w: any) => {
          engine.ingestWire(w.from, w.to, w.color || 'green');
        });

        // 3. Ingest violations
        const vios = violations || [];
        self.postMessage({ type: 'status', payload: `📥 Ingesting ${vios.length} circuit violations...` });
        vios.forEach((v: any) => {
          const rawIds = v.componentIds || v.compIds || [];
          const compIdsStr = (Array.isArray(rawIds) ? rawIds : [rawIds]).join(',');
          const ruleId = v.ruleId || v.id || 'unknown-rule';
          engine.ingestViolation(ruleId, v.message || 'Unknown issue', compIdsStr, v.severity || 'error');
        });

        // 4. Generate plan
        self.postMessage({ type: 'status', payload: '🧠 Calculating optimal repair strategy (Rust A*)...' });
        const planCount = engine.getFixPlanCount();
        const suggestions = [];

        for (let i = 0; i < planCount; i++) {
          const description = engine.getFixDescription(i);
          
          const addedComponents = [];
          const compCount = engine.getFixAddedComponentCount(i);
          for (let j = 0; j < compCount; j++) {
            addedComponents.push({
              id: engine.getAddedComponentId(i, j),
              type: engine.getAddedComponentType(i, j),
              x: engine.getAddedComponentX(i, j),
              y: engine.getAddedComponentY(i, j),
              w: 0,
              h: 0,
              rotation: 0
            });
          }

          const addedWires = [];
          const wireCount = engine.getFixAddedWireCount(i);
          for (let j = 0; j < wireCount; j++) {
            const path = [];
            const pointCount = engine.getAddedWirePathPointCount(i, j);
            for (let k = 0; k < pointCount; k++) {
              path.push({
                x: engine.getAddedWirePathPointX(i, j, k),
                y: engine.getAddedWirePathPointY(i, j, k)
              });
            }

            addedWires.push({
              from: engine.getAddedWireFrom(i, j).replace('.', ':'),
              to: engine.getAddedWireTo(i, j).replace('.', ':'),
              color: '#38bdf8',
              isNew: true,
              path: path.length > 0 ? path : null
            });
          }

          const removedWires = [];
          const removedCount = engine.getFixRemovedWireCount(i);
          for (let j = 0; j < removedCount; j++) {
            removedWires.push({
              from: engine.getRemovedWireFrom(i, j).replace('.', ':'),
              to: engine.getRemovedWireTo(i, j).replace('.', ':')
            });
          }

          const reasoning = [];
          const reasoningCount = engine.getFixReasoningCount(i);
          for (let j = 0; j < reasoningCount; j++) {
            reasoning.push(engine.getFixReasoningStep(i, j));
          }

          const transformations = [];
          const transCount = engine.getFixTransformationCount(i);
          for (let j = 0; j < transCount; j++) {
            transformations.push({
              componentId: engine.getTransformationComponentId(i, j),
              rotation: engine.getTransformationRotation(i, j)
            });
          }

          suggestions.push({
            description,
            targetRuleId: engine.getFixTargetRuleId(i),
            addedComponents,
            addedWires,
            removedWires,
            transformations,
            reasoning
          });
        }
        
        self.postMessage({ 
          type: 'results', 
          payload: { planCount, suggestions } 
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
      break;

    case 'stop':
      isInitialized = false;
      self.postMessage({ type: 'stopped' });
      break;
  }
};
