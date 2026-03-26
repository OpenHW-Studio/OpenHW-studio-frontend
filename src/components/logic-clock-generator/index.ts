import { validation } from './validation';
import manifest from './manifest.json';
import { ClockGeneratorLogic } from './logic';
import { ClockGeneratorUI, ClockGeneratorContextMenu, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: ClockGeneratorLogic,
    UI: ClockGeneratorUI,
    ContextMenu: ClockGeneratorContextMenu,
    BOUNDS,
    validation,
    doc: docHtml
};
