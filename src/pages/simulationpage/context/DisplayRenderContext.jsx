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
import { DisplayRenderContext } from '@openhw/emulator/src/display/DisplayRenderContext';

export function DisplayRenderProvider({ renderWorker, children }) {
    return (
        <DisplayRenderContext.Provider value={renderWorker}>
            {children}
        </DisplayRenderContext.Provider>
    );
}
