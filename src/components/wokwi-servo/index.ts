import { validation } from './validation';
import manifest from './manifest.json';
import { ServoLogic } from './logic';
import { ServoUI } from './ui';

export default {
    manifest,
    LogicClass: ServoLogic,
    UI: ServoUI,
    validation
};
