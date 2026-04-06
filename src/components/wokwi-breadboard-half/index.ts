import manifest from './manifest.json';
import { HalfBreadboardLogic } from './logic';
import { HalfBreadboardUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: HalfBreadboardLogic,
    UI: HalfBreadboardUI,
    validate
};
