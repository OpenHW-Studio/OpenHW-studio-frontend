import { validation } from './validation';
import manifest from './manifest.json';
import { SlidePotLogic } from './logic';
import { SlidePotUI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: SlidePotLogic,
    UI: SlidePotUI,
    BOUNDS,
    validation,
    doc: docHtml
};
