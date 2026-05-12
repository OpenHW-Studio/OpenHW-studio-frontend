import { validation } from './validation';
import manifest from './manifest.json';
import { PowerSupplyLogic } from './logic';
import { PowerSupplyUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: PowerSupplyLogic,
    UI: PowerSupplyUI,
    contextMenuDuringRun: false,
    BOUNDS,
    validation,
    doc: doc
};
