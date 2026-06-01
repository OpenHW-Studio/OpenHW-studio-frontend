let init: any;
let reset: any;
let ingestComponent: any;
let generateAutonomousSetup: any;
let generateCodeForComponent: any;

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

        // WORKAROUND: Force Neopixel DIN to map to pin 6 on Arduino
        if (newComp.type.includes('neopixel') && plan.added_wires) {
            plan.added_wires.forEach((w: any) => {
                if (w.from === `${newComp.id}:DIN` && w.to.startsWith(boardId + ':')) {
                    w.to = `${boardId}:6`;
                } else if (w.to === `${newComp.id}:DIN` && w.from.startsWith(boardId + ':')) {
                    w.from = `${boardId}:6`;
                }
            });
        }

        // WORKAROUND: Force Rotary Encoder pins for ESP32
        if (newComp.type.includes('rotary-encoder') && boardId.includes('esp32')) {
            if (!plan.added_wires) plan.added_wires = [];
            // Remove any existing wires for this component to prevent duplicates
            plan.added_wires = plan.added_wires.filter((w: any) => !w.from.startsWith(newComp.id + ':') && !w.to.startsWith(newComp.id + ':'));
            
            // Wire to 2, 3, 4 because the manifest hardcodes these pins in its auto-code block
            plan.added_wires.push({ from: `${newComp.id}:GND`, to: `${boardId}:GND.1`, color: 'black' });
            plan.added_wires.push({ from: `${newComp.id}:VCC`, to: `${boardId}:3V3`, color: 'red' });
            plan.added_wires.push({ from: `${newComp.id}:SW`, to: `${boardId}:4`, color: 'green' });
            plan.added_wires.push({ from: `${newComp.id}:DT`, to: `${boardId}:3`, color: 'blue' });
            plan.added_wires.push({ from: `${newComp.id}:CLK`, to: `${boardId}:2`, color: 'yellow' });
        }

        // Forward library dependencies from manifest
        if (manifest?.autocoding?.libraries) {
            plan.libraries = manifest.autocoding.libraries;
        }

        console.log('[AutowiringWorker] Generated Plan:', plan);
        self.postMessage({ type: 'AUTONOMOUS_RESULT', payload: plan });
        break;
      }

      case 'GENERATE_CODE_SNIPPET': {
        let { compId, wires, manifest, components } = payload;
        
        reset(); // reset engine state just in case, though this pure function might not strictly need it
        
        // WORKAROUND: The WASM engine currently struggles to trace wires through intermediate 
        // passive components (like resistors). We create a "flattened" virtual wire list
        // where resistors are bypassed, allowing the engine to correctly identify the Arduino pins.
        let virtualWires = [...(wires || [])];
        const resistors = (components || []).filter((c: any) => c.type === 'openhw-resistor' || c.type === 'openhw-resistor-10k');
        
        resistors.forEach((res: any) => {
           const wireToRes = virtualWires.find((w: any) => 
               (w.from.startsWith(compId + ':') && w.to.startsWith(res.id + ':')) || 
               (w.to.startsWith(compId + ':') && w.from.startsWith(res.id + ':'))
           );
           const wireFromRes = virtualWires.find((w: any) => 
               w !== wireToRes && (w.from.startsWith(res.id + ':') || w.to.startsWith(res.id + ':'))
           );
           
           if (wireToRes && wireFromRes) {
               const compPinInfo = wireToRes.from.startsWith(compId + ':') ? wireToRes.from : wireToRes.to;
               const targetPinInfo = wireFromRes.from.startsWith(res.id + ':') ? wireFromRes.to : wireFromRes.from;
               
               virtualWires = virtualWires.filter((w: any) => w !== wireToRes && w !== wireFromRes);
               virtualWires.push({
                   id: 'virtual_' + res.id,
                   from: compPinInfo,
                   to: targetPinInfo
               });
           }
        });

        const snippet = generateCodeForComponent(compId, virtualWires, manifest, components || []);
        
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
