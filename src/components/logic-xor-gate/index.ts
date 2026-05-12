import { validation } from './validation';
import manifest from './manifest.json';
import { XorGateLogic } from './logic';
import { XorGateUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: XorGateLogic,
    UI: XorGateUI,
    BOUNDS,
    validation,
    doc: docHtml
};
