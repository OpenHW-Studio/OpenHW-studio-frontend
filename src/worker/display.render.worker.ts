/**
 * display.render.worker.ts
 *
 * Dedicated Render Worker for all OffscreenCanvas display components.
 *
 * Lifecycle:
 *  1. Main thread creates this worker on simulation start.
 *  2. Main thread sends SET_SIM_PORT with a MessagePort connected to simulation.worker.
 *  3. Simulation worker sends DISPLAY_FRAME messages directly via that port (zero-copy).
 *  4. For each display component, main thread sends DISPLAY_MOUNT (with OffscreenCanvas transfer).
 *  5. On each DISPLAY_FRAME, the matching IDisplayRenderer.paint() is called — no main thread involved.
 *  6. On DISPLAY_UNMOUNT / DISPLAY_CLEAR_ALL, renderers are destroyed.
 *
 * Adding a new display type:
 *  - Implement IDisplayRenderer in openhw-studio-emulator/src/display/renderers/
 *  - Register it in RENDERER_REGISTRY below.
 */

import type { IDisplayRenderer, DisplayFrame } from '@openhw/emulator/src/display/IDisplayRenderer.ts';
import { ILI9341Renderer } from '@openhw/emulator/src/display/renderers/ILI9341Renderer.ts';
import { SSD1306Renderer } from '@openhw/emulator/src/display/renderers/SSD1306Renderer.ts';

// ─── Registry ────────────────────────────────────────────────────────────────
// To support a new display: add an entry here. No other infrastructure changes needed.
const RENDERER_REGISTRY: Record<string, new () => IDisplayRenderer> = {
    ili9341:  ILI9341Renderer,
    ssd1306:  SSD1306Renderer,
    // Future:
    // epaper:    EPaperRenderer,
    // tft_touch: ILI9341Renderer,  // TFT touch uses same pixel pipeline as ILI9341
    // hub75:     HUB75Renderer,
};

// ─── Active renderers ─────────────────────────────────────────────────────────
const renderers = new Map<string, IDisplayRenderer>();

// ─── Handle messages from main thread ────────────────────────────────────────
self.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    console.log('[DisplayRenderWorker] received message from main:', msg?.type, msg);

    switch (msg?.type) {
        case 'SET_SIM_PORT': {
            // Accept a MessagePort from the Simulation Worker.
            // Simulation worker will send DISPLAY_FRAME messages directly on this port.
            const port: MessagePort = msg.port;
            console.log('[DisplayRenderWorker] setting sim port');
            port.onmessage = handleDisplayFrame;
            break;
        }

        case 'DISPLAY_MOUNT': {
            const { compId, canvas, displayType, width, height } = msg;
            console.log('[DisplayRenderWorker] DISPLAY_MOUNT:', compId, displayType, !!canvas);
            if (!compId || !canvas || !displayType) break;

            // Destroy any existing renderer for this component (e.g. simulation restart).
            const existing = renderers.get(compId);
            if (existing) { existing.destroy(); renderers.delete(compId); }

            const RendererClass = RENDERER_REGISTRY[displayType];
            if (!RendererClass) {
                console.warn(`[DisplayRenderWorker] Unknown displayType: "${displayType}"`);
                break;
            }

            const renderer = new RendererClass();
            renderer.mount(canvas as OffscreenCanvas);
            renderers.set(compId, renderer);
            break;
        }

        case 'DISPLAY_UNMOUNT': {
            console.log('[DisplayRenderWorker] DISPLAY_UNMOUNT:', msg.compId);
            const renderer = renderers.get(msg.compId);
            if (renderer) { renderer.destroy(); renderers.delete(msg.compId); }
            break;
        }

        case 'DISPLAY_CLEAR_ALL': {
            console.log('[DisplayRenderWorker] DISPLAY_CLEAR_ALL');
            renderers.forEach(r => r.destroy());
            renderers.clear();
            break;
        }

        case 'DISPLAY_FRAME': {
            // Direct frame from main thread (fallback — normally routed via MessagePort).
            handleDisplayFrame(e);
            break;
        }

        default:
            break;
    }
};

// ─── Frame handler ────────────────────────────────────────────────────────────
function handleDisplayFrame(e: MessageEvent) {
    const frame = e.data as DisplayFrame & { type: string };
    if (!frame?.compId) return;

    const renderer = renderers.get(frame.compId);
    if (!renderer) return;

    renderer.paint({
        compId:      frame.compId,
        displayType: frame.displayType || '',
        width:       frame.width       || 0,
        height:      frame.height      || 0,
        buffer:      frame.buffer      ?? null,
        state:       frame.state       ?? {},
        timestamp:   frame.timestamp   ?? Date.now(),
    });
}
