import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(__dirname, "../src/services/guidedProjects.json");
const raw = readFileSync(jsonPath, "utf-8");
const data = JSON.parse(raw);

const BOARD = "openhw-arduino-uno";

function unoAnchor(pin) {
  return { breadboard: { anchorPin: pin }, targetBoard: "uno1" };
}

function arduino(x, y) {
  return {
    id: "uno1", type: "openhw-arduino-uno", label: "Arduino Uno",
    x, y, w: 425, h: 320, rotation: 0, attrs: {},
  };
}

function led(id, x, y, pin, color) {
  return {
    id, type: "openhw-led", label: "LED", x, y, w: 35, h: 35,
    rotation: 0, attrs: { color: color || "red", ...unoAnchor(pin) },
  };
}

function resistor(id, x, y, value) {
  return {
    id, type: "openhw-resistor", label: "Resistor", x, y, w: 70, h: 32,
    rotation: 0, attrs: { value: value || "220" },
  };
}

function buzzer(id, x, y, pin) {
  return {
    id, type: "openhw-buzzer", label: "Buzzer", x, y, w: 50, h: 50,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

function pushbutton(id, x, y, pin) {
  return {
    id, type: "openhw-pushbutton", label: "Push Button", x, y, w: 40, h: 40,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

function rgbLed(id, x, y) {
  return {
    id, type: "openhw-rgb-led", label: "RGB LED (4-pin)", x, y, w: 75, h: 105,
    rotation: 0, attrs: { common: "cathode", ...unoAnchor("GND") },
  };
}

function potentiometer(id, x, y, pin) {
  return {
    id, type: "openhw-potentiometer", label: "Potentiometer", x, y, w: 50, h: 70,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

function ldrModule(id, x, y, pin) {
  return {
    id, type: "openhw-ldr-module", label: "LDR Module", x, y, w: 50, h: 50,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

function hcSr04(id, x, y) {
  return {
    id, type: "openhw-hc-sr04", label: "HC-SR04", x, y, w: 60, h: 70,
    rotation: 0, attrs: {},
  };
}

function pirSensor(id, x, y, pin) {
  return {
    id, type: "openhw-pir-motion-sensor", label: "PIR Motion Sensor", x, y, w: 50, h: 50,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

function dht22(id, x, y, pin) {
  return {
    id, type: "openhw-dht22", label: "DHT22", x, y, w: 45, h: 50,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

function lcd1602(id, x, y) {
  return {
    id, type: "wokwi-lcd1602", label: "16x2 LCD", x, y, w: 150, h: 80,
    rotation: 0, attrs: {},
  };
}

function servo(id, x, y, pin) {
  return {
    id, type: "openhw-servo", label: "Servo Motor", x, y, w: 50, h: 70,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

function dcMotor(id, x, y) {
  return {
    id, type: "openhw-motor", label: "DC Motor", x, y, w: 50, h: 50,
    rotation: 0, attrs: {},
  };
}

function l293d(id, x, y) {
  return {
    id, type: "openhw-l293d", label: "L293D Motor Driver", x, y, w: 80, h: 100,
    rotation: 0, attrs: {},
  };
}

function tmp36(id, x, y, pin) {
  return {
    id, type: "openhw-ntc-temperature-sensor", label: "TMP36", x, y, w: 40, h: 45,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

function hc05(id, x, y) {
  return {
    id, type: "openhw-arduino-uno", label: "HC-05 Bluetooth", x, y, w: 50, h: 70,
    rotation: 0, attrs: {},
  };
}

function irReceiver(id, x, y, pin) {
  return {
    id, type: "openhw-ir-receiver", label: "IR Receiver", x, y, w: 40, h: 40,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

function esp32(id, x, y) {
  return {
    id, type: "openhw-esp32", label: "ESP32", x, y, w: 100, h: 80,
    rotation: 0, attrs: {},
  };
}

function breadboardHalf(id, x, y) {
  return {
    id, type: "openhw-breadboard-half", label: "Breadboard", x, y, w: 300, h: 200,
    rotation: 0, attrs: {},
  };
}

function waterSensor(id, x, y, pin) {
  return {
    id, type: "openhw-soil-moisture-sensor", label: "Water Level Sensor", x, y, w: 45, h: 50,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

function mq2GasSensor(id, x, y, pin) {
  return {
    id, type: "openhw-mq2-gas-sensor", label: "MQ-2 Gas Sensor", x, y, w: 50, h: 60,
    rotation: 0, attrs: unoAnchor(pin),
  };
}

const compNames = {
  "LED": { type: "openhw-led", build: (id, x, y, pin) => led(id, x, y, pin || "13", "red") },
  "Green LED": { type: "openhw-led", build: (id, x, y, pin) => led(id, x, y, pin || "13", "green") },
  "Yellow LED": { type: "openhw-led", build: (id, x, y, pin) => led(id, x, y, pin || "13", "yellow") },
  "Red LED": { type: "openhw-led", build: (id, x, y, pin) => led(id, x, y, pin || "13", "red") },
  "RGB LED": { type: "openhw-rgb-led", build: (id, x, y) => rgbLed(id, x, y) },
  "RGB LED (4-pin)": { type: "openhw-rgb-led", build: (id, x, y) => rgbLed(id, x, y) },
  "220Ω Resistor": { type: "openhw-resistor", build: (id, x, y) => resistor(id, x, y, "220") },
  "10kΩ Resistor": { type: "openhw-resistor", build: (id, x, y) => resistor(id, x, y, "10000") },
  "1kΩ Resistor": { type: "openhw-resistor", build: (id, x, y) => resistor(id, x, y, "1000") },
  "330Ω Resistor": { type: "openhw-resistor", build: (id, x, y) => resistor(id, x, y, "330") },
  "Push Button": { type: "openhw-pushbutton", build: (id, x, y, pin) => pushbutton(id, x, y, pin || "2") },
  "Buzzer": { type: "openhw-buzzer", build: (id, x, y, pin) => buzzer(id, x, y, pin || "8") },
  "Potentiometer": { type: "openhw-potentiometer", build: (id, x, y, pin) => potentiometer(id, x, y, pin || "A0") },
  "LDR": { type: "openhw-ldr-module", build: (id, x, y, pin) => ldrModule(id, x, y, pin || "A0") },
  "LDR Module": { type: "openhw-ldr-module", build: (id, x, y, pin) => ldrModule(id, x, y, pin || "A0") },
  "HC-SR04": { type: "openhw-hc-sr04", build: (id, x, y) => hcSr04(id, x, y) },
  "PIR Motion Sensor": { type: "openhw-pir-motion-sensor", build: (id, x, y, pin) => pirSensor(id, x, y, pin || "2") },
  "MQ-2 Gas Sensor": { type: "openhw-mq2-gas-sensor", build: (id, x, y, pin) => mq2GasSensor(id, x, y, pin || "A0") },
  "DHT11/DHT22": { type: "openhw-dht22", build: (id, x, y, pin) => dht22(id, x, y, pin || "2") },
  "16x2 LCD": { type: "wokwi-lcd1602", build: (id, x, y) => lcd1602(id, x, y) },
  "Servo Motor": { type: "openhw-servo", build: (id, x, y, pin) => servo(id, x, y, pin || "9") },
  "DC Motor": { type: "openhw-motor", build: (id, x, y) => dcMotor(id, x, y) },
  "L293D": { type: "openhw-l293d", build: (id, x, y) => l293d(id, x, y) },
  "L293D Motor Driver": { type: "openhw-l293d", build: (id, x, y) => l293d(id, x, y) },
  "TMP36": { type: "openhw-ntc-temperature-sensor", build: (id, x, y, pin) => tmp36(id, x, y, pin || "A0") },
  "HC-05 Module": { type: "openhw-arduino-uno", build: (id, x, y) => hc05(id, x, y) },
  "HC-05": { type: "openhw-arduino-uno", build: (id, x, y) => hc05(id, x, y) },
  "IR Receiver": { type: "openhw-ir-receiver", build: (id, x, y, pin) => irReceiver(id, x, y, pin || "11") },
  "IR Remote Receiver": { type: "openhw-ir-receiver", build: (id, x, y, pin) => irReceiver(id, x, y, pin || "11") },
  "ESP32": { type: "openhw-esp32", build: (id, x, y) => esp32(id, x, y) },
  "ESP8266": { type: "openhw-esp32", build: (id, x, y) => ({ ...esp32(id, x, y), label: "ESP8266", type: "wokwi-esp32-devkit-v1" }) },
  "Water Level Sensor": { type: "openhw-soil-moisture-sensor", build: (id, x, y, pin) => waterSensor(id, x, y, pin || "A0") },
  "Breadboard": { type: "openhw-breadboard-half", build: (id, x, y) => breadboardHalf(id, x, y) },
  "RF Module": { type: "openhw-nrf24l01", build: (id, x, y) => ({ id, type: "openhw-nrf24l01", label: "RF Module", x, y, w: 50, h: 60, rotation: 0, attrs: {} }) },
  "Robot Chassis": null,
  "2x DC Motors": { type: "openhw-motor", build: (id, x, y) => dcMotor(id, x, y) },
};

function resolveComp(name, idx, yOff, pin) {
  const entry = compNames[name];
  if (!entry) return null;
  if (name === "Robot Chassis" || name === "Breadboard") return null;
  const id = `comp_${idx}`;
  if (name.includes("LED") && name !== "RGB LED" && name !== "RGB LED (4-pin)") {
    const color = name.includes("Green") ? "green" : name.includes("Yellow") ? "yellow" : name.includes("Red") ? "red" : "red";
    return led(id, 200, yOff, pin || "13", color);
  }
  return entry.build(id, 200, yOff, pin);
}

function extractPins(code) {
  const pins = {};
  const pinModeRe = /pinMode\s*\(\s*(\d+|A0|A1|A2|A3|A4|A5)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*\)/gi;
  let m;
  while ((m = pinModeRe.exec(code)) !== null) {
    pins[m[1].toUpperCase()] = m[2].toUpperCase();
  }
  const digitalWriteRe = /digitalWrite\s*\(\s*(\d+|A0|A1|A2|A3|A4|A5)\s*,/gi;
  while ((m = digitalWriteRe.exec(code)) !== null) {
    const p = m[1].toUpperCase();
    if (!pins[p]) pins[p] = "OUTPUT";
  }
  const analogReadRe = /analogRead\s*\(\s*(A\d+)\s*\)/gi;
  while ((m = analogReadRe.exec(code)) !== null) {
    if (!pins[m[1].toUpperCase()]) pins[m[1].toUpperCase()] = "INPUT";
  }
  const analogWriteRe = /analogWrite\s*\(\s*(\d+|A0|A1|A2|A3|A4|A5)\s*,/gi;
  while ((m = analogWriteRe.exec(code)) !== null) {
    const p = m[1].toUpperCase();
    if (!pins[p]) pins[p] = "OUTPUT";
  }
  return pins;
}

function genWires(compList, arduinoComp, pins) {
  const wires = [];
  let wireIdx = 0;
  for (let i = 0; i < compList.length; i++) {
    const name = compList[i];
    if (name === "Robot Chassis" || name === "Breadboard" || name === "Arduino Uno") continue;
    const cid = `comp_${i}`;
    if (name === "LED" || name.match(/^\w+ LED$/)) {
      const pin = Object.keys(pins).find(p => pins[p] === "OUTPUT") || "13";
      wires.push({
        id: `w_${wireIdx++}`, from: `${cid}:a`, to: `r_${i}:p1`,
        color: "orange", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false,
        fromLabel: "", toLabel: "",
      });
      wires.push({
        id: `w_${wireIdx++}`, from: `r_${i}:p2`, to: `${arduinoComp}:${pin}`,
        color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false,
        fromLabel: "", toLabel: "",
      });
      wires.push({
        id: `w_${wireIdx++}`, from: `${cid}:k`, to: `${arduinoComp}:GND`,
        color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false,
        fromLabel: "", toLabel: "",
      });
    } else if (name === "Buzzer") {
      const pin = Object.keys(pins).find(p => pins[p] === "OUTPUT" && p !== "13") || "8";
      wires.push({
        id: `w_${wireIdx++}`, from: `${cid}:p`, to: `${arduinoComp}:${pin}`,
        color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false,
        fromLabel: "", toLabel: "",
      });
      wires.push({
        id: `w_${wireIdx++}`, from: `${cid}:n`, to: `${arduinoComp}:GND`,
        color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false,
        fromLabel: "", toLabel: "",
      });
    } else if (name === "Push Button") {
      const pin = Object.keys(pins).find(p => pins[p] !== "OUTPUT" && p.match(/^\d+$/)) || "2";
      wires.push({
        id: `w_${wireIdx++}`, from: `${cid}:p1`, to: `${arduinoComp}:${pin}`,
        color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false,
        fromLabel: "", toLabel: "",
      });
      wires.push({
        id: `w_${wireIdx++}`, from: `${cid}:p2`, to: `${arduinoComp}:GND`,
        color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false,
        fromLabel: "", toLabel: "",
      });
    } else if (name === "RGB LED" || name === "RGB LED (4-pin)") {
      const outPins = Object.keys(pins).filter(p => pins[p] === "OUTPUT").sort();
      const rPin = outPins[0] || "11";
      const gPin = outPins[1] || "10";
      const bPin = outPins[2] || "9";
      const ri = `${cid}_r_res`; const gi = `${cid}_g_res`; const bi = `${cid}_b_res`;
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:R`, to: `${ri}:p1`, color: "orange", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${ri}:p2`, to: `${arduinoComp}:${rPin}`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:G`, to: `${gi}:p1`, color: "orange", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${gi}:p2`, to: `${arduinoComp}:${gPin}`, color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:B`, to: `${bi}:p1`, color: "orange", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${bi}:p2`, to: `${arduinoComp}:${bPin}`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:V`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "Potentiometer" || name === "LDR" || name === "LDR Module" || name === "TMP36" || name === "Water Level Sensor") {
      const analogPin = Object.keys(pins).find(p => p.startsWith("A")) || "A0";
      wires.push({
        id: `w_${wireIdx++}`, from: `${cid}:s`, to: `${arduinoComp}:${analogPin}`,
        color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false,
        fromLabel: "", toLabel: "",
      });
      wires.push({
        id: `w_${wireIdx++}`, from: `${cid}:v`, to: `${arduinoComp}:5V`,
        color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false,
        fromLabel: "", toLabel: "",
      });
      wires.push({
        id: `w_${wireIdx++}`, from: `${cid}:g`, to: `${arduinoComp}:GND`,
        color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false,
        fromLabel: "", toLabel: "",
      });
    } else if (name === "HC-SR04") {
      const pins_arr = Object.keys(pins).filter(p => pins[p] === "OUTPUT" || pins[p] === "INPUT");
      const trig = pins_arr.find(p => pins[p] === "OUTPUT") || "9";
      const echo = pins_arr.find(p => pins[p] === "INPUT") || "10";
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:trig`, to: `${arduinoComp}:${trig}`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:echo`, to: `${arduinoComp}:${echo}`, color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vcc`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gnd`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "DHT11/DHT22") {
      const pin = Object.keys(pins).find(p => pins[p] === "INPUT" || pins[p] === "INPUT_PULLUP") || "2";
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:d`, to: `${arduinoComp}:${pin}`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:v`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:g`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "Servo Motor") {
      const pin = Object.keys(pins).find(p => pins[p] === "OUTPUT") || "9";
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:sig`, to: `${arduinoComp}:${pin}`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vcc`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gnd`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "DC Motor") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:p1`, to: `${arduinoComp}:9`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:p2`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "L293D" || name === "L293D Motor Driver") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:en1`, to: `${arduinoComp}:9`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:in1`, to: `${arduinoComp}:8`, color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:in2`, to: `${arduinoComp}:7`, color: "yellow", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vcc`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gnd`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "MQ-2 Gas Sensor") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:aout`, to: `${arduinoComp}:A0`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vcc`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gnd`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "PIR Motion Sensor") {
      const pin = Object.keys(pins).find(p => pins[p] === "INPUT" || pins[p] === "INPUT_PULLUP") || "2";
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:d`, to: `${arduinoComp}:${pin}`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vcc`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gnd`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "HC-05 Module" || name === "HC-05") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:tx`, to: `${arduinoComp}:2`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:rx`, to: `${arduinoComp}:3`, color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vcc`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gnd`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "IR Receiver" || name === "IR Remote Receiver") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:s`, to: `${arduinoComp}:11`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:v`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:g`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "16x2 LCD") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:rs`, to: `${arduinoComp}:12`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:e`, to: `${arduinoComp}:11`, color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:d4`, to: `${arduinoComp}:5`, color: "yellow", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:d5`, to: `${arduinoComp}:4`, color: "orange", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:d6`, to: `${arduinoComp}:3`, color: "purple", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:d7`, to: `${arduinoComp}:2`, color: "brown", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vss`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vdd`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "RF Module") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:ce`, to: `${arduinoComp}:9`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:csn`, to: `${arduinoComp}:10`, color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:mosi`, to: `${arduinoComp}:11`, color: "yellow", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:miso`, to: `${arduinoComp}:12`, color: "orange", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:sck`, to: `${arduinoComp}:13`, color: "purple", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vcc`, to: `${arduinoComp}:3V3`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gnd`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "ESP32" || name === "ESP8266") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gpio2`, to: `${arduinoComp}:13`, color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gnd`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "7-Segment Display") {
      // Wire segments a-g and dp to pins 2-9 via resistors
      const segs = ['a','b','c','d','e','f','g','dp'];
      for (let s = 0; s < segs.length; s++) {
        const rId = `${cid}_r_${segs[s]}`;
        wires.push({ id: `w_${wireIdx++}`, from: `${cid}:${segs[s]}`, to: `${rId}:p1`, color: "orange", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
        wires.push({ id: `w_${wireIdx++}`, from: `${rId}:p2`, to: `${arduinoComp}:${s + 2}`, color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      }
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:com`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "LCD (I2C)") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:sda`, to: `${arduinoComp}:A4`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:scl`, to: `${arduinoComp}:A5`, color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vcc`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gnd`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "RF Transmitter" || name === "RF Receiver") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:ce`, to: `${arduinoComp}:9`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:csn`, to: `${arduinoComp}:10`, color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:mosi`, to: `${arduinoComp}:11`, color: "yellow", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:miso`, to: `${arduinoComp}:12`, color: "orange", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:sck`, to: `${arduinoComp}:13`, color: "purple", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:vcc`, to: `${arduinoComp}:3V3`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:gnd`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "TMP36") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:s`, to: `${arduinoComp}:A0`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:v`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:g`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    } else if (name === "Water Level Sensor") {
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:s`, to: `${arduinoComp}:A0`, color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:v`, to: `${arduinoComp}:5V`, color: "red", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
      wires.push({ id: `w_${wireIdx++}`, from: `${cid}:g`, to: `${arduinoComp}:GND`, color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" });
    }
  }
  return wires;
}

function genI2cWires(compList) {
  if (compList.some(n => n.includes("Arduino Uno x"))) {
    return [
      { id: "w_i2c_sda", from: "uno1:A4", to: "uno2:A4", color: "blue", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" },
      { id: "w_i2c_scl", from: "uno1:A5", to: "uno2:A5", color: "green", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" },
      { id: "w_i2c_gnd1", from: "uno1:GND", to: "uno2:GND", color: "black", waypoints: [], isBelow: false, isSocket: false, isHidden: false, isHelp: false, fromLabel: "", toLabel: "" },
    ];
  }
  return [];
}

function expandComponents(compList) {
  const expanded = [];
  for (const c of compList) {
    // Handle patterns like "LEDs (for binary output)" → treat as 8 LEDs
    const ledGroup = c.match(/^LEDs?\s*\(/);
    if (ledGroup) {
      for (let j = 0; j < 8; j++) expanded.push({ name: "LED", isMulti: true });
      continue;
    }
    const m = c.match(/^(\d+)x\s+(.+)/);
    if (m) {
      const count = parseInt(m[1]);
      const base = m[2].trim();
      if (base.includes("LED") && base.includes("(")) {
        const colorMatch = base.match(/\(([^)]+)\)/);
        if (colorMatch) {
          const colors = colorMatch[1].split(",").map(s => s.trim().toLowerCase());
          for (const color of colors) {
            expanded.push({ name: `${color.charAt(0).toUpperCase() + color.slice(1)} LED`, isMulti: true });
          }
          continue;
        }
      }
      if (base.startsWith("Push Button") || base.includes("Push Button") || base.includes("Pushbutton")) {
        for (let j = 0; j < count; j++) expanded.push({ name: "Push Button", isMulti: true });
        continue;
      }
      if (base.includes("Resistor") || base.includes("Ω")) {
        for (let j = 0; j < count; j++) expanded.push({ name: base.replace(/s$/, ""), isMulti: true });
        continue;
      }
      for (let j = 0; j < count; j++) expanded.push({ name: base.replace(/s$/, ""), isMulti: true });
    } else {
      expanded.push({ name: c, isMulti: false });
    }
  }
  return expanded;
}

function genSchema(project) {
  const rawCompList = project.components.filter(c => c !== "Arduino Uno");
  const expandedCompList = expandComponents(rawCompList);
  const code = project.code || "";
  const pins = extractPins(code);

  const components = [arduino(-220, -280)];
  let yOff = -200;

  // Track which pin number to use for sequential components (buttons, additional LEDs)
  const usedPins = {};
  let ledResistorCount = 0;

  const getDigitalPin = (preferred) => {
    const allPins = Object.keys(pins).filter(p => p.match(/^\d+$/)).sort((a,b) => Number(a)-Number(b));
    if (preferred && !usedPins[preferred]) { usedPins[preferred] = true; return preferred; }
    for (const p of allPins) {
      if (!usedPins[p]) { usedPins[p] = true; return p; }
    }
    return allPins[allPins.length - 1] || "13";
  };

  for (let i = 0; i < expandedCompList.length; i++) {
    const { name, isMulti } = expandedCompList[i];
    if (name === "Robot Chassis" || name === "Breadboard") continue;
    if (name === "MQ-2 Gas Sensor") { components.push(mq2GasSensor(`comp_${i}`, 200, yOff, "A0")); yOff += 80; continue; }
    if (name === "PIR Motion Sensor") { components.push(pirSensor(`comp_${i}`, 200, yOff, "2")); yOff += 70; continue; }
    if (name === "16x2 LCD") { components.push(lcd1602(`comp_${i}`, 200, yOff)); yOff += 100; continue; }
    if (name === "DHT11/DHT22") { components.push(dht22(`comp_${i}`, 200, yOff, "2")); yOff += 70; continue; }
    if (name === "Servo Motor") {
      const pin = Object.keys(pins).find(p => pins[p] === "OUTPUT") || "9";
      components.push(servo(`comp_${i}`, 200, yOff, pin)); yOff += 90; continue;
    }
    if (name === "HC-SR04") { components.push(hcSr04(`comp_${i}`, 200, yOff)); yOff += 90; continue; }
    if (name === "DC Motor") { components.push(dcMotor(`comp_${i}`, 200, yOff)); yOff += 70; continue; }
    if (name === "L293D" || name === "L293D Motor Driver") { components.push(l293d(`comp_${i}`, 200, yOff)); yOff += 120; continue; }
    if (name === "HC-05 Module" || name === "HC-05") { components.push(hc05(`comp_${i}`, 200, yOff)); yOff += 90; continue; }
    if (name === "IR Receiver" || name === "IR Remote Receiver") { components.push(irReceiver(`comp_${i}`, 200, yOff, "11")); yOff += 60; continue; }
    if (name === "RF Module") { components.push({ id: `comp_${i}`, type: "openhw-nrf24l01", label: "RF Module", x: 200, y: yOff, w: 50, h: 60, rotation: 0, attrs: {} }); yOff += 80; continue; }
    if (name === "ESP32") { components.push(esp32(`comp_${i}`, 200, yOff)); yOff += 110; continue; }
    if (name === "ESP8266") { components.push({ ...esp32(`comp_${i}`, 200, yOff), label: "ESP8266", type: "wokwi-esp32-devkit-v1" }); yOff += 110; continue; }
    if (name === "TMP36") { components.push(tmp36(`comp_${i}`, 200, yOff, "A0")); yOff += 65; continue; }
    if (name === "Water Level Sensor") { components.push(waterSensor(`comp_${i}`, 200, yOff, "A0")); yOff += 70; continue; }

    if ((name.includes("LED") || name.endsWith("LED")) && !name.includes("RGB") && !name.includes("RGB LED")) {
      const color = name.toLowerCase().includes("green") ? "green" : name.toLowerCase().includes("yellow") ? "yellow" : name.toLowerCase().includes("red") ? "red" : "red";
      const pin = getDigitalPin();
      components.push(led(`comp_${i}`, 200, yOff, pin, color));
      components.push(resistor(`r_${i}`, 280, yOff, "220"));
      ledResistorCount++;
      yOff += 55;
    } else if (name.includes("Resistor") || name.includes("Ω")) {
      if ((name.includes("Ω") || name.includes("220") || name.includes("330") || name.includes("1k")) && ledResistorCount > 0) {
        ledResistorCount--; yOff += 50; continue;
      }
      const val = name.startsWith("10k") ? "10000" : name.startsWith("1k") ? "1000" : name.startsWith("330") ? "330" : "220";
      components.push(resistor(`r_${i}`, 200, yOff, val));
      yOff += 50;
    } else if (name === "7-Segment Display") {
      components.push({ id: `comp_${i}`, type: "openhw-7segment", label: "7-Segment Display", x: 200, y: yOff, w: 100, h: 100, rotation: 0, attrs: {} });
      yOff += 120;
    } else if (name === "LCD (I2C)" || name.includes("LCD (I2C)")) {
      components.push({ id: `comp_${i}`, type: "openhw-lcd1602-i2c", label: "LCD (I2C)", x: 200, y: yOff, w: 150, h: 80, rotation: 0, attrs: {} });
      yOff += 100;
    } else if (name === "RF Transmitter" || name === "RF Receiver") {
      components.push({ id: `comp_${i}`, type: "openhw-nrf24l01", label: name, x: 200, y: yOff, w: 50, h: 60, rotation: 0, attrs: {} });
      yOff += 80;
    } else if (name === "Arduino Uno x2" || name.startsWith("Arduino Uno x")) {
      // Second Arduino, placed further down
      components.push({ id: `uno2`, type: "openhw-arduino-uno", label: "Arduino Uno #2", x: -220, y: yOff + 100, w: 425, h: 320, rotation: 0, attrs: {} });
      yOff += 100;
    } else if (name === "Push Button" || name === "Pushbutton") {
      const pin = Object.keys(pins).find(p => pins[p] !== "OUTPUT" && p.match(/^\d+$/)) || getDigitalPin();
      if (!usedPins[pin]) usedPins[pin] = true;
      components.push(pushbutton(`comp_${i}`, 200, yOff, pin));
      yOff += 60;
    } else if (name === "Buzzer") {
      const pin = getDigitalPin();
      components.push(buzzer(`comp_${i}`, 200, yOff, pin));
      yOff += 70;
    } else if (name === "Potentiometer") {
      const pin = Object.keys(pins).find(p => p.startsWith("A")) || "A0";
      components.push(potentiometer(`comp_${i}`, 200, yOff, pin));
      yOff += 90;
    } else if (name === "LDR" || name === "LDR Module") {
      const pin = Object.keys(pins).find(p => p.startsWith("A")) || "A0";
      components.push(ldrModule(`comp_${i}`, 200, yOff, pin));
      yOff += 70;
    } else if (name === "RGB LED" || name === "RGB LED (4-pin)") {
      components.push(rgbLed(`comp_${i}`, 200, yOff));
      const outPins = Object.keys(pins).filter(p => pins[p] === "OUTPUT").sort();
      components.push(resistor(`r_${i}_r`, 200, yOff + 120, "220"));
      components.push(resistor(`r_${i}_g`, 290, yOff + 120, "220"));
      components.push(resistor(`r_${i}_b`, 380, yOff + 120, "220"));
      yOff += 200;
    }
  }

  const wires = [...genWires(expandedCompList.map(e => e.name), "uno1", pins), ...genI2cWires(expandedCompList.map(e => e.name))];

  return {
    schemaVersion: "openhw-project-v2",
    board: BOARD,
    components,
    connections: wires,
    blocklyXml: "",
    blocklyGeneratedCode: "",
    useBlocklyCode: false,
    projectFiles: [],
    openCodeTabs: [],
    activeCodeFileId: "code.ino",
    code: code,
    name: project.title,
    exportedAt: new Date().toISOString(),
  };
}

// Clear existing schemas and regenerate ALL
for (const lv of ["BEGINNER", "INTERMEDIATE", "ADVANCED"]) {
  for (const cat of Object.values(data[lv].categories)) {
    for (const project of cat.projects) {
      console.log(`Generating schema for: ${project.slug} (${lv})`);
      project.schemas = project.schemas || {};
      project.schemas.arduino = genSchema(project);
    }
  }
}

writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf-8");
console.log("\nDone! All schemas generated.");
