import manifest from './manifest.json';
import { A4988Logic } from './logic';
import { A4988UI } from './ui';
import { validate } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: A4988Logic,
    UI: A4988UI,
    validate,
    doc: doc
};
