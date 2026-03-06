import { validation } from './validation';
import manifest from './manifest.json';
import { NeopixelLogic } from './logic';
import { NeopixelUI, NeopixelContextMenu } from './ui';

export default {
    manifest,
    LogicClass: NeopixelLogic,
    UI: NeopixelUI,
    ContextMenu: NeopixelContextMenu,
    contextMenuDuringRun: false,
    validation
};
