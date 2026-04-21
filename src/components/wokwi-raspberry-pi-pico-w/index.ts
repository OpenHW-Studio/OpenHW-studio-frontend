import { validation } from './validation';
import manifest from './manifest.json';
import { PicoWLogic } from './logic';
import { PicoWUI, PicoWContextMenu, BOUNDS, contextMenuDuringRun } from './ui';

export default {
  manifest,
  LogicClass: PicoWLogic,
  UI: PicoWUI,
  ContextMenu: PicoWContextMenu,
  contextMenuDuringRun,
  BOUNDS,
  validation,
};
