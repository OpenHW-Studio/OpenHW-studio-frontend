import manifest from './manifest.json';
import { SDCardLogic } from './logic';
import { SDCardUI, BOUNDS } from './ui';
import { validation } from './validation';

export default {
    manifest,
    LogicClass: SDCardLogic,
    UI: SDCardUI,
    BOUNDS,
    validation,
};
