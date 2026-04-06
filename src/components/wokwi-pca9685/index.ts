import manifest from './manifest.json';
import { PCA9685Logic } from './logic';
import { PCA9685UI } from './ui';
import { validate } from './validation';

export default {
    manifest,
    Logic: PCA9685Logic,
    UI: PCA9685UI,
    validate
};
