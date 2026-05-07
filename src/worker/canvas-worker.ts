/**
 * Canvas Worker
 * Handles high-performance circuit rendering using Rust/WASM.
 */

import init, { render_circuit_wasm, init_panic_hook } from '../wasm/canvas/openhw_studio_canvas_engine.js';

let wasmInitialized = false;

async function ensureWasm() {
    if (wasmInitialized) return;
    try {
        await init();
        init_panic_hook();
        wasmInitialized = true;
    } catch (err) {
        console.error('[CanvasWorker] WASM init failed:', err);
        throw err;
    }
}

self.onmessage = async (e) => {
    const { type, payload, id } = e.data;

    if (type === 'RENDER_PNG') {
        try {
            await ensureWasm();
            const { project, assets, options, fullMetadata } = payload;

            const t_start = performance.now();
            const result = render_circuit_wasm(
                JSON.stringify(project),
                JSON.stringify(assets),
                JSON.stringify(options),
                JSON.stringify(fullMetadata)
            );
            const t_end = performance.now();

            // result is a Uint8Array (PNG bytes with metadata)
            const blob = new Blob([result], { type: 'image/png' });
            
            self.postMessage({
                type: 'RENDER_RESULT',
                id,
                payload: {
                    blob,
                    ms: Math.round(t_end - t_start)
                }
            });
        } catch (err: any) {
            self.postMessage({
                type: 'RENDER_ERROR',
                id,
                payload: err.message || String(err)
            });
        }
    }
};
