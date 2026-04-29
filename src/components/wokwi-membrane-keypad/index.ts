import { validation } from './validation';
import manifest from './manifest.json';
import { KeypadLogic } from './logic';
import { KeypadUI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: KeypadLogic,
    UI: KeypadUI,
    BOUNDS,
    validation,
    doc: doc
};
