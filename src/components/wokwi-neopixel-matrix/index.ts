import { validation } from './validation';
import manifest from './manifest.json';
import { NeopixelLogic } from './logic';
import { NeopixelUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: NeopixelLogic,
    UI: NeopixelUI,
    contextMenuDuringRun: false,
    BOUNDS,
    validation,
    doc: doc
};
