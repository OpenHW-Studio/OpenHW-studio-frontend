import { validation } from './validation';
import manifest from './manifest.json';
import { LEDLogic } from './logic';
import { LEDUI, LEDContextMenu, BOUNDS } from './ui';
import docHtml from './doc/index.html?raw';

import uiRaw from './ui.tsx?raw';
import logicRaw from './logic.ts?raw';
import validationRaw from './validation.ts?raw';

export default {
    manifest,
    LogicClass: LEDLogic,
    UI: LEDUI,
    ContextMenu: LEDContextMenu,
    contextMenuDuringRun: false,
    BOUNDS,
    validation,
    doc: docHtml,
    uiRaw,
    logicRaw,
    validationRaw,
    autocoding: {
        arduino: {
            setup: "pinMode(13, OUTPUT);",
            loop: "digitalWrite(13, HIGH);\ndelay(500);\ndigitalWrite(13, LOW);\ndelay(500);"
        },
        micropython: {
            setup: "from machine import Pin\nfrom time import sleep\nled = Pin(25, Pin.OUT)",
            loop: "while True:\n    led.toggle()\n    sleep(0.5)"
        }
    },
    autowiring: {
        connections: [
            { from: "A", to: "arduino:13", via: "wokwi-resistor", attrs: { value: "220" } },
            { from: "K", to: "arduino:GND" }
        ]
    }
};
