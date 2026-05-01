import manifest from './manifest.json';
import { LogicAnalyzerLogic } from './logic';
import { LogicAnalyzerUI } from './ui';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    Logic: LogicAnalyzerLogic,
    UI: LogicAnalyzerUI,
    validation,
    doc: doc
};

