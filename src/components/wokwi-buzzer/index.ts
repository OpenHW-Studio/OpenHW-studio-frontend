import { validation } from './validation';
import manifest from './manifest.json';
import { BuzzerLogic } from './logic';
import { BuzzerUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: BuzzerLogic,
    UI: BuzzerUI,
    BOUNDS,
    validation,
    doc: docHtml
};
