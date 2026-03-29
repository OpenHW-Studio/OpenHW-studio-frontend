import manifest from './manifest.json';
import { RGBLEDLogic } from './logic';
import { RGBLEDUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: RGBLEDLogic,
    UI: RGBLEDUI,
    validate
};
