import { validation } from './validation';
import manifest from './manifest.json';
import { XnorGateLogic } from './logic';
import { XnorGateUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: XnorGateLogic,
    UI: XnorGateUI,
    BOUNDS,
    validation,
    doc: doc
};
