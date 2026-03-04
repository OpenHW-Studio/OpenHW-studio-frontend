import { validation } from './validation';
import manifest from './manifest.json';
import { PotentiometerLogic } from './logic';
import { PotentiometerUI } from './ui';

export default {
    manifest,
    LogicClass: PotentiometerLogic,
    UI: PotentiometerUI,
    validation
};
