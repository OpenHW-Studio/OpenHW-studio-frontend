import { validation } from './validation';
import manifest from './manifest.json';
import { LogicIC74xxLogic } from './logic';
import { LogicIC74xxUI, LogicIC74xxContextMenu, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: LogicIC74xxLogic,
    UI: LogicIC74xxUI,
    ContextMenu: LogicIC74xxContextMenu,
    BOUNDS,
    validation,
    doc: docHtml
};
