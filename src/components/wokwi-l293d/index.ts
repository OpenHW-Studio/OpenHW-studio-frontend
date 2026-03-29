import manifest from './manifest.json';
import { L293DLogic } from './logic';
import { L293DUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: L293DLogic,
    UI: L293DUI,
    validate
};
