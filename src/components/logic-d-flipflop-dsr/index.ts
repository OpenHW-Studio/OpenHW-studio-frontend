import { validation } from './validation';
import manifest from './manifest.json';
import { DFlipFlopDsrLogic } from './logic';
import { DFlipFlopDsrUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: DFlipFlopDsrLogic,
    UI: DFlipFlopDsrUI,
    BOUNDS,
    validation,
    doc: docHtml
};
