import manifest from './manifest.json';
import { LdrModuleUI, LdrContextMenu, BOUNDS } from './ui';
import { LdrModuleLogic } from './logic';
import { validation } from './validation';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    UI: LdrModuleUI,
    LogicClass: LdrModuleLogic,
    BOUNDS,
    ContextMenu: LdrContextMenu,
    contextMenuDuringRun: true,
    contextMenuOnlyDuringRun: true,
    validation,
    doc: docHtml
};