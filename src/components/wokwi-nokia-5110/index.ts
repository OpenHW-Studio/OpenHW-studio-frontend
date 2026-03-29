import manifest from './manifest.json';
import { Nokia5110Logic } from './logic';
import { Nokia5110UI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: Nokia5110Logic,
    UI: Nokia5110UI,
    validate
};
