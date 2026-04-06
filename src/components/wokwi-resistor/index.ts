import { validation } from './validation';
import manifest from './manifest.json';
import { ResistorLogic } from './logic';
import { ResistorUI, ResistorContextMenu, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

import uiRaw from './ui.tsx?raw';
import logicRaw from './logic.ts?raw';
import validationRaw from './validation.ts?raw';

export default {
    manifest,
    LogicClass: ResistorLogic,
    UI: ResistorUI,
    ContextMenu: ResistorContextMenu,
    contextMenuDuringRun: false,
    BOUNDS,
    validation,
    doc: docHtml,
    uiRaw,
    logicRaw,
    validationRaw,
};
