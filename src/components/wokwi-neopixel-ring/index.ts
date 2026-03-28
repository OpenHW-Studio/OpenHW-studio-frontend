import * as manifest from './manifest.json';
import { NeopixelRingLogic } from './logic';
import { NeopixelRingUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: NeopixelRingLogic,
    UI: NeopixelRingUI,
    validate
};
