import { validation } from './validation';
import manifest from './manifest.json';
import { MotorDriverLogic } from './logic';
import { MotorDriverUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: MotorDriverLogic,
    UI: MotorDriverUI,
    BOUNDS,
    validation,
    doc: docHtml
};
