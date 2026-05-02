import manifest from './manifest.json';
import { SoilMoistureSensorLogic } from './logic';
import { SoilMoistureSensorUI } from './ui';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: SoilMoistureSensorLogic,
    UI: SoilMoistureSensorUI,
    validation,
    doc: doc
};

