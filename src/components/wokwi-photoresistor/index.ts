import manifest from './manifest.json';
import { PhotoresistorLogic } from './logic';
import { PhotoresistorUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: PhotoresistorLogic,
    UI: PhotoresistorUI,
    BOUNDS,
    contextMenuOnlyDuringRun: true,
    doc: docHtml
};
