import { validation } from './validation';
import manifest from './manifest.json';
import { MotorDriverLogic } from './logic';
import { MotorDriverUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: MotorDriverLogic,
    UI: MotorDriverUI,
    BOUNDS,
    validation,
    doc: doc
};
