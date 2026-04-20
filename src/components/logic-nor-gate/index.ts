import { validation } from './validation';
import manifest from './manifest.json';
import { NorGateLogic } from './logic';
import { NorGateUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: NorGateLogic,
    UI: NorGateUI,
    BOUNDS,
    validation,
    doc: doc
};
