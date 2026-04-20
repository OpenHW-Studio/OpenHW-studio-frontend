import { validation } from './validation';
import manifest from './manifest.json';
import { PushbuttonLogic } from './logic';
import { PushbuttonUI, PushbuttonContextMenu, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: PushbuttonLogic,
    UI: PushbuttonUI,
    ContextMenu: PushbuttonContextMenu,
    BOUNDS,
    validation,
    doc: doc
};
