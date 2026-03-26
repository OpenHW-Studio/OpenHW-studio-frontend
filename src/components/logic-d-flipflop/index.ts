import { validation } from './validation';
import manifest from './manifest.json';
import { DFlipFlopLogic } from './logic';
import { DFlipFlopUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: DFlipFlopLogic,
    UI: DFlipFlopUI,
    BOUNDS,
    validation,
    doc: docHtml
};
