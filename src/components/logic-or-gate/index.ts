import { validation } from './validation';
import manifest from './manifest.json';
import { OrGateLogic } from './logic';
import { OrGateUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: OrGateLogic,
    UI: OrGateUI,
    BOUNDS,
    validation,
    doc: docHtml
};
