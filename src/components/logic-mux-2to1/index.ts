import { validation } from './validation';
import manifest from './manifest.json';
import { Mux2to1Logic } from './logic';
import { Mux2to1UI, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

export default {
    manifest,
    LogicClass: Mux2to1Logic,
    UI: Mux2to1UI,
    BOUNDS,
    validation,
    doc: docHtml
};
