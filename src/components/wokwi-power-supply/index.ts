import { validation } from './validation';
import manifest from './manifest.json';
import { PowerSupplyLogic } from './logic';
import { PowerSupplyUI, PowerSupplyContextMenu, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: PowerSupplyLogic,
    UI: PowerSupplyUI,
    ContextMenu: PowerSupplyContextMenu,
    contextMenuDuringRun: false,
    BOUNDS,
    validation,
    doc: docHtml
};
