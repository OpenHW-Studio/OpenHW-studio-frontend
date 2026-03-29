import manifest from './manifest.json';
import { StepperMotorLogic } from './logic';
import { StepperMotorUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: StepperMotorLogic,
    UI: StepperMotorUI,
    validate
};
