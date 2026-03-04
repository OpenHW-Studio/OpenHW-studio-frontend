import { validation } from './validation';
import manifest from './manifest.json';
import { ResistorLogic } from './logic';
import { ResistorUI } from './ui';

export default {
    manifest,
    LogicClass: ResistorLogic,
    UI: ResistorUI,
    validation
};
