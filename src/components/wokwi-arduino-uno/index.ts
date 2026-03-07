import { validation } from './validation';
import manifest from './manifest.json';
import { UnoLogic } from './logic';
import { UnoUI, BOUNDS } from './ui';

export default {
    manifest,
    LogicClass: UnoLogic,
    UI: UnoUI,
    BOUNDS,
    validation
};
