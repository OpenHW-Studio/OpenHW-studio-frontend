import { validation } from './validation';
import manifest from './manifest.json';
import { XorGateLogic } from './logic';
import { XorGateUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: XorGateLogic,
    UI: XorGateUI,
    BOUNDS,
    validation,
    doc: doc
};
