import manifest from './manifest.json';
import { SSD1306UI } from './ui';
import { SSD1306Logic } from './logic';
import { validation } from './validation';
import docHtml from './doc/index.html?raw';

export default { manifest, UI: SSD1306UI, LogicClass: SSD1306Logic, validation, doc: docHtml };