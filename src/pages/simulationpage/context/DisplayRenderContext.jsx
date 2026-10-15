/**
 * DisplayRenderProvider — wraps the simulator scene with the Render Worker reference.
 *
 * The context object (DisplayRenderContext) is defined in the emulator package
 * so that display component UIs can import the hook without cross-package issues.
 *
 * Usage in SimulatorPage:
 *   <DisplayRenderProvider renderWorker={renderWorkerRef.current}>
 *     <CanvasSceneLayer ... />
 *   </DisplayRenderProvider>
 */

import React from 'react';
// Perf (bundle-split): tiny context shim, no emulator import. Behavior matches
// the emulator's useDisplayRenderWorker: prefer window.__displayRenderWorker,
// fall back to context, and stay in sync via display-render-worker-changed.
export const DisplayRenderContext = React.createContext(null);

export function useDisplayRenderWorker() {
  const contextWorker = React.useContext(DisplayRenderContext);
  const [worker, setWorker] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return window.__displayRenderWorker || contextWorker;
    }
    return contextWorker;
  });
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e) => setWorker(e.detail);
    window.addEventListener('display-render-worker-changed', handler);
    setWorker(window.__displayRenderWorker || contextWorker);
    return () => window.removeEventListener('display-render-worker-changed', handler);
  }, [contextWorker]);
  return worker;
}

export function DisplayRenderProvider({ renderWorker, children }) {
    return (
        <DisplayRenderContext.Provider value={renderWorker}>
            {children}
        </DisplayRenderContext.Provider>
    );
}
