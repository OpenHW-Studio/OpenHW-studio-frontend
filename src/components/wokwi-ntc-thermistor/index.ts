import { validation } from './validation';
import manifest from './manifest.json';
import { NTCThermistorLogic } from './logic';
import { NTCComparatorUI, NTCComparatorContextMenu } from './ui';

export default {
    manifest,
    LogicClass: NTCThermistorLogic,
    UI: NTCComparatorUI,
    ContextMenu: NTCComparatorContextMenu,
    contextMenuDuringRun: false,
    contextMenuOnlyDuringRun: true,
    validation,
};
