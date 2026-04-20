import manifest from './manifest.json';
import { MiniBreadboardLogic } from './logic';
import { MiniBreadboardUI } from './ui';
import { validate } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: MiniBreadboardLogic,
    UI: MiniBreadboardUI,
    validate,
    doc: doc
};
