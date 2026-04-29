import { validation } from './validation';
import manifest from './manifest.json';
import { ClockGeneratorLogic } from './logic';
import { ClockGeneratorUI, ClockGeneratorContextMenu, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: ClockGeneratorLogic,
    UI: ClockGeneratorUI,
    ContextMenu: ClockGeneratorContextMenu,
    BOUNDS,
    validation,
    doc: doc
};
