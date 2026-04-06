import manifest from './manifest.json';
import { RotaryEncoderLogic } from './logic';
import { RotaryEncoderUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: RotaryEncoderLogic,
    UI: RotaryEncoderUI,
    validate
};
