import manifest from './manifest.json';
import { SoilMoistureSensorLogic } from './logic';
import { SoilMoistureSensorUI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: SoilMoistureSensorLogic,
    UI: SoilMoistureSensorUI,
    validate
};
