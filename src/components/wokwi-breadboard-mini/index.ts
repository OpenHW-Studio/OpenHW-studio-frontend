import manifest from './manifest.json';
import { MiniBreadboardLogic } from './logic';
import { MiniBreadboardUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: MiniBreadboardLogic,
    UI: MiniBreadboardUI,
    validate
};
