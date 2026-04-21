import { validation } from './validation';
import manifest from './manifest.json';
import { PowerSupplyLogic } from './logic';
import { PowerSupplyUI, PowerSupplyContextMenu, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: PowerSupplyLogic,
    UI: PowerSupplyUI,
    ContextMenu: PowerSupplyContextMenu,
    contextMenuDuringRun: false,
    BOUNDS,
    validation,
    doc: doc
};
