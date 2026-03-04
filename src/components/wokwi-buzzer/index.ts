import { validation } from './validation';
import manifest from './manifest.json';
import { BuzzerLogic } from './logic';
import { BuzzerUI } from './ui';

export default {
    manifest,
    LogicClass: BuzzerLogic,
    UI: BuzzerUI,
    validation
};
