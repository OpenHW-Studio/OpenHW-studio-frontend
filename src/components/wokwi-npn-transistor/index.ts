import manifest from './manifest.json';
import { NPNTransistorLogic } from './logic';
import { NPNTransistorUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: NPNTransistorLogic,
    UI: NPNTransistorUI,
    validate
};
