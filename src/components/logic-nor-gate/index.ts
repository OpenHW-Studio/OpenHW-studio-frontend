import { validation } from './validation';
import manifest from './manifest.json';
import { NorGateLogic } from './logic';
import { NorGateUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: NorGateLogic,
    UI: NorGateUI,
    BOUNDS,
    validation,
    doc: docHtml
};
