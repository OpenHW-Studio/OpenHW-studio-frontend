import manifest from './manifest.json';
import { ShiftRegisterLogic } from './logic';
import { ShiftRegisterUI, BOUNDS } from './ui';
import { validation } from './validation';

export default {
    manifest,
    LogicClass: ShiftRegisterLogic,
    UI: ShiftRegisterUI,
    BOUNDS,
    validation
};
