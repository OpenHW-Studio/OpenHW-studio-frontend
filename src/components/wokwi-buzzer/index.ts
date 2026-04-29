import { validation } from './validation';
import manifest from './manifest.json';
import { BuzzerLogic } from './logic';
import { BuzzerUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: BuzzerLogic,
    UI: BuzzerUI,
    BOUNDS,
    validation,
    doc: doc
};
