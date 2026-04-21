import { validation } from './validation';
import manifest from './manifest.json';
import { JoystickLogic } from './logic';
import { JoystickUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: JoystickLogic,
    UI: JoystickUI,
    BOUNDS,
    validation,
    doc: doc
};
