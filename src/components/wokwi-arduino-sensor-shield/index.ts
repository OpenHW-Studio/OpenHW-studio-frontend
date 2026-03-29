import manifest from './manifest.json';
import { SensorShieldLogic } from './logic';
import { SensorShieldUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: SensorShieldLogic,
    UI: SensorShieldUI,
    validate
};
