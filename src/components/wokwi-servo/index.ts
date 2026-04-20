import { validation } from './validation';
import manifest from './manifest.json';
import { ServoLogic } from './logic';
import { ServoUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: ServoLogic,
    UI: ServoUI,
    BOUNDS,
    validation,
    doc: doc
};
