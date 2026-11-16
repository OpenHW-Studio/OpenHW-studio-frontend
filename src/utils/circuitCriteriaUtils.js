// circuitCriteriaUtils.js
// Shared evaluation criteria generator from steganographic OpenHW circuit metadata

const COMP_TYPE_MAP = {
  arduino: 'arduino',
  uno: 'arduino',
  led: 'led',
  rgbled: 'rgb-led',
  'rgb led': 'rgb-led',
  resistor: 'resistor',
  '220r': 'resistor',
  '220 ohm': 'resistor',
  potentiometer: 'potentiometer',
  pot: 'potentiometer',
  buzzer: 'buzzer',
  'analog joystick': 'analog-joystick',
  joystick: 'analog-joystick',
  ldr: 'ldr',
  photoresistor: 'ldr',
  button: 'button',
  pushbutton: 'button',
  switch: 'switch',
  dcmotor: 'dc-motor',
  servo: 'servo',
  'servo motor': 'servo',
  sensor: 'sensor',
  display: 'display',
};

const TYPE_RE = [
  { slug: 'arduino', re: /(?:openhw[-_])?arduino(?:[-_\s]uno)?|wokwi[-_]arduino[-_]uno|wokwi[-_]esp32[-_]uno/i },
  { slug: 'rgb-led', re: /(?:openhw[-_])?rgb[-_\s]?led|wokwi[-_]rgb[-_]led/i },
  { slug: 'resistor', re: /(?:openhw[-_])?resistor|wokwi[-_]resistor/i },
  { slug: 'dc-motor', re: /(?:openhw[-_])?dc[-_\s]?motor|wokwi[-_]dc[-_]motor/i },
  { slug: 'servo', re: /(?:openhw[-_])?servo|wokwi[-_]servo/i },
  { slug: 'potentiometer', re: /(?:openhw[-_])?potentiometer|wokwi[-_]potentiometer/i },
  { slug: 'analog-joystick', re: /(?:openhw[-_])?analog[-_]joystick|wokwi[-_]analog[-_]joystick/i },
  { slug: 'buzzer', re: /(?:openhw[-_])?buzzer|wokwi[-_]buzzer/i },
  { slug: 'ldr', re: /(?:openhw[-_])?ldr|photoresistor|photo[-_]resistor|wokwi[-_]ldr/i },
  { slug: 'button', re: /(?:openhw[-_])?button|pushbutton|wokwi[-_]button/i },
  { slug: 'switch', re: /(?:openhw[-_])?switch|wokwi[-_]switch/i },
  { slug: 'led', re: /(?:openhw[-_])?led(?:[-_])?|wokwi[-_]led/i },
];

export function typeFromRaw(rawType) {
  const t = String(rawType || '').toLowerCase();
  for (const { slug, re } of TYPE_RE) {
    if (re.test(t)) return slug;
  }
  const clean = t.replace(/^(?:openhw|wokwi)[-_]/, '').replace(/[-_]/g, ' ');
  return COMP_TYPE_MAP[clean] || clean.replace(/\s+/g, '-') || t;
}

export function resolveRoleSlug(slug) {
  const s = String(slug || '').toLowerCase().replace(/^(?:openhw|wokwi)[-_]/, '').replace(/[-_]/g, ' ');
  return COMP_TYPE_MAP[s] || s || null;
}

/**
 * Builds automated evaluation criteria and connection rules from circuit metadata
 */
export function buildEvaluationCriteriaFromMeta(meta) {
  const comps = Array.isArray(meta?.components) ? meta.components : [];
  const connections = Array.isArray(meta?.connections) ? meta.connections : [];
  const code = String(meta?.code || '').trim();

  // 1. Map component ID -> type slug
  const typeMap = {};
  for (const c of comps) {
    const rawType = String(c.type || '');
    typeMap[String(c.id)] = typeFromRaw(rawType);
  }

  // 2. Component counts
  const typeCount = {};
  for (const c of comps) {
    const id = String(c.id);
    const slug = typeMap[id];
    if (!slug) continue;
    typeCount[slug] = (typeCount[slug] || 0) + 1;
  }
  const required = Object.entries(typeCount).map(([type, count]) => ({ type, count }));

  // 3. Wiring Connections
  const epRole = {};
  const epPin = {};
  const pinRole = {};

  for (const w of connections) {
    const each = [w.from, w.to];
    for (const ep of each) {
      if (epRole[ep]) continue;
      const m = String(ep).match(/^([^:]+):(.+)$/);
      if (!m) continue;
      const compId = m[1];
      const pinName = m[2];
      const roleSlug = resolveRoleSlug(typeMap[compId]) || typeMap[compId] || compId;
      epRole[ep] = roleSlug;
      epPin[ep] = pinName;
      pinRole[pinName] = roleSlug;
    }
  }

  const pinOf = {};
  for (const w of connections) {
    const [rFrom, rTo] = [w.from, w.to];
    const f = epRole[rFrom] ? { role: epRole[rFrom], pin: epPin[rFrom], id: rFrom.split(':')[0] } : null;
    const t = epRole[rTo] ? { role: epRole[rTo], pin: epPin[rTo], id: rTo.split(':')[0] } : null;
    if (f && t) {
      if (!pinOf[f.role]) pinOf[f.role] = {};
      pinOf[f.role][f.pin] = { pairedRole: t.role, pairedPin: t.pin };
    }
  }

  const requiredConnections = Object.entries(pinOf).flatMap(([role, pins]) =>
    Object.entries(pins).map(([pin, { pairedRole, pairedPin }]) => ({
      from: { component: String(role), pin: String(pin) },
      to: { component: String(pairedRole), pin: String(pairedPin) },
    }))
  );

  // 4. Code Functionality
  const allFunctions = code.match(/\b([a-zA-Z_]\w*)\s*\(/g) || [];
  const builtIns = new Set(
    'if for while switch case return break continue else void int float double char bool long unsigned short static const sizeof pinMode digitalWrite analogWrite delay Serial begin print println digitalRead analogRead tone noTone'.split(' ')
  );
  const fnSet = [
    ...new Set(
      allFunctions
        .map(m => m.replace(/\($/, '').trim())
        .filter(n => /^[A-Za-z_]/.test(n) && n.length >= 2 && !builtIns.has(n))
    ),
  ];
  const requiredFunctions = fnSet.slice(0, 8);

  const expectedBehavior = {};
  const pm = code.match(/pinMode\s*\(\s*(\d+)\s*,\s*(\w+)\s*\)/i);
  if (pm) {
    expectedBehavior.pinNumber = Number(pm[1]);
    expectedBehavior.pinMode = pm[2].toUpperCase();
  }
  const dly1 = code.match(/delay\s*\(\s*(\d+)\s*\)/i);
  if (dly1) expectedBehavior.blinkDelay = Number(dly1[1]);
  const dly2 = code.match(/digitalWrite\s*\(.*?,\s*HIGH\s*\)[\s\S]{0,80}delay\s*\(\s*(\d+)/i);
  if (!dly2) {
    const dly3 = code.match(/delay\s*\(\s*(\d+)\s*\)/i);
    if (dly3) expectedBehavior.blinkDelay = Number(dly3[1]);
  }

  return {
    wiringAccuracy: { requiredConnections, weight: 0.35 },
    components: { required, weight: 0.25 },
    codeFunctionality: { requiredFunctions, expectedBehavior, weight: 0.40 },
  };
}

export function buildDefaultScoring(criteria) {
  if (!criteria) return null;
  return {
    components: {
      excellent: { min: 90, feedback: 'All required components are present!' },
      good: { min: 75, feedback: 'Most required components are present.' },
      needsImprovement: { min: 0, feedback: 'Missing one or more required components.' },
    },
    wiringAccuracy: {
      excellent: { min: 90, feedback: 'All connections are correct!' },
      good: { min: 75, feedback: 'Most connections are correct with minor issues.' },
      needsImprovement: { min: 0, feedback: 'Wiring needs significant correction.' },
    },
    ...(criteria.codeFunctionality
      ? {
          codeFunctionality: {
            excellent: { min: 90, feedback: 'Code logic matches expected behavior perfectly!' },
            good: { min: 75, feedback: 'Code works but may need minor improvements.' },
            needsImprovement: { min: 0, feedback: 'Code functionality needs significant work.' },
          },
        }
      : {}),
  };
}

/**
 * Generates the 3 explicit evaluation tasks (Components, Wiring, Code)
 * from extracted PNG metadata or evaluation criteria.
 */
export function generate3EvaluationTasks({ components = [], connections = [], code = '', prompt = '' }) {
  // 1. Components task
  const compCountMap = {};
  components.forEach(c => {
    const rawType = c.type || c.name || 'Component';
    const cleanType = String(rawType)
      .replace(/^(?:openhw|wokwi)[-_]/, '')
      .split(/[-_]/)
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    compCountMap[cleanType] = (compCountMap[cleanType] || 0) + 1;
  });

  const compBullets = Object.entries(compCountMap).length > 0
    ? Object.entries(compCountMap).map(([type, count]) => `• ${count}x ${type}`).join('\n')
    : '• 1x Arduino Uno\n• 1x LED\n• 1x 220Ω Resistor';

  const taskComponents = {
    id: 1,
    phase: 'components',
    title: 'Place Required Components',
    instruction: `Place the following components onto the simulation canvas:\n\n${compBullets}`,
    tip: 'Select parts from the component toolbox palette and arrange them cleanly on your workspace before wiring.'
  };

  // 2. Wiring task
  let wireList = '';
  if (connections.length > 0) {
    wireList = connections.slice(0, 15).map((conn, idx) => {
      const formatEndpoint = (ep) => {
        if (!ep) return 'Pin';
        const parts = String(ep).split(':');
        if (parts.length === 2) {
          const compName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          return `${parts[1]} on ${compName}`;
        }
        return ep;
      };
      const from = typeof conn.from === 'object' ? `${conn.from.pin || conn.from.terminal || 'Pin'} on ${conn.from.component}` : formatEndpoint(conn.from);
      const to = typeof conn.to === 'object' ? `${conn.to.pin || conn.to.terminal || 'Pin'} on ${conn.to.component}` : formatEndpoint(conn.to);
      return `${idx + 1}. Connect ${from} → ${to}`;
    }).join('\n');
    if (connections.length > 15) {
      wireList += `\n...and ${connections.length - 15} additional connection(s)`;
    }
  } else {
    wireList = '1. Connect Arduino Digital Pin 13 → 220Ω Resistor Pin 1\n2. Connect 220Ω Resistor Pin 2 → LED Anode\n3. Connect LED Cathode → Arduino GND';
  }

  const taskWiring = {
    id: 2,
    phase: 'wire',
    title: 'Wire the Circuit Connections',
    instruction: `Connect all circuit wiring precisely as specified:\n\n${wireList}`,
    tip: 'Ensure all signal wires connect to the designated digital/analog pins and ground returns to Arduino GND.'
  };

  // 3. Code task
  const funcs = [];
  if (code && code.trim()) {
    if (/pinMode\s*\(/i.test(code)) funcs.push('• Initialize pin modes inside setup()');
    if (/digitalWrite\s*\(/i.test(code)) funcs.push('• Control digital pin states (HIGH/LOW)');
    if (/analogWrite\s*\(/i.test(code)) funcs.push('• Control analog PWM levels');
    if (/delay\s*\(/i.test(code)) funcs.push('• Implement timing intervals using delay()');
    if (/Serial\s*\./i.test(code)) funcs.push('• Output serial diagnostics with Serial.print()');
  }

  let codeInstructionText = '';
  if (prompt) {
    codeInstructionText = `${prompt}\n\n`;
  }
  if (funcs.length > 0) {
    codeInstructionText += `Firmware Requirements:\n${funcs.join('\n')}`;
  } else {
    codeInstructionText += `Write and upload the microcontroller code to drive your circuit:\n• Configure your output pins in setup()\n• Implement continuous operation in loop()`;
  }

  const taskCode = {
    id: 3,
    phase: 'code',
    title: 'Write Firmware Code',
    instruction: codeInstructionText,
    code: code ? code.slice(0, 1000) : '',
    tip: 'Write C++ code in the IDE editor. Click Run/Submit to test and verify your solution against the rubric.'
  };

  return [taskComponents, taskWiring, taskCode];
}

