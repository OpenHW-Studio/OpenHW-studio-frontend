import manifest from './manifest.json';
import { NtcLogic } from './logic';
import { NtcUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: NtcLogic,
    UI: NtcUI,
    BOUNDS,
    contextMenuOnlyDuringRun: true,
    doc: docHtml
};
