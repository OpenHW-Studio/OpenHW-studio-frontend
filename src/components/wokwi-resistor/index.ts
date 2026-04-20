import { validation } from './validation';
import manifest from './manifest.json';
import { ResistorLogic } from './logic';
import { ResistorUI, ResistorContextMenu, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: ResistorLogic,
    UI: ResistorUI,
    ContextMenu: ResistorContextMenu,
    contextMenuDuringRun: false,
    BOUNDS,
    validation,
    doc: doc
};
