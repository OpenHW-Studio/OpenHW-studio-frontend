import manifest from './manifest.json';
import { PhotodiodeLogic } from './logic';
import { PhotodiodeUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: PhotodiodeLogic,
    UI: PhotodiodeUI,
    validate
};
