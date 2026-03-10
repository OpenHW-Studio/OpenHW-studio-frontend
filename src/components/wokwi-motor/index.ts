import { validation } from './validation';
import manifest from './manifest.json';
import { MotorLogic } from './logic';
import { MotorUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: MotorLogic,
    UI: MotorUI,
    BOUNDS,
    validation,
    doc: docHtml
};
