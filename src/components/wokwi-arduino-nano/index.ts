import manifest from './manifest.json';
import { ArduinoNanoLogic } from './logic';
import { ArduinoNanoUI } from './ui';
import { validate } from './validation';

import { doc } from './doc';

export default {
    manifest,
    Logic: ArduinoNanoLogic,
    UI: ArduinoNanoUI,
    validate,
    doc: doc
};
