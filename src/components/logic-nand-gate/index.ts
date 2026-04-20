import { validation } from './validation';
import manifest from './manifest.json';
import { NandGateLogic } from './logic';
import { NandGateUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: NandGateLogic,
    UI: NandGateUI,
    BOUNDS,
    validation,
    doc: doc
};
