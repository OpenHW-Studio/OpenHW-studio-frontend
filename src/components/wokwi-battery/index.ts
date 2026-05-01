import { validation } from './validation';
import manifest from './manifest.json';
import { BatteryLogic } from './logic';
import { LEDUI as BatteryUI, LEDContextMenu as BatteryContextMenu, BOUNDS } from './ui';

import uiRaw from './ui.tsx?raw';
import logicRaw from './logic.ts?raw';
import validationRaw from './validation.ts?raw';

export default {
    manifest,
    LogicClass: BatteryLogic,
    UI: BatteryUI,
    ContextMenu: BatteryContextMenu,
    contextMenuDuringRun: false,
    BOUNDS,
    validation,
    uiRaw,
    logicRaw,
    validationRaw,
};
