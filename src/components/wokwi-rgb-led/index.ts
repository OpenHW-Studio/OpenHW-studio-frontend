import manifest from './manifest.json';
import { RGBLEDLogic } from './logic';
import { RGBLEDUI } from './ui';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: RGBLEDLogic,
    UI: RGBLEDUI,
    validation,
    doc: doc
};

