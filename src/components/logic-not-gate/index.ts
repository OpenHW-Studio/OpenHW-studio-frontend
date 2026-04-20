import { validation } from './validation';
import manifest from './manifest.json';
import { NotGateLogic } from './logic';
import { NotGateUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: NotGateLogic,
    UI: NotGateUI,
    BOUNDS,
    validation,
    doc: doc
};
