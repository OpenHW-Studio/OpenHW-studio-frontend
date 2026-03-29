import manifest from './manifest.json';
import { ArduinoNanoLogic } from './logic';
import { ArduinoNanoUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: ArduinoNanoLogic,
    UI: ArduinoNanoUI,
    validate
};
