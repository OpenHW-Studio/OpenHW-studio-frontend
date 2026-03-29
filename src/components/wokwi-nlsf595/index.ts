import manifest from './manifest.json';
import { NLSF595Logic } from './logic';
import { NLSF595UI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: NLSF595Logic,
    UI: NLSF595UI,
    validate
};
