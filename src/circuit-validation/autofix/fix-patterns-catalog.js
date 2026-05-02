/**
 * Universal Fix Patterns Catalog (moved to autofix/)
 */

export const fixPatternsCatalog = {
  missing_ground_connection: {
    category: 'power',
    severity: 'error',
    description: 'Add missing ground connection to component',
    prerequisites: ['board_found', 'target_component_found'],
    steps: [
      { type: 'addConnection', from: 'board:GND', to: 'component:GND', color: 'black', label: 'Ground Connection' }
    ],
    estimate: { components: 0, connections: 1, complexity: 'simple' },
    confidence: 0.95,
  },

  missing_power_connection: {
    category: 'power',
    severity: 'error',
    description: 'Add missing power rail connection',
    prerequisites: ['board_found', 'power_rail_exists', 'target_component_found'],
    steps: [ { type: 'addConnection', from: 'board:${powerRail}', to: 'component:VCC', color: 'red', label: 'Power Connection' } ],
    estimate: { components: 0, connections: 1, complexity: 'simple' },
    confidence: 0.95,
  },

  power_supply_missing: {
    category: 'power',
    severity: 'error',
    description: 'Add power supply for external component',
    prerequisites: ['target_component_requires_external_power'],
    steps: [
      { type: 'addComponent', componentType: 'wokwi-dc-power', voltage: 5, position: 'near:${targetComponent}:-80:0' },
      { type: 'addConnection', from: 'power_supply:+', to: 'component:VCC', color: 'red' },
      { type: 'addConnection', from: 'power_supply:-', to: 'board:GND', color: 'black' }
    ],
    estimate: { components: 1, connections: 2, complexity: 'intermediate' },
    confidence: 0.85,
  },

  decoupling_capacitor_missing: {
    category: 'power',
    severity: 'warn',
    description: 'Add 100nF decoupling capacitor near power pins',
    prerequisites: ['microcontroller_found', 'high_freq_logic'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-capacitor', value: '100nF', position: 'nearPowerPins:${mcu}:20:10', purpose: 'decoupling' }, { type: 'addConnection', from: 'capacitor:+', to: 'board:5V', color: 'red' }, { type: 'addConnection', from: 'capacitor:-', to: 'board:GND', color: 'black' } ],
    estimate: { components: 1, connections: 2, complexity: 'simple' },
    confidence: 0.90,
  },

  bulk_capacitor_for_motor: {
    category: 'power',
    severity: 'warn',
    description: 'Add bulk capacitor (470µF) for motor power supply smoothing',
    prerequisites: ['motor_found', 'high_current_draw_detected'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-capacitor', value: '470µF', position: 'nearMotor:${motor}:-60:0', purpose: 'bulk-storage' }, { type: 'addConnection', from: 'capacitor:+', to: 'board:power_rail', color: 'red' }, { type: 'addConnection', from: 'capacitor:-', to: 'board:GND', color: 'black' } ],
    estimate: { components: 1, connections: 2, complexity: 'simple' },
    confidence: 0.85,
  },

  led_series_resistor: {
    category: 'current_limiting',
    severity: 'error',
    description: 'Add series resistor to LED (calculated based on specs)',
    prerequisites: ['led_found', 'led_power_pin_connected'],
    steps: [ { type: 'calculateComponent', formula: 'ohms = (Vsupply - Vled) / Iled', params: { Vsupply: 5, Vled: 2, Iled: 0.020 }, result: 150, suggestion: '220Ω (standard value)' }, { type: 'addComponent', componentType: 'wokwi-resistor', value: '220', position: 'seriesTo:${led}:anode:-40:0' }, { type: 'rewireConnection', action: 'insertSeriesComponent', target: 'led:anode', component: 'resistor', side: 'before' } ],
    estimate: { components: 1, connections: 2, complexity: 'intermediate' },
    confidence: 0.92,
  },

  voltage_divider_for_signal: {
    category: 'current_limiting',
    severity: 'warn',
    description: 'Add voltage divider for 5V→3.3V signal conversion',
    prerequisites: ['signal_voltage_mismatch', 'source_is_5v', 'sink_is_3v3'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-resistor', value: '10000', position: 'inLine:${signal}:source:30:0', purpose: 'divider-high' }, { type: 'addComponent', componentType: 'wokwi-resistor', value: '6800', position: 'inLine:${signal}:source:30:20', purpose: 'divider-low' }, { type: 'addConnection', from: 'r1:2', to: 'r2:1', label: 'Tap point' }, { type: 'rewireConnection', action: 'connectTo', target: 'sink:signal_pin', from: 'r1_r2:junction' }, { type: 'addConnection', from: 'r2:2', to: 'board:GND', color: 'black' } ],
    estimate: { components: 2, connections: 3, complexity: 'intermediate' },
    confidence: 0.88,
  },

  motor_flywheel_diode: {
    category: 'motor_safety',
    severity: 'error',
    description: 'Add flywheel diode across motor to protect against back-EMF',
    prerequisites: ['motor_found', 'motor_controlled_by_gpio'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-diode', value: '1N4007', position: 'parallel:${motor}:opposite', orientation: 'reverse-biased' }, { type: 'addConnection', from: 'diode:anode', to: 'motor:negative', label: 'Protection' }, { type: 'addConnection', from: 'diode:cathode', to: 'motor:positive', label: 'Protection' } ],
    estimate: { components: 1, connections: 2, complexity: 'simple' },
    confidence: 0.98,
  },

  motor_gate_resistor: {
    category: 'motor_safety',
    severity: 'warn',
    description: 'Add gate resistor (10Ω) to MOSFET/transistor driving motor',
    prerequisites: ['motor_controlled_by_transistor_or_mosfet'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-resistor', value: '10', position: 'inLine:${gateSignal}:source:20:0', purpose: 'gate-resistor' }, { type: 'rewireConnection', action: 'insertSeriesComponent', target: 'transistor:gate', component: 'resistor', side: 'before' } ],
    estimate: { components: 1, connections: 1, complexity: 'simple' },
    confidence: 0.90,
  },

  motor_heatsink_suggestion: {
    category: 'thermal',
    severity: 'info',
    description: 'Suggest heatsink for high-current MOSFET/transistor',
    prerequisites: ['high_current_mosfet_detected', 'no_heatsink_present'],
    steps: [ { type: 'suggestion', text: 'Consider adding a heatsink to the MOSFET. Expected power dissipation: 2-5W. Attach thermal paste and secure with M3 screw.', action: 'manual', partNumber: 'TO-220 heatsink 25°C/W' } ],
    estimate: { components: 0, connections: 0, complexity: 'manual' },
    confidence: 0.75,
  },

  emi_rfi_filter_suggestion: {
    category: 'emc',
    severity: 'warn',
    description: 'Suggest EMI/RFI filtering (ferrite bead + decoupling) on noisy power rail or motor lines',
    prerequisites: ['high_noise_detected', 'long_unfiltered_traces'],
    steps: [ { type: 'suggestion', text: 'Add ferrite bead in series on power line and a 0.1uF + 10uF decoupling pair across supply near the noise source.', action: 'manual' } ],
    estimate: { components: 1, connections: 2, complexity: 'simple' },
    confidence: 0.72,
  },

  series_termination_recommendation: {
    category: 'signal_integrity',
    severity: 'warn',
    description: 'Recommend series termination resistor for long/high-speed traces',
    prerequisites: ['long_trace_detected', 'high_speed_net'],
    steps: [ { type: 'suggestion', text: 'Add 22Ω-82Ω series resistor near the driver to reduce reflections. Place as close to the source as possible.', action: 'manual' } ],
    estimate: { components: 1, connections: 0, complexity: 'simple' },
    confidence: 0.68,
  },

  differential_pair_recommendation: {
    category: 'signal_integrity',
    severity: 'info',
    description: 'Recommend routing as differential pair for matched signals (e.g., USB, LVDS)',
    prerequisites: ['paired_signals_detected', 'high_speed_net'],
    steps: [ { type: 'suggestion', text: 'Route as differential pair, keep lengths matched and maintain controlled impedance.', action: 'manual' } ],
    estimate: { components: 0, connections: 0, complexity: 'manual' },
    confidence: 0.7,
  },

  i2c_pull_up_resistors: {
    category: 'communication',
    severity: 'warn',
    description: 'Add I2C pull-up resistors (4.7kΩ) to SDA and SCL',
    prerequisites: ['i2c_device_found', 'pull_ups_missing'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-resistor', value: '4700', position: 'above:${board}:${sda_pin}:0:-40' }, { type: 'addConnection', from: 'resistor_sda:1', to: 'board:5V', color: 'red' }, { type: 'addConnection', from: 'resistor_sda:2', to: 'board:SDA', color: 'yellow' }, { type: 'addComponent', componentType: 'wokwi-resistor', value: '4700', position: 'above:${board}:${scl_pin}:50:-40' }, { type: 'addConnection', from: 'resistor_scl:1', to: 'board:5V', color: 'red' }, { type: 'addConnection', from: 'resistor_scl:2', to: 'board:SCL', color: 'orange' } ],
    estimate: { components: 2, connections: 4, complexity: 'simple' },
    confidence: 0.96,
  },

  i2c_address_conflict: {
    category: 'communication',
    severity: 'error',
    description: 'Resolve I2C address conflict by changing device address',
    prerequisites: ['i2c_address_conflict_detected'],
    steps: [ { type: 'findAlternateAddresses', current: '0x27', available: ['0x3C', '0x3D', '0x3E'], method: 'hardware-jumpers-or-software' }, { type: 'suggestion', text: 'Change I2C address in firmware: Wire addr pin to GND for 0x3C, to VCC for 0x3D, or leave floating for 0x3E. Or use different I2C bus (Wire1).', action: 'firmware-and-hardware' } ],
    estimate: { components: 0, connections: 0, complexity: 'manual' },
    confidence: 0.80,
  },

  spi_chip_select_resistor: {
    category: 'communication',
    severity: 'warn',
    description: 'Add pull-up resistor to SPI chip select line',
    prerequisites: ['spi_device_found', 'cs_pin_floating'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-resistor', value: '10000', position: 'above:${board}:${cs_pin}:0:-30' }, { type: 'addConnection', from: 'resistor_cs:1', to: 'board:5V', color: 'red' }, { type: 'addConnection', from: 'resistor_cs:2', to: 'board:CS', color: 'gray' } ],
    estimate: { components: 1, connections: 2, complexity: 'simple' },
    confidence: 0.92,
  },

  level_shifter_mosfet_divider: {
    category: 'level_shifting',
    severity: 'warn',
    description: 'Add MOSFET voltage divider for 5V→3.3V signal conversion',
    prerequisites: ['signal_voltage_5v_to_3v3'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-resistor', value: '10000', position: 'inLine:${signal}:source:30:0', purpose: 'divider-high' }, { type: 'addComponent', componentType: 'wokwi-resistor', value: '6800', position: 'inLine:${signal}:source:30:20', purpose: 'divider-low' }, { type: 'addConnection', from: 'r1:2', to: 'sink:pin', label: 'Signal output (3.3V)' } ],
    estimate: { components: 2, connections: 2, complexity: 'intermediate' },
    confidence: 0.88,
  },

  level_shifter_ic: {
    category: 'level_shifting',
    severity: 'warn',
    description: 'Add dedicated level shifter IC (SN74LVC245)',
    prerequisites: ['multi_signal_level_shift_needed'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-ic-74hc595', model: 'SN74LVC245', position: 'center:${board}:100:50' }, { type: 'addConnection', from: 'shifter:VCC', to: 'board:5V', color: 'red' }, { type: 'addConnection', from: 'shifter:GND', to: 'board:GND', color: 'black' }, { type: 'addConnection', from: 'shifter:VCC_3V3', to: 'board:3V3', color: 'red' } ],
    estimate: { components: 1, connections: 8, complexity: 'complex' },
    confidence: 0.85,
  },

  button_debounce_capacitor: {
    category: 'signal_conditioning',
    severity: 'info',
    description: 'Add debounce capacitor (100nF) to button input',
    prerequisites: ['button_found', 'no_debounce_present'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-capacitor', value: '100nF', position: 'parallel:${button}:opposite:20:0' }, { type: 'addConnection', from: 'capacitor:+', to: 'board:GPIO', color: 'green' }, { type: 'addConnection', from: 'capacitor:-', to: 'board:GND', color: 'black' } ],
    estimate: { components: 1, connections: 2, complexity: 'simple' },
    confidence: 0.85,
  },

  button_pull_down_resistor: {
    category: 'signal_conditioning',
    severity: 'error',
    description: 'Add pull-down resistor to button GPIO pin',
    prerequisites: ['button_gpio_floating'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-resistor', value: '10000', position: 'inLine:${button}:gnd:20:0' }, { type: 'rewireConnection', action: 'insertSeriesComponent', target: 'button:gnd_pin', component: 'resistor', side: 'before' } ],
    estimate: { components: 1, connections: 1, complexity: 'simple' },
    confidence: 0.94,
  },

  diode_polarity_flip: {
    category: 'component_orientation',
    severity: 'error',
    description: 'Flip diode orientation (anode should face positive)',
    prerequisites: ['diode_reverse_biased'],
    steps: [ { type: 'rotateComponent', component: 'diode', rotation: 180, label: 'Reverse orientation for correct polarity' } ],
    estimate: { components: 0, connections: 0, complexity: 'simple' },
    confidence: 0.99,
  },

  electrolytic_capacitor_polarity: {
    category: 'component_orientation',
    severity: 'error',
    description: 'Correct electrolytic capacitor polarity (+/- orientation)',
    prerequisites: ['capacitor_reverse_biased_electrolytic'],
    steps: [ { type: 'rotateComponent', component: 'capacitor', rotation: 180, label: 'Reverse for correct polarity' } ],
    estimate: { components: 0, connections: 0, complexity: 'simple' },
    confidence: 0.99,
  },

  led_polarity_flip: {
    category: 'component_orientation',
    severity: 'error',
    description: 'Flip LED orientation (anode/cathode)',
    prerequisites: ['led_wrong_polarity'],
    steps: [ { type: 'rotateComponent', component: 'led', rotation: 180, label: 'Correct LED polarity' } ],
    estimate: { components: 0, connections: 0, complexity: 'simple' },
    confidence: 0.99,
  },

  unconnected_component: {
    category: 'connectivity',
    severity: 'error',
    description: 'Wire unconnected component into circuit',
    prerequisites: ['component_completely_unconnected'],
    steps: [ { type: 'addConnection', from: 'component:signal_pin', to: 'board:GPIO_pin', color: 'green', label: 'Signal connection' }, { type: 'addConnection', from: 'component:VCC', to: 'board:5V', color: 'red' }, { type: 'addConnection', from: 'component:GND', to: 'board:GND', color: 'black' } ],
    estimate: { components: 0, connections: 3, complexity: 'intermediate' },
    confidence: 0.75,
  },

  floating_input_pin: {
    category: 'connectivity',
    severity: 'warn',
    description: 'Add pull-up or pull-down resistor to floating input',
    prerequisites: ['input_pin_floating'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-resistor', value: '10000', position: 'inLine:${pin}:rail:20:0', purpose: 'pull-resistor' }, { type: 'addConnection', from: 'resistor:1', to: 'board:${pullDirection}', color: '${pullDirection === "5V" ? "red" : "black"}' }, { type: 'addConnection', from: 'resistor:2', to: 'board:${pin}', color: 'blue' } ],
    estimate: { components: 1, connections: 2, complexity: 'simple' },
    confidence: 0.90,
  },

  ds18b20_pull_up: {
    category: 'communication',
    severity: 'warn',
    description: 'Add pull-up resistor to DS18B20 1-Wire bus',
    prerequisites: ['ds18b20_found', 'no_pull_up'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-resistor', value: '4700', position: 'above:${ds18b20}:0:-30' }, { type: 'addConnection', from: 'resistor:1', to: 'board:5V', color: 'red' }, { type: 'addConnection', from: 'resistor:2', to: 'ds18b20:DQ', color: 'yellow' } ],
    estimate: { components: 1, connections: 2, complexity: 'simple' },
    confidence: 0.96,
  },

  servo_power_capacitor: {
    category: 'power',
    severity: 'warn',
    description: 'Add capacitor (47µF) across servo power for smoothing',
    prerequisites: ['servo_found', 'no_smoothing_capacitor'],
    steps: [ { type: 'addComponent', componentType: 'wokwi-capacitor', value: '47µF', position: 'parallel:${servo}:power:20:0' }, { type: 'addConnection', from: 'capacitor:+', to: 'servo:VCC', color: 'red' }, { type: 'addConnection', from: 'capacitor:-', to: 'servo:GND', color: 'black' } ],
    estimate: { components: 1, connections: 2, complexity: 'simple' },
    confidence: 0.88,
  },
};

export function findApplicablePatterns(error, circuitContext = {}) {
  const patterns = [];
  const errorMsg = String(error?.message || '').toLowerCase();
  const remediation = String(error?.remediation || '').toLowerCase();

  for (const [id, pattern] of Object.entries(fixPatternsCatalog)) {
    const description = pattern.description.toLowerCase();
    if (
      errorMsg.includes(id.replace(/_/g, ' ')) ||
      remediation.includes(id.replace(/_/g, ' ')) ||
      description.includes(errorMsg.slice(0, 20))
    ) {
      patterns.push({ id, ...pattern, matchType: 'keyword' });
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

export function estimateFixComplexity(patterns = []) {
  let totalComponents = 0;
  let totalConnections = 0;
  let complexityScores = { simple: 1, intermediate: 2, complex: 3 };

  patterns.forEach(p => {
    const est = p.estimate || {};
    totalComponents += est.components || 0;
    totalConnections += est.connections || 0;
  });

  if (totalComponents === 0 && totalConnections === 0) return 'info-only';
  if (totalComponents === 0 && totalConnections <= 2) return 'simple';
  if (totalComponents <= 2 && totalConnections <= 4) return 'intermediate';
  return 'complex';
}
