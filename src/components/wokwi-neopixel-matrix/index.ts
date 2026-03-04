import { validation } from './validation';
import manifest from './manifest.json';
import { NeopixelLogic } from './logic';
import { NeopixelUI } from './ui';

export default {
    manifest,
    LogicClass: NeopixelLogic,
    UI: NeopixelUI,
    validation
};
