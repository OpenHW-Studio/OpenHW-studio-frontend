import * as manifest from './manifest.json';
import { WokwiTM1637Logic } from './logic';
import { WokwiTM1637UI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: WokwiTM1637Logic,
    UI: WokwiTM1637UI,
    validate
};
