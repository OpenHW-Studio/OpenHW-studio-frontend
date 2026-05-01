import manifest from './manifest.json';
import { MiniBreadboardLogic } from './logic';
import { MiniBreadboardUI } from './ui';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: MiniBreadboardLogic,
    UI: MiniBreadboardUI,
    validation,
    doc: doc
};

