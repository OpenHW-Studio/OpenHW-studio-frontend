import { validation } from './validation';
import manifest from './manifest.json';
import { ServoLogic } from './logic';
import { ServoUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: ServoLogic,
    UI: ServoUI,
    BOUNDS,
    validation,
    doc: docHtml
};
