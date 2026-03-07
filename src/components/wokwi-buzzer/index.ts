import { validation } from './validation';
import manifest from './manifest.json';
import { BuzzerLogic } from './logic';
import { BuzzerUI, BOUNDS } from './ui';

export default {
    manifest,
    LogicClass: BuzzerLogic,
    UI: BuzzerUI,
    BOUNDS,
    validation
};
