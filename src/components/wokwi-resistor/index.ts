import { validation } from './validation';
import manifest from './manifest.json';
import { ResistorLogic } from './logic';
import { ResistorUI, ResistorContextMenu, BOUNDS } from './ui';

export default {
    manifest,
    LogicClass: ResistorLogic,
    UI: ResistorUI,
    ContextMenu: ResistorContextMenu,
    contextMenuDuringRun: false,
    BOUNDS,
    validation
};
