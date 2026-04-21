import manifest from './manifest.json';
import { NPNTransistorLogic } from './logic';
import { NPNTransistorUI } from './ui';
import { validate } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: NPNTransistorLogic,
    UI: NPNTransistorUI,
    validate,
    doc: doc
};
