import { validation } from './validation';
import manifest from './manifest.json';
import { DFlipFlopRLogic } from './logic';
import { DFlipFlopRUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: DFlipFlopRLogic,
    UI: DFlipFlopRUI,
    BOUNDS,
    validation,
    doc: doc
};
