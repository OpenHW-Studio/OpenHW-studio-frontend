import manifest from './manifest.json';
import { MAX7219UI } from './ui';
import { MAX7219Logic } from './logic';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    UI: MAX7219UI,
    LogicClass: MAX7219Logic,
    validation,
    doc: doc
};