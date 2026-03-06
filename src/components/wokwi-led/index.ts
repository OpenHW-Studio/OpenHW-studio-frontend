import { validation } from './validation';
import manifest from './manifest.json';
import { LEDLogic } from './logic';
import { LEDUI, LEDContextMenu } from './ui';

export default {
    manifest,
    LogicClass: LEDLogic,
    UI: LEDUI,
    ContextMenu: LEDContextMenu,
    contextMenuDuringRun: false,
    validation
};
