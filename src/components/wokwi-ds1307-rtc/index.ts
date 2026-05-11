import manifest from './manifest.json';
import { DS1307RTCUI, DS1307RTCContextMenu, BOUNDS } from './ui';
import { DS1307RTCLogic } from './logic';
import { validation } from './validation';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    UI:                       DS1307RTCUI,
    LogicClass:               DS1307RTCLogic,
    BOUNDS,
    ContextMenu:              DS1307RTCContextMenu,
    contextMenuDuringRun:     true,
    contextMenuOnlyDuringRun: true,
    validation,
    doc: docHtml,
};
