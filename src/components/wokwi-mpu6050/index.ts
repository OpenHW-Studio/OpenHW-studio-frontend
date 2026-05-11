import manifest from './manifest.json';
import { MPU6050UI, MPU6050ContextMenu, BOUNDS } from './ui';
import { MPU6050Logic } from './logic';
import { validation } from './validation';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    UI:                       MPU6050UI,
    LogicClass:               MPU6050Logic,
    BOUNDS,
    ContextMenu:              MPU6050ContextMenu,
    contextMenuDuringRun:     true,
    contextMenuOnlyDuringRun: true,
    validation,
    doc: docHtml,
};
