/**
 * DisplayRenderProvider — wraps the simulator scene with the Render Worker reference.
 *
 * The context object (DisplayRenderContext) is defined in the emulator package
 * (openhw-studio-emulator/src/display/DisplayRenderContext.ts) so that display
 * component UIs can import the hook without cross-package issues.
 *
 * This file intentionally does NOT create its own context: a second
 * createContext() would be a different object, and emulator consumers would
 * read null even inside the provider (palette previews, canvas, etc).
 * The shared instance is obtained through the lazy emulator loader, which is
 * also how PalettePanel resolves registry UIs — no static emulator import,
 * so the SimulatorPage chunk stays split.
 *
 * Usage in SimulatorPage:
 *   <DisplayRenderProvider renderWorker={renderWorkerRef.current}>
 *     <CanvasSceneLayer ... />
 *   </DisplayRenderProvider>
 */

import React from 'react';
import { getEmulator } from '../utils/emulatorLoader.js';

let _sharedContext = null;

const sharedContext = () => {
    if (!_sharedContext) {
        throw new Error(
            'DisplayRenderContext used before emulator load — ' +
            'call ensureEmulatorRegistry()/getEmulator() first.'
        );
    }
    return _sharedContext;
};

// Resolved once the emulator chunk loads; safe to call repeatedly.
export const ensureDisplayRenderContext = async () => {
    if (!_sharedContext) {
        const emulator = await getEmulator();
        _sharedContext = emulator.DisplayRenderContext;
    }
    return _sharedContext;
};

export function useDisplayRenderWorker() {
  const Ctx = _sharedContext;
  const contextWorker = Ctx ? React.useContext(Ctx) : null;
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
    if (!_sharedContext) return <>{children}</>;
    const Ctx = _sharedContext;
    return (
        <Ctx.Provider value={renderWorker}>
            {children}
        </Ctx.Provider>
    );
}
