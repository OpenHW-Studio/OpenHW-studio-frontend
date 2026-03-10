import { validation } from './validation';
import manifest from './manifest.json';
import { UnoLogic } from './logic';
import { UnoUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: UnoLogic,
    UI: UnoUI,
    BOUNDS,
    validation,
    doc: docHtml
};
