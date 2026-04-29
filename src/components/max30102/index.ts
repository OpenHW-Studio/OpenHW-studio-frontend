import manifest from './manifest.json';
import { MAX30102UI, MAX30102ContextMenu, BOUNDS } from './ui';
import { MAX30102Logic } from './logic';
import { validation } from './validation';
import docHtml from './doc/index.html?raw';

import uiRaw from './ui.tsx?raw';
import logicRaw from './logic.ts?raw';
import validationRaw from './validation.ts?raw';

export default {
    manifest,
    UI: MAX30102UI,
    LogicClass: MAX30102Logic,
    BOUNDS,
    ContextMenu: MAX30102ContextMenu,
    contextMenuDuringRun: true,   // slider is live-usable while running
    contextMenuOnlyDuringRun: true,   // hide the menu when simulation is stopped
    validation,
    doc: docHtml,
    uiRaw,
    logicRaw,
    validationRaw,
};
