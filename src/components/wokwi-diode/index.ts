import manifest from './manifest.json';
import { DiodeLogic } from './logic';
import { DiodeUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: DiodeLogic,
    UI: DiodeUI,
    validate
};
