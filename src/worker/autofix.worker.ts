/**
 * Autofix Web Worker
 * Bridges the intelligent WASM engine with the simulator UI.
 */

import wasmUrl from '../wasm/autofix.wasm?url';

// --- AssemblyScript Glue (adapted for browser worker) ---

async function instantiate(module: WebAssembly.Module, imports: any = {}) {
  // Clear any potential internal caches by ensuring we work with fresh module
  console.log("[AutofixWorker] Instantiating WASM Engine (v1.0.3-stable)...");
  const adaptedImports = {
    env: Object.setPrototypeOf({
      abort(message: number, fileName: number, lineNumber: number, columnNumber: number) {
        console.error("WASM Abort:", message, fileName, lineNumber, columnNumber);
      },
    }, Object.assign(Object.create(globalThis), imports.env || {})),
  };
  
  const { exports } = await WebAssembly.instantiate(module, adaptedImports);
  const memory = (exports.memory as WebAssembly.Memory);
  
  let __dataview = new DataView(memory.buffer);

  function __liftString(pointer: number) {
    if (!pointer) return null;
    const end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1;
    const memoryU16 = new Uint16Array(memory.buffer);
    let start = pointer >>> 1;
    let string = "";
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }

  function __lowerString(value: string | null) {
    if (value == null) return 0;
    const length = value.length;
    const pointer = (exports as any).__new(length << 1, 2) >>> 0;
    const memoryU16 = new Uint16Array(memory.buffer);
    for (let i = 0; i < length; ++i) memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);
    return pointer;
  }

  function __setU32(pointer: number, value: number) {
    try {
      __dataview.setUint32(pointer, value, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      __dataview.setUint32(pointer, value, true);
    }
  }

  function __lowerArray(lowerElement: (p: number, v: any) => void, id: number, align: number, values: any[] | null) {
    if (values == null) return 0;
    const length = values.length;
    const buffer = (exports as any).__pin((exports as any).__new(length << align, 1)) >>> 0;
    const header = (exports as any).__pin((exports as any).__new(16, id)) >>> 0;
    __setU32(header + 0, buffer);
    __dataview.setUint32(header + 4, buffer, true);
    __dataview.setUint32(header + 8, length << align, true);
    __dataview.setUint32(header + 12, length, true);
    for (let i = 0; i < length; ++i) lowerElement(buffer + (i << align >>> 0), values[i]);
    (exports as any).__unpin(buffer);
    (exports as any).__unpin(header);
    return header;
  }

  const refcounts = new Map<number, number>();
  function __retain(pointer: number) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount) refcounts.set(pointer, refcount + 1);
      else refcounts.set((exports as any).__pin(pointer), 1);
    }
    return pointer;
  }

  function __release(pointer: number) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount === 1) {
        (exports as any).__unpin(pointer);
        refcounts.delete(pointer);
      } else if (refcount) {
        refcounts.set(pointer, refcount - 1);
      }
    }
  }

  console.log("WASM Exports:", Object.keys(exports));
  return {
    exports: exports as any,
    ingestComponent(id: string, type: string, x: number, y: number, rotation: number) {
      const idPtr = __retain(__lowerString(id));
      const typePtr = __lowerString(type);
      try {
        (exports as any).ingestComponent(idPtr, typePtr, x, y, rotation);
      } finally {
        __release(idPtr);
      }
    },
    ingestWire(from: string, to: string, color: string) {
      const fromPtr = __retain(__lowerString(from));
      const toPtr = __retain(__lowerString(to));
      const colorPtr = __lowerString(color);
      try {
        (exports as any).ingestWire(fromPtr, toPtr, colorPtr);
      } finally {
        __release(fromPtr);
        __release(toPtr);
      }
    },
    ingestViolation(ruleId: string, message: string, componentIds: string, severity: string) {
      const ruleIdPtr = __retain(__lowerString(ruleId));
      const messagePtr = __retain(__lowerString(message));
      const componentIdsPtr = __retain(__lowerString(componentIds));
      const severityPtr = __lowerString(severity);
      try {
        (exports as any).ingestViolation(ruleIdPtr, messagePtr, componentIdsPtr, severityPtr);
      } finally {
        __release(ruleIdPtr);
        __release(messagePtr);
        __release(componentIdsPtr);
      }
    },
    reset() {
      (exports as any).reset();
    },
    getFixPlanCount(): number {
      return (exports as any).getFixPlanCount();
    },
    getFixDescription(index: number): string {
      return __liftString((exports as any).getFixDescription(index));
    },
    getFixAddedComponentCount(index: number): number {
      return (exports as any).getFixAddedComponentCount(index);
    },
    getFixAddedWireCount(index: number): number {
      return (exports as any).getFixAddedWireCount(index);
    },
    getAddedComponentId(fixIndex: number, compIndex: number): string {
      return __liftString((exports as any).getAddedComponentId(fixIndex, compIndex));
    },
    getAddedComponentType(fixIndex: number, compIndex: number): string {
      return __liftString((exports as any).getAddedComponentType(fixIndex, compIndex));
    },
    getAddedComponentX(fixIndex: number, compIndex: number): number {
      return (exports as any).getAddedComponentX(fixIndex, compIndex);
    },
    getAddedComponentY(fixIndex: number, compIndex: number): number {
      return (exports as any).getAddedComponentY(fixIndex, compIndex);
    },
    getAddedWireFrom(fixIndex: number, wireIndex: number): string {
      return __liftString((exports as any).getAddedWireFrom(fixIndex, wireIndex));
    },
    getAddedWireTo(fixIndex: number, wireIndex: number): string {
      return __liftString((exports as any).getAddedWireTo(fixIndex, wireIndex));
    },
    getFixReasoningCount(index: number): number {
      return (exports as any).getFixReasoningCount(index);
    },
    getFixReasoningStep(fixIndex: number, stepIndex: number): string {
      return __liftString((exports as any).getFixReasoningStep(fixIndex, stepIndex));
    },
    getFixTransformationCount(index: number): number {
      return (exports as any).getFixTransformationCount(index);
    },
    getTransformationComponentId(fixIndex: number, transIndex: number): string {
      return __liftString((exports as any).getTransformationComponentId(fixIndex, transIndex));
    },
    getTransformationRotation(fixIndex: number, transIndex: number): number {
      return (exports as any).getTransformationRotation(fixIndex, transIndex);
    },
    getFixRemovedWireCount(index: number): number {
      return (exports as any).getFixRemovedWireCount(index);
    },
    getRemovedWireFrom(fixIndex: number, wireIndex: number): string {
      return __liftString((exports as any).getRemovedWireFrom(fixIndex, wireIndex));
    },
    getRemovedWireTo(fixIndex: number, wireIndex: number): string {
      return __liftString((exports as any).getRemovedWireTo(fixIndex, wireIndex));
    }
  };
}

// --- Worker Logic ---

let engine: any = null;

async function initEngine() {
  const response = await fetch(wasmUrl + (wasmUrl.includes('?') ? '&' : '?') + 't=' + Date.now());
  // Use instantiateStreaming if possible, fallback to manual for some browsers/environments
  if (WebAssembly.instantiateStreaming) {
    const { module } = await WebAssembly.instantiateStreaming(response, {
      env: {
        abort: (msg: number, file: number, line: number, col: number) => console.error("WASM Abort")
      }
    });
    engine = await instantiate(module);
  } else {
    const buffer = await response.arrayBuffer();
    const module = await WebAssembly.compile(buffer);
    engine = await instantiate(module);
  }
  console.log("Autofix WASM Engine initialized.");
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    self.postMessage({ type: 'status', payload: 'Initializing WASM Engine...' });
    await initEngine();
    self.postMessage({ type: 'ready' });
    return;
  }

  if (!engine) return;

  switch (type) {
    case 'analyze':
      // payload: { diagram: { components, connections }, violations }
      try {
        const { diagram, violations } = payload;
        
        // 0. Reset state
        self.postMessage({ type: 'status', payload: 'Analyzing diagram...' });
        engine.reset();

        // 1. Ingest components
        (diagram.components || []).forEach((c: any) => {
          engine.ingestComponent(c.id, c.type, c.x || 0, c.y || 0, c.rotation || 0);
        });

        // 2. Ingest wires
        (diagram.connections || []).forEach((w: any) => {
          engine.ingestWire(w.from, w.to, w.color || 'green');
        });

        // 3. Ingest violations
        self.postMessage({ type: 'status', payload: 'Calculating repairs...' });
        (violations || []).forEach((v: any) => {
          // Support both naming conventions from different validator versions
          const rawIds = v.componentIds || v.compIds || [];
          const compIdsStr = (Array.isArray(rawIds) ? rawIds : [rawIds]).join(',');
          
          // Handle null ruleId/id gracefully
          const ruleId = v.ruleId || v.id || 'unknown-rule';
          engine.ingestViolation(ruleId, v.message || 'Unknown issue', compIdsStr, v.severity || 'error');
        });

        // 4. Generate plan
        const planCount = engine.getFixPlanCount();
        const suggestions = [];

        for (let i = 0; i < planCount; i++) {
          const description = engine.getFixDescription(i);
          const addedComponents = [];
          const addedWires = [];

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

          const wireCount = engine.getFixAddedWireCount(i);
          for (let j = 0; j < wireCount; j++) {
            addedWires.push({
              from: engine.getAddedWireFrom(i, j).replace('.', ':'),
              to: engine.getAddedWireTo(i, j).replace('.', ':'),
              color: '#38bdf8', // Ghost sky blue
              isNew: true
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
            addedComponents,
            addedWires,
            removedWires,
            transformations,
            reasoning
          });
        }
        
        self.postMessage({ 
          type: 'results', 
          payload: { 
            planCount,
            suggestions
          } 
        });
      } catch (err) {
        console.error('[AutofixWorker] Error during analysis:', err);
        self.postMessage({ 
          type: 'status', 
          payload: 'ERROR: ' + (err instanceof Error ? err.message : String(err)) 
        });
        // Send empty results to unblock UI
        self.postMessage({ 
          type: 'results', 
          payload: { planCount: 0, suggestions: [] } 
        });
      }
      break;

    case 'stop':
      // Reset engine or cleanup
      engine = null;
      self.postMessage({ type: 'stopped' });
      break;
  }
};
