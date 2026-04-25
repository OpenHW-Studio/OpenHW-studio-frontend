import manifest from './manifest.json';
import { RotaryEncoderLogic } from './logic';
import { RotaryEncoderUI } from './ui';
import { validate } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: RotaryEncoderLogic,
    UI: RotaryEncoderUI,
    validate,
    doc: doc
};
