import manifest from './manifest.json';
import { SensorShieldLogic } from './logic';
import { SensorShieldUI } from './ui';
import { validation } from './validation';

export default {
    manifest,
    Logic: SensorShieldLogic,
    UI: SensorShieldUI,
    validation
};

