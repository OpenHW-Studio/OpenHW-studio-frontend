import manifest from './manifest.json';
import { RotaryEncoderLogic } from './logic';
import { RotaryEncoderUI } from './ui';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: RotaryEncoderLogic,
    UI: RotaryEncoderUI,
    validation,
    doc: doc
};

