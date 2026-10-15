// signal/electrical.ts — shared electrical helpers (plan §5.3).
//
// Context-free netlist + passive-traversal logic, moved verbatim out of
// AVRRunner so every runner family can share one implementation. No engine,
// port, or runner state in here: callers pass instances, wires, and a visit
// callback. Board-specific direction/rail/pullup gating stays in runners.
//
// NOTE: normalization here matches the AVR union (GND[._:]?n, 5V/VCC,
// 3V3/3V3_EN). Other runners keep their own alias tables until their
// behavior is verified against this union one board at a time.

/** Minimal structural surface needed for passive traversal. */
export interface PassiveInstance {
  type: string;
  state?: any;
  setPinVoltage(pin: string, voltage: number): void;
  getPinVoltage(pin: string): number;
}

export type BridgeFn = (compId: string, type: string) => string[][];

/**
 * Normalize one `compId:pin` endpoint so power-rail aliases share a net.
 * Exact AVR-union semantics: GND/gnd_N/GND.N/GND:N → GND, 5V/VCC → 5V,
 * 3V3/3V3_EN → 3V3. Signal pins pass through untouched.
 */
export function normalizeEndpointPin(pinStr: string): string {
  const parts = String(pinStr || '').split(':');
  if (parts.length >= 2) {
    const compId = parts[0];
    const pinId = parts.slice(1).join(':');
    const upper = pinId.toUpperCase();
    if (upper === 'GND' || /^GND[._:]?\d+$/.test(upper)) {
      return `${compId}:GND`;
    }
    if (upper === '5V' || upper === 'VCC') {
      return `${compId}:5V`;
    }
    if (upper === '3V3' || upper === '3V3_EN') {
      return `${compId}:3V3`;
    }
    // Bare ATtiny P-pins (P0–P5) are Arduino-numbered GPIOs: P0 IS digital
    // pin 0 (PB0). Merging lets Uno-compiled firmware drive attiny nets
    // (the documented attiny-path substitution). Scoped to bare P+digits:
    // Uno/Mega/Nano have no such pins; retro Pn already shares its Ln/Rn
    // net conceptually; 74xx p-pins normalize identically on both wire
    // ends so their junctions still match (no bare-digit pins exist there
    // to collide with).
    if (/^P\d{1,2}$/.test(upper)) {
      return `${compId}:${upper.slice(1)}`;
    }
  }
  return pinStr;
}

export interface NetGraph {
  pinToNet: Map<string, number>;
  netHasResistor: Set<number>;
}

/**
 * Build the wire + internal-bridge netlist. Verbatim AVR semantics:
 * D/Dn numeric aliases, GND/5V/3V3 variant fan-out, resistor-net marking.
 */
export function buildNetGraph(
  wires: Array<{ from: string; to: string }>,
  instances: Map<string, PassiveInstance>,
  bridgesFor: BridgeFn,
): NetGraph {
  const adj = new Map<string, string[]>();
  const addEdge = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  };

  for (const wire of wires || []) {
    if (!wire?.from || !wire?.to) continue;
    addEdge(String(wire.from), String(wire.to));
  }

  for (const [id, inst] of instances) {
    const bridges = bridgesFor(id, inst.type);
    for (const bridge of bridges) {
      addEdge(bridge[0], bridge[1]);
    }
  }

  const pinToNet = new Map<string, number>();
  const visited = new Set<string>();
  let currentNet = 0;

  for (const startNode of adj.keys()) {
    if (visited.has(startNode)) continue;
    const queue = [startNode];
    visited.add(startNode);
    while (queue.length > 0) {
      const node = queue.shift()!;
      pinToNet.set(node, currentNet);

      const parts = node.split(':');
      if (parts.length === 2) {
        const compId = parts[0];
        const pinId = parts[1];
        const upperPin = pinId.toUpperCase();
        if (!pinId.startsWith('D') && !pinId.startsWith('A') && /^\d+$/.test(pinId)) {
          pinToNet.set(`${compId}:D${pinId}`, currentNet);
        } else if (pinId.startsWith('D')) {
          pinToNet.set(`${compId}:${pinId.substring(1)}`, currentNet);
        }

        if (upperPin === 'GND' || /^GND[._]?\d+$/.test(upperPin)) {
          pinToNet.set(`${compId}:GND`, currentNet);
          pinToNet.set(`${compId}:gnd_1`, currentNet);
          pinToNet.set(`${compId}:gnd_2`, currentNet);
          pinToNet.set(`${compId}:gnd_3`, currentNet);
          pinToNet.set(`${compId}:GND.1`, currentNet);
          pinToNet.set(`${compId}:GND.2`, currentNet);
        }
        if (upperPin === '5V' || upperPin === 'VCC') {
          pinToNet.set(`${compId}:5V`, currentNet);
          pinToNet.set(`${compId}:VCC`, currentNet);
        }
      }

      for (const neighbor of adj.get(node) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    currentNet++;
  }

  const netHasResistor = new Set<number>();
  for (const [id, inst] of instances) {
    if (inst.type === 'openhw-resistor' || inst.type === 'wokwi-resistor') {
      const n1 = pinToNet.get(`${id}:p1`);
      const n2 = pinToNet.get(`${id}:p2`);
      if (n1 !== undefined) netHasResistor.add(n1);
      if (n2 !== undefined) netHasResistor.add(n2);
    }
  }

  return { pinToNet, netHasResistor };
}

/**
 * Forward one pin's voltage through passive/component internals
 * (resistor divider, LED forward drop, button/switch shorts, breadboard
 * bridges, joystick/pot dividers, HC-SR04 echo, relay contacts).
 * Verbatim AVR semantics; consumers in other runners are future work.
 */
export function traversePassive(
  inst: PassiveInstance,
  compId: string,
  pinId: string,
  voltage: number,
  visit: (target: string, nextVoltage: number) => void,
  bridgesFor: BridgeFn,
): void {
  if (inst.type === 'openhw-resistor' || inst.type === 'wokwi-resistor') {
    const otherPin = pinId === 'p1' ? 'p2' : pinId === 'p2' ? 'p1' : null;
    if (!otherPin) return;
    const resistance = Number.parseFloat(String((inst as any).state?.value || (inst as any).state?.resistance || 1000));
    const safeResistance = Number.isFinite(resistance) && resistance > 0 ? resistance : 1000;
    const drop = Math.min(voltage * 0.2, Math.max(0.01, safeResistance / 5000));
    const nextVoltage = Math.max(0, voltage - drop);
    inst.setPinVoltage(otherPin, nextVoltage);
    visit(`${compId}:${otherPin}`, nextVoltage);
  } else if (inst.type === 'openhw-led' || inst.type === 'wokwi-led') {
    if (pinId === 'A') {
      const nextV = Math.max(0, voltage - 1.8);
      inst.setPinVoltage('K', nextV);
      visit(`${compId}:K`, nextV);
    }
  } else if (inst.type === 'openhw-pushbutton' || inst.type === 'wokwi-pushbutton') {
    if (pinId === '1l' || pinId === '1') {
      inst.setPinVoltage('1r', voltage);
      visit(`${compId}:1r`, voltage);
      inst.setPinVoltage('1', voltage);
      visit(`${compId}:1`, voltage);
      inst.setPinVoltage('1l', voltage);
      visit(`${compId}:1l`, voltage);
    } else if (pinId === '1r') {
      inst.setPinVoltage('1l', voltage);
      visit(`${compId}:1l`, voltage);
      inst.setPinVoltage('1', voltage);
      visit(`${compId}:1`, voltage);
    } else if (pinId === '2l' || pinId === '2') {
      inst.setPinVoltage('2r', voltage);
      visit(`${compId}:2r`, voltage);
      inst.setPinVoltage('2', voltage);
      visit(`${compId}:2`, voltage);
      inst.setPinVoltage('2l', voltage);
      visit(`${compId}:2l`, voltage);
    } else if (pinId === '2r') {
      inst.setPinVoltage('2l', voltage);
      visit(`${compId}:2l`, voltage);
      inst.setPinVoltage('2', voltage);
      visit(`${compId}:2`, voltage);
    }

    if ((inst as any).state?.pressed) {
      if (pinId.startsWith('1')) {
        inst.setPinVoltage('2l', voltage);
        visit(`${compId}:2l`, voltage);
        inst.setPinVoltage('2r', voltage);
        visit(`${compId}:2r`, voltage);
        inst.setPinVoltage('2', voltage);
        visit(`${compId}:2`, voltage);
      } else if (pinId.startsWith('2')) {
        inst.setPinVoltage('1l', voltage);
        visit(`${compId}:1l`, voltage);
        inst.setPinVoltage('1r', voltage);
        visit(`${compId}:1r`, voltage);
        inst.setPinVoltage('1', voltage);
        visit(`${compId}:1`, voltage);
      }
    }
  } else if (inst.type === 'openhw-membrane-keypad' || inst.type === 'wokwi-membrane-keypad') {
    if ((inst as any).state?.connectedPair) {
      const [p1, p2] = (inst as any).state.connectedPair;
      if (pinId === p1) {
        inst.setPinVoltage(p2, voltage);
        visit(`${compId}:${p2}`, voltage);
      } else if (pinId === p2) {
        inst.setPinVoltage(p1, voltage);
        visit(`${compId}:${p1}`, voltage);
      }
    }
  } else if (inst.type === 'openhw-slide-switch' || inst.type === 'wokwi-slide-switch') {
    const isRight = (inst as any).state?.value === '1' || (inst as any).state?.value === 1 || (inst as any).state?.value === true;
    if (isRight) {
      if (pinId === '3') {
        inst.setPinVoltage('2', voltage);
        visit(`${compId}:2`, voltage);
      } else if (pinId === '2') {
        inst.setPinVoltage('3', voltage);
        visit(`${compId}:3`, voltage);
      }
    } else {
      if (pinId === '1') {
        inst.setPinVoltage('2', voltage);
        visit(`${compId}:2`, voltage);
      } else if (pinId === '2') {
        inst.setPinVoltage('1', voltage);
        visit(`${compId}:1`, voltage);
      }
    }
  } else if (inst.type === 'openhw-breadboard' || inst.type === 'openhw-breadboard-half' || inst.type === 'openhw-breadboard-mini' || inst.type === 'wokwi-breadboard' || inst.type === 'wokwi-breadboard-half' || inst.type === 'wokwi-breadboard-mini' || inst.type === 'via' || inst.type === 'openhw-via' || inst.type === 'wokwi-via' || inst.type === 'openhw-wire' || inst.type === 'wokwi-wire') {
    const bridges = bridgesFor(compId, inst.type);
    for (const bridge of bridges) {
      if (bridge[0] === `${compId}:${pinId}`) visit(bridge[1], voltage);
      else if (bridge[1] === `${compId}:${pinId}`) visit(bridge[0], voltage);
    }
  } else if (inst.type === 'openhw-analog-joystick' || inst.type === 'wokwi-analog-joystick') {
    const isVccPin = pinId === 'VCC' || pinId === '5V';
    const isGndPin = pinId === 'GND';
    const xVal = (inst as any).state?.x ?? 0.5;
    const yVal = (inst as any).state?.y ?? 0.5;
    const gndV = inst.getPinVoltage('GND') || 0;
    if (isVccPin) {
      const vrxV = gndV + xVal * (voltage - gndV);
      const vryV = gndV + yVal * (voltage - gndV);
      inst.setPinVoltage('VRX', vrxV);
      visit(`${compId}:VRX`, vrxV);
      inst.setPinVoltage('VRY', vryV);
      visit(`${compId}:VRY`, vryV);
    } else if (isGndPin) {
      const vccV = inst.getPinVoltage('VCC') || inst.getPinVoltage('5V') || 5.0;
      const vrxV = voltage + xVal * (vccV - voltage);
      const vryV = voltage + yVal * (vccV - voltage);
      inst.setPinVoltage('VRX', vrxV);
      visit(`${compId}:VRX`, vrxV);
      inst.setPinVoltage('VRY', vryV);
      visit(`${compId}:VRY`, vryV);
    }
    if ((inst as any).state?.pressed) {
      if (pinId === 'SW') {
        inst.setPinVoltage('GND', voltage);
        visit(`${compId}:GND`, voltage);
      } else if (isGndPin) {
        inst.setPinVoltage('SW', voltage);
        visit(`${compId}:SW`, voltage);
      }
    }
  } else if (inst.type === 'openhw-potentiometer' || inst.type === 'wokwi-potentiometer') {
    const potVal = Number((inst as any).state?.value) ?? 50;
    const ratio = Math.max(0, Math.min(1, potVal / 100));
    if (pinId === '2') {
      const gndV = inst.getPinVoltage('1') || 0;
      const sigV = gndV + (voltage - gndV) * ratio;
      inst.setPinVoltage('SIG', sigV);
      visit(`${compId}:SIG`, sigV);
    } else if (pinId === '1') {
      const vccV = inst.getPinVoltage('2') || 5.0;
      const sigV = voltage + (vccV - voltage) * ratio;
      inst.setPinVoltage('SIG', sigV);
      visit(`${compId}:SIG`, sigV);
    }
  } else if (inst.type === 'openhw-slide-potentiometer') {
    const potVal = Number((inst as any).state?.value) ?? 50;
    const ratio = Math.max(0, Math.min(1, potVal / 100));
    if (pinId === 'VCC') {
      const gndV = inst.getPinVoltage('GND') || 0;
      const sigV = gndV + (voltage - gndV) * ratio;
      inst.setPinVoltage('SIG', sigV);
      visit(`${compId}:SIG`, sigV);
    } else if (pinId === 'GND') {
      const vccV = inst.getPinVoltage('VCC') || 5.0;
      const sigV = voltage + (vccV - voltage) * ratio;
      inst.setPinVoltage('SIG', sigV);
      visit(`${compId}:SIG`, sigV);
    }
  } else if (inst.type === 'openhw-hc-sr04' || inst.type === 'wokwi-hc-sr04') {
    if (pinId === 'VCC') {
      const echoV = (inst as any).echoOutputVoltage !== undefined
        ? (inst as any).echoOutputVoltage
        : inst.getPinVoltage('ECHO') || 0;
      inst.setPinVoltage('ECHO', echoV);
      visit(`${compId}:ECHO`, echoV);
    } else if (pinId === 'GND') {
      const echoV = (inst as any).echoOutputVoltage !== undefined
        ? (inst as any).echoOutputVoltage
        : inst.getPinVoltage('ECHO') || 0;
      inst.setPinVoltage('ECHO', echoV);
      visit(`${compId}:ECHO`, echoV);
    }
  } else if (inst.type === 'openhw-ks2e-m-dc5') {
    const energised = (inst as any).state?.energised;
    if (pinId === 'COIL1') {
      const coilV = Math.min(voltage, 5.0);
      const nextV = Math.max(0, coilV - coilV * 0.01);
      inst.setPinVoltage('COIL2', nextV);
      visit(`${compId}:COIL2`, nextV);
    } else if (pinId === 'COIL2') {
      const coilV = Math.min(voltage, 5.0);
      const nextV = Math.max(0, coilV - coilV * 0.01);
      inst.setPinVoltage('COIL1', nextV);
      visit(`${compId}:COIL1`, nextV);
    } else if (energised) {
      if (pinId === 'P1') {
        inst.setPinVoltage('NO1', voltage);
        visit(`${compId}:NO1`, voltage);
      } else if (pinId === 'NO1') {
        inst.setPinVoltage('P1', voltage);
        visit(`${compId}:P1`, voltage);
      } else if (pinId === 'P2') {
        inst.setPinVoltage('NO2', voltage);
        visit(`${compId}:NO2`, voltage);
      } else if (pinId === 'NO2') {
        inst.setPinVoltage('P2', voltage);
        visit(`${compId}:P2`, voltage);
      }
    } else {
      if (pinId === 'P1') {
        inst.setPinVoltage('NC1', voltage);
        visit(`${compId}:NC1`, voltage);
      } else if (pinId === 'NC1') {
        inst.setPinVoltage('P1', voltage);
        visit(`${compId}:P1`, voltage);
      } else if (pinId === 'P2') {
        inst.setPinVoltage('NC2', voltage);
        visit(`${compId}:NC2`, voltage);
      } else if (pinId === 'NC2') {
        inst.setPinVoltage('P2', voltage);
        visit(`${compId}:P2`, voltage);
      }
    }
  }
}
