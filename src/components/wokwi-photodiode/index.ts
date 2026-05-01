import manifest from './manifest.json';
import { PhotodiodeLogic } from './logic';
import { PhotodiodeUI } from './ui';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: PhotodiodeLogic,
    UI: PhotodiodeUI,
    validation,
    doc: doc
};

