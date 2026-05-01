import manifest from './manifest.json';
import { PCA9865Logic } from './logic';
import { PCA9865UI } from './ui';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: PCA9865Logic,
    UI: PCA9865UI,
    validation,
    doc: doc
};

