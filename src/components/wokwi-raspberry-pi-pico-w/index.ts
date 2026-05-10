import { validation } from './validation';
import manifest from './manifest.json';
import { PicoWLogic } from './logic';
import { PicoWUI, BOUNDS, contextMenuDuringRun } from './ui';

export default {
  manifest,
  LogicClass: PicoWLogic,
  UI: PicoWUI,
  BOUNDS,
  validation,
};
