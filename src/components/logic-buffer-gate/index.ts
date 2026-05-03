import { validation } from './validation';
import manifest from './manifest.json';
import { BufferGateLogic } from './logic';
import { BufferGateUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: BufferGateLogic,
    UI: BufferGateUI,
    BOUNDS,
    validation,
    doc: docHtml
};
