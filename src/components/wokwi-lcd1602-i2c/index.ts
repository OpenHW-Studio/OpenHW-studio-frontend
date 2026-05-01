import manifest from './manifest.json';
import { Lcd1602I2CLogic } from './logic';
import { Lcd1602I2CUI, BOUNDS } from './ui';
import { validation } from './validation';
// @ts-ignore
import doc from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: Lcd1602I2CLogic,
    UI: Lcd1602I2CUI,
    BOUNDS,
    validation,
    doc
};

