import manifest from './manifest.json';
import { ILI9341UI, BOUNDS } from './ui';
import { ILI9341Logic } from './logic';
import { validation } from './validation';
import { doc } from './doc';

export default {
    manifest,
    UI: ILI9341UI,
    LogicClass: ILI9341Logic,
    BOUNDS,
    contextMenuDuringRun: true,
    validation,
    doc: doc
};