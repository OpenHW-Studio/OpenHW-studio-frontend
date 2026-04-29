import manifest from './manifest.json';
import { PhotodiodeLogic } from './logic';
import { PhotodiodeUI } from './ui';
import { validate } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: PhotodiodeLogic,
    UI: PhotodiodeUI,
    validate,
    doc: doc
};
