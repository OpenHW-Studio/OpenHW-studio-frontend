import manifest from './manifest.json';
import { MegaLogic } from './logic';
import { MegaUI, BOUNDS } from './ui';

import { doc } from './doc';

export default {
    manifest,
    LogicClass: MegaLogic,
    UI: MegaUI,
    BOUNDS,
    doc: doc
};
