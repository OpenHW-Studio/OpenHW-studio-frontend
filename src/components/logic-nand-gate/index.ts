import { validation } from './validation';
import manifest from './manifest.json';
import { NandGateLogic } from './logic';
import { NandGateUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: NandGateLogic,
    UI: NandGateUI,
    BOUNDS,
    validation,
    doc: docHtml
};
