import { validation } from './validation';
import manifest from './manifest.json';
import { PicoLogic } from './logic';
import { PicoUI, PicoContextMenu, BOUNDS, contextMenuDuringRun } from './ui';

export default {
  manifest,
  LogicClass: PicoLogic,
  UI: PicoUI,
  ContextMenu: PicoContextMenu,
  contextMenuDuringRun,
  BOUNDS,
  validation,
};
