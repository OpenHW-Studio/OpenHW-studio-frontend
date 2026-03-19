import manifest from './manifest.json';
import { Lcd2004I2CUI } from './ui';
import { Lcd2004I2CLogic } from './logic';
import { validation } from './validation';
import docHtml from './doc/index.html?raw';

export default { manifest, UI: Lcd2004I2CUI, LogicClass: Lcd2004I2CLogic, validation, doc: docHtml };