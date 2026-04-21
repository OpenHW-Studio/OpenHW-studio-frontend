import manifest from './manifest.json';
import { SoilMoistureSensorLogic } from './logic';
import { SoilMoistureSensorUI } from './ui';
import { validate } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: SoilMoistureSensorLogic,
    UI: SoilMoistureSensorUI,
    validate,
    doc: doc
};
