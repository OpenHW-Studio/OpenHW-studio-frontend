import manifest from './manifest.json';
import { PowerSupplyLogic } from './logic';
import { PowerSupplyUI } from './ui';

export default {
    manifest,
    LogicClass: PowerSupplyLogic,
    UI: PowerSupplyUI
};
