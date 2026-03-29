import { validation } from './validation';
import manifest from './manifest.json';
import { DFlipFlopRLogic } from './logic';
import { DFlipFlopRUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: DFlipFlopRLogic,
    UI: DFlipFlopRUI,
    BOUNDS,
    validation,
    doc: docHtml
};
