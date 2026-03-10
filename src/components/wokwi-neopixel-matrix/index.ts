import { validation } from './validation';
import manifest from './manifest.json';
import { NeopixelLogic } from './logic';
import { NeopixelUI, NeopixelContextMenu, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: NeopixelLogic,
    UI: NeopixelUI,
    ContextMenu: NeopixelContextMenu,
    contextMenuDuringRun: false,
    BOUNDS,
    validation,
    doc: docHtml
};
