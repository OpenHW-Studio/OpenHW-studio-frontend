import { validation } from './validation';
import manifest from './manifest.json';
import { NeopixelLogic } from './logic';
import { NeopixelUI, NeopixelContextMenu, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: NeopixelLogic,
    UI: NeopixelUI,
    ContextMenu: NeopixelContextMenu,
    contextMenuDuringRun: false,
    BOUNDS,
    validation,
    doc: doc
};
