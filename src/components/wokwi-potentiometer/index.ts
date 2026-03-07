import { validation } from './validation';
import manifest from './manifest.json';
import { PotentiometerLogic } from './logic';
import { PotentiometerUI, BOUNDS } from './ui';

export default {
    manifest,
    LogicClass: PotentiometerLogic,
    UI: PotentiometerUI,
    BOUNDS,
    validation
};
