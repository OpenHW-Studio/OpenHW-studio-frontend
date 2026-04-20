import { validation } from './validation';
import manifest from './manifest.json';
import { OrGateLogic } from './logic';
import { OrGateUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: OrGateLogic,
    UI: OrGateUI,
    BOUNDS,
    validation,
    doc: doc
};
