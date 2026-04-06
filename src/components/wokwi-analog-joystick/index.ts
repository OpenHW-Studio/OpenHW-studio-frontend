import { validation } from './validation';
import manifest from './manifest.json';
import { JoystickLogic } from './logic';
import { JoystickUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: JoystickLogic,
    UI: JoystickUI,
    BOUNDS,
    validation,
    doc: docHtml
};
