import manifest from './manifest.json';
import { RelayModuleUI, RelayModuleContextMenu, BOUNDS } from './ui';
import { RelayModuleLogic } from './logic';
import { validation } from './validation';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    UI:                       RelayModuleUI,
    LogicClass:               RelayModuleLogic,
    BOUNDS,
    ContextMenu:              RelayModuleContextMenu,
    contextMenuDuringRun:     true,
    contextMenuOnlyDuringRun: true,
    validation,
    doc: docHtml,
};
