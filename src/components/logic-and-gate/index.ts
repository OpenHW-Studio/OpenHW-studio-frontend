import { validation } from './validation';
import manifest from './manifest.json';
import { AndGateLogic } from './logic';
import { AndGateUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: AndGateLogic,
    UI: AndGateUI,
    BOUNDS,
    validation,
    doc: docHtml
};
