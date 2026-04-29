import manifest from './manifest.json';
import { LogicAnalyzerLogic } from './logic';
import { LogicAnalyzerUI } from './ui';
import { validate } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: LogicAnalyzerLogic,
    UI: LogicAnalyzerUI,
    validate,
    doc: doc
};
