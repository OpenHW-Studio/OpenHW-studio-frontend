import { HCSR04Logic } from './logic';
import { HCSR04UI, HCSR04ContextMenu } from './ui';
import manifest from './manifest.json';
import { doc } from './doc';

export default {
    manifest,
    Logic: HCSR04Logic,
    UI: HCSR04UI,
    ContextMenu: HCSR04ContextMenu,
    contextMenuDuringRun: true,
    doc
};
