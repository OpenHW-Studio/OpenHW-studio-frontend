/**
 * Run worker-setup domain, extracted verbatim from SimulatorPage.jsx
 * handleRun (render worker + MessageChannel display link + simulation
 * worker). Network worker removed pending WiFi/IP engine reimplementation.
 *
 * NOTE on placement: this module lives in src/pages/simulationpage/ (same
 * directory as SimulatorPage.jsx) so the `new URL("../../worker/...")`
 * specifiers resolve byte-identically.
 * Do NOT move this file into utils/ or hooks/ without adjusting those
 * specifiers (utils/ would need "../../../worker/...").
 *
 * Behavior contract: identical creation order (render before sim so the
 * port is ready), identical SET_SIM_PORT/SET_RENDER_PORT handshakes.
 * Returns { renderWorker, worker }.
 * Verify via run-start + display-render Playwright checks.
 */
export function setupRunWorkers({ components, renderWorkerRef, workerRef, setRenderWorker }) {
        // ── Render Worker: create before sim worker so port is ready ──────────
        const renderWorker = new Worker(
          new URL("../../worker/display.render.worker.ts", import.meta.url),
          { type: "module" },
        );
        renderWorkerRef.current = renderWorker;
        setRenderWorker(renderWorker); // Triggers Provider re-render so display UIs receive the worker
        if (typeof window !== "undefined") {
          window.__displayRenderWorker = renderWorker;
          window.dispatchEvent(
            new CustomEvent("display-render-worker-changed", {
              detail: renderWorker,
            }),
          );
        }

        // Set up a MessageChannel so the Simulation Worker can post display frames
        // directly to the Render Worker — zero-copy, no main-thread involvement.
        const { port1: simPort, port2: renderPort } = new MessageChannel();
        // Give port1 to the Render Worker (it listens for DISPLAY_FRAME here)
        renderWorker.postMessage({ type: "SET_SIM_PORT", port: renderPort }, [
          renderPort,
        ]);

        // Load Simulation Web Worker
        const worker = new Worker(
          new URL("../../worker/simulation.worker.ts", import.meta.url),
          { type: "module" },
        );
        workerRef.current = worker;
        // Give port2 to the Simulation Worker (it sends DISPLAY_FRAME here)
        worker.postMessage({ type: "SET_RENDER_PORT", port: simPort }, [simPort]);
        // Network Worker removed pending WiFi/IP engine reimplementation
        // (was: dedicated DNS/TCP/UDP worker + WiFi-AP announce).

  return { renderWorker, worker };
}
