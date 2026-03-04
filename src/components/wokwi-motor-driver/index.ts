import { validation } from './validation';
import manifest from './manifest.json';
import { MotorDriverLogic } from './logic';
import { MotorDriverUI } from './ui';

export default {
    manifest,
    LogicClass: MotorDriverLogic,
    UI: MotorDriverUI,
    validation
};
