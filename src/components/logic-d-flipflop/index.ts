import { validation } from './validation';
import manifest from './manifest.json';
import { DFlipFlopLogic } from './logic';
import { DFlipFlopUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: DFlipFlopLogic,
    UI: DFlipFlopUI,
    BOUNDS,
    validation,
    doc: doc
};
