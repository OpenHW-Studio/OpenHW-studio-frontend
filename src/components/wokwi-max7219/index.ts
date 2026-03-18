import manifest from './manifest.json';
import { MAX7219UI } from './ui';
import { MAX7219Logic } from './logic';
import { validation } from './validation';
import docHtml from './doc/index.html?raw';

export default { 
    manifest, 
    UI: MAX7219UI, 
    LogicClass: MAX7219Logic,
    validation,
    doc: docHtml
};