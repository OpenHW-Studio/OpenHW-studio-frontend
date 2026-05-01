import manifest from './manifest.json';
import { DiodeLogic } from './logic';
import { DiodeUI } from './ui';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: DiodeLogic,
    UI: DiodeUI,
    validation,
    doc: doc
};

