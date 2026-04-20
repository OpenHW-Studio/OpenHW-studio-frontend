import { validation } from './validation';
import manifest from './manifest.json';
import { AndGateLogic } from './logic';
import { AndGateUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: AndGateLogic,
    UI: AndGateUI,
    BOUNDS,
    validation,
    doc: doc
};
