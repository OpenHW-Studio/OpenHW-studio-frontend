import { validation } from './validation';
import manifest from './manifest.json';
import { NotGateLogic } from './logic';
import { NotGateUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: NotGateLogic,
    UI: NotGateUI,
    BOUNDS,
    validation,
    doc: docHtml
};
