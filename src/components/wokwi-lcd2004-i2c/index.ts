import manifest from './manifest.json';
import { Lcd2004I2CUI } from './ui';
import { Lcd2004I2CLogic } from './logic';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    UI: Lcd2004I2CUI,
    LogicClass: Lcd2004I2CLogic,
    validation,
    doc: doc
};