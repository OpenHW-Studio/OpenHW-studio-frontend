import { validation } from './validation';
import manifest from './manifest.json';
import { SlidePotLogic } from './logic';
import { SlidePotUI, BOUNDS } from './ui';

export default {
    manifest,
    LogicClass: SlidePotLogic,
    UI: SlidePotUI,
    BOUNDS,
    validation
};
