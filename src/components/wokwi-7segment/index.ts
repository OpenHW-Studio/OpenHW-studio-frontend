import manifest from './manifest.json';
import { Wokwi7SegmentLogic } from './logic';
import { Wokwi7SegmentUI } from './ui';
import { validation } from './validation';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: Wokwi7SegmentLogic,
    UI: Wokwi7SegmentUI,
    validation,
    doc: docHtml
};