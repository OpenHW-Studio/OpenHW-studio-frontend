import manifest from './manifest.json';
import { ATtiny85Logic } from './logic';
import { ATtiny85UI, BOUNDS } from './ui';
import { doc } from './doc';

export default {
    manifest,
    LogicClass: ATtiny85Logic,
    UI: ATtiny85UI,
    BOUNDS,
    doc: doc
};
