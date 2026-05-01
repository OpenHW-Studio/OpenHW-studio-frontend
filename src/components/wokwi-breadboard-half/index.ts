import manifest from './manifest.json';
import { HalfBreadboardLogic } from './logic';
import { HalfBreadboardUI } from './ui';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: HalfBreadboardLogic,
    UI: HalfBreadboardUI,
    validation,
    doc: doc
};

