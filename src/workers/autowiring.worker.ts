let init: any;
let reset: any;
let ingestComponent: any;
let generateAutonomousSetup: any;

let isWasmInitialized = false;

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

      console.log('[AutowiringWorker] Initializing WASM...');
      await init();
      isWasmInitialized = true;
      console.log('[AutowiringWorker] WASM Initialized successfully.');
    }

    console.log('[AutowiringWorker] Received message:', type, payload);

    switch (type) {
      case 'GENERATE_AUTONOMOUS_SETUP': {
        const { components, newComp, manifest, boardId } = payload;
        
        reset();
        
        // Ingest current state
        components.forEach((c: any) => {
          const pins = payload.pinDefs?.[c.type] || [];
          ingestComponent(c.id, c.type, c.x, c.y, c.w || 40, c.h || 40, pins);
        });

        // Ingest the new component too
        const newPins = payload.pinDefs?.[newComp.type] || [];
        ingestComponent(newComp.id, newComp.type, newComp.x, newComp.y, newComp.w || 40, newComp.h || 40, newPins);

        // Generate the autonomous plan (Placement + Wiring + Code)
        const plan = generateAutonomousSetup(newComp, manifest, boardId, payload.wires || []);
        
        if (typeof plan === 'string') {
          throw new Error(plan);
        }

        // Forward library dependencies from manifest
        if (manifest?.autocoding?.libraries) {
            plan.libraries = manifest.autocoding.libraries;
        }

        console.log('[AutowiringWorker] Generated Plan:', plan);
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
