import { validation } from './validation';
import manifest from './manifest.json';
import { XnorGateLogic } from './logic';
import { XnorGateUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: XnorGateLogic,
    UI: XnorGateUI,
    BOUNDS,
    validation,
    doc: docHtml
};
