import manifest from './manifest.json';
import { BreadboardLogic } from './logic';
import { BreadboardUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: BreadboardLogic,
    UI: BreadboardUI,
    validate
};
