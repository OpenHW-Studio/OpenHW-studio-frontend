/**
 * Component Visibility & Status Configuration
 *
 * Use this configuration file to control component visibility in the palette
 * and display "Not Working / Warning" status indicators.
 *
 * Supported configuration properties per component type:
 * - hide: boolean (if true, component is hidden from Palette Panel and Quick Add search)
 * - warning: string | boolean (custom warning message or true for default warning)
 * - notWorking: boolean (alternative flag to indicate component is currently non-functional)
 *
 * Example:
 * export const COMPONENT_STATUS_CONFIG = {
 *   'wokwi-some-hidden-comp': {
 *     hide: true
 *   },
 *   'wokwi-broken-comp': {
 *     warning: 'This component is currently not working in simulation.'
 *   }
 * };
 */

export const COMPONENT_STATUS_CONFIG = {
  // Boards
  'openhw-arduino-uno': {
    status: 'verified',
    summary: 'ATmega328P 8-bit AVR Microcontroller @ 16 MHz',
    working: [
      'Digital GPIO (Pins 0–13)',
      'Hardware PWM (Pins 3, 5, 6, 9, 10, 11)',
      'Analog ADC Inputs (A0–A5)',
      'UART Serial Monitor & Plotter',
      'Hardware SPI & Wire (I2C)',
      'EEPROM Read/Write',
      'External Interrupts (INT0, INT1)',
      'Pin Change Interrupts (PCINT)'
    ],
    inProgress: [],
    limitations: ['Single core, 32KB flash limit'],
    notes: 'Cycle-accurate AVR simulation powered by avr8js. Standard reference board.'
  },

  'openhw-raspberry-pi-pico': {
    status: 'verified',
    summary: 'Dual-core ARM Cortex-M0+ RP2040 @ 133 MHz',
    working: [
      'Dual-Core Execution',
      'Digital GPIO (Pins 0–28)',
      'Hardware PWM (16 PWM Channels)',
      'ADC Inputs (Pins 26–28)',
      'Hardware UART0 & UART1',
      'Hardware I2C0, I2C1, SPI0, SPI1',
      'Programmable I/O (PIO) Core Simulation',
      'MicroPython & C/C++ SDK Runtime'
    ],
    inProgress: [],
    limitations: ['USB HID device emulation in progress'],
    notes: 'Powered by rp2040js engine with PIO support.'
  },

  'openhw-esp32': {
    hide: true,
    status: 'beta',
    summary: 'Tensilica Xtensa Dual-Core 32-bit LX6 @ 240 MHz',
    working: [
      'Digital GPIO Input & Output',
      'LEDC Hardware PWM Channels',
      'ADC1 Analog Read',
      'Hardware I2C / Wire Bus',
      'Hardware SPI Bus',
      'UART Serial Communication'
    ],
    inProgress: [
      'WiFi Station & Access Point Simulation',
      'FreeRTOS Multi-Tasking Scheduler Timing',
      'Deep Sleep & Wakeup Triggers'
    ],
    limitations: [
      'Bluetooth BLE Subsystem (Planned)'
    ],
    notes: 'Microcontroller core and GPIO peripherals run reliably. WiFi networking stack is currently undergoing active implementation.'
  },

  'openhw-esp32-cam': {
    hide: true,
    status: 'in-development',
    summary: 'ESP32 with OV2640 Camera Module & MicroSD Card Socket',
    working: [
      'ESP32 GPIO & Flash Memory',
      'Onboard Flashlight LED'
    ],
    inProgress: [
      'OV2640 Camera Framebuffer Emulation',
      'MicroSD Card SPI Storage Interface'
    ],
    limitations: [],
    notes: 'Camera sensor frame emulation under active development.'
  },

  'openhw-arduino-nano': {
    hide: true,
    status: 'in-development',
    summary: 'ATmega328P Compact Breadboard-Friendly Board',
    working: ['Core AVR Simulation (AVR8js)'],
    inProgress: ['Canvas UI & Pin Routing Optimization'],
    limitations: [],
    notes: 'Core logic ready; canvas UI pin rendering being finalized.'
  },

  'openhw-arduino-mega': {
    hide: true,
    status: 'in-development',
    summary: 'ATmega2560 High-I/O Board (54 Digital I/O, 16 Analog Inputs)',
    working: ['AVR2560 Memory Model'],
    inProgress: ['54-Pin Canvas Layout & Routing Matrix'],
    limitations: [],
    notes: 'High-density pin canvas rendering in active development.'
  },

  'openhw-attiny85': {
    hide: true,
    status: 'in-development',
    summary: '8-pin Low-Power AVR Microcontroller',
    working: ['AVR Tiny Core Execution'],
    inProgress: ['Canvas Pinout & Palette Integration'],
    limitations: ['8-pin footprint constraint'],
    notes: 'Minimalist AVR board model undergoing palette integration.'
  },

  'openhw-stm32-blue-pill (frontend)': {
    hide: true,
    status: 'in-development',
    summary: 'STM32F103C8T6 ARM Cortex-M3 @ 72 MHz',
    working: ['Visual Breadboard Form-Factor Model'],
    inProgress: ['ARM Cortex-M3 GDB / Emulation Core Integration'],
    limitations: ['ARM backend runner connection'],
    notes: 'Cortex-M3 simulation backend is currently being linked to the web emulator.'
  },

  // Audio Components
  'openhw-sph0645': {
    hide: true,
    status: 'in-development',
    summary: 'I2S MEMS Microphone Breakout',
    working: [],
    inProgress: ['I2S Bus Audio Streaming', 'Web Audio API Microphone Emulation'],
    limitations: [],
    notes: 'Web Audio API backend audio pipeline integration in progress.'
  },

  'openhw-pcm5102': {
    hide: true,
    status: 'in-development',
    summary: 'High-Quality Stereo I2S DAC Module',
    working: [],
    inProgress: ['I2S DAC Digital-to-Analog Audio Synthesis'],
    limitations: [],
    notes: 'Audio synthesizer driver integration in development.'
  },

  'openhw-max98357': {
    hide: true,
    status: 'in-development',
    summary: 'I2S Class-D Mono Amplifier',
    working: [],
    inProgress: ['I2S Audio Pipeline Streaming'],
    limitations: [],
    notes: 'Audio amplifier emulation undergoing development.'
  },

  'openhw-inmp441': {
    hide: true,
    status: 'in-development',
    summary: 'Omnidirectional I2S Microphone with Bottom Port',
    working: [],
    inProgress: ['I2S Audio Sampling Integration'],
    limitations: [],
    notes: 'Audio driver pipeline in progress.'
  },

  'openhw-5w-speaker': {
    hide: true,
    status: 'in-development',
    summary: '4 Ohm 5W Dynamic Audio Speaker',
    working: [],
    inProgress: ['Synthesized Audio Output via Browser AudioContext'],
    limitations: [],
    notes: 'Browser Web Audio playback engine integration in progress.'
  },
};

/**
 * Returns raw configuration object for a component type.
 * @param {string} type 
 * @returns {object}
 */
export function getComponentStatus(type) {
  if (!type) return {};
  return COMPONENT_STATUS_CONFIG[type] || {};
}

/**
 * Checks if a component should be hidden from Palette Panel & Quick Add search.
 * @param {string} type 
 * @returns {boolean}
 */
export function isComponentHidden(type) {
  if (!type) return false;
  return !!COMPONENT_STATUS_CONFIG[type]?.hide;
}

/**
 * Returns warning message string if component is marked with warning/not-working, else null.
 * @param {string} type 
 * @returns {string|null}
 */
export function getComponentWarning(type) {
  if (!type) return null;
  const config = COMPONENT_STATUS_CONFIG[type];
  if (!config) return null;

  if (typeof config.warning === 'string' && config.warning.trim().length > 0) {
    return config.warning;
  }
  if (config.warning === true || config.notWorking === true) {
    return 'Warning: This component is currently not working properly in simulation.';
  }
  if (config.warning && typeof config.warning === 'object' && config.warning.message) {
    return config.warning.message;
  }
  return null;
}

/**
 * Resolves component status and details following the 3-tier hierarchy:
 * Priority 1: componentVisibilityConfig.js override
 * Priority 2: manifest.json
 * Priority 3: Smart fallback based on visibility & category
 *
 * @param {string} type - e.g. "openhw-arduino-uno"
 * @param {object} [manifest] - Component manifest from componentRegistry
 * @returns {object} { status: 'verified'|'beta'|'in-development', summary, working, inProgress, limitations, notes, docSlug }
 */
export function resolveComponentDetails(type, manifest = {}) {
  const override = COMPONENT_STATUS_CONFIG[type] || {};

  // 1. Determine status
  let status = 'verified';
  if (override.status) {
    status = override.status;
  } else if (manifest.status) {
    status = manifest.status;
  } else if (override.hide || override.notWorking) {
    status = 'in-development';
  } else if (override.warning) {
    status = 'beta';
  }

  // 2. Determine working features
  let working = override.working || manifest.working || null;
  if (!working || working.length === 0) {
    if (status === 'verified') {
      working = [
        'Simulation model implemented and verified',
        'Interactive real-time electrical simulation',
        'Tested with Arduino C++ / MicroPython sketches',
        'Full circuit diagram & pin connection routing'
      ];
    } else if (status === 'beta') {
      working = [
        'Core visual and electrical model operational',
        'Basic input/output and GPIO interactivity'
      ];
    } else {
      working = [
        'Visual component schematic model in place'
      ];
    }
  }

  // 3. In progress and limitations
  const inProgress = override.inProgress || manifest.inProgress || (status === 'in-development' ? ['Full simulation engine driver implementation'] : []);
  const limitations = override.limitations || manifest.limitations || [];

  // 4. Notes
  const notes = override.notes || manifest.notes || override.warning || (status === 'in-development' ? 'Simulation model is currently under active development by the OpenHW-Studio team.' : 'Fully supported in simulation.');

  // 5. Documentation slug (maps to openhw-studio-docs/components/)
  const docSlug = override.docSlug || manifest.docSlug || type;

  return {
    status,
    summary: override.summary || manifest.summary || manifest.description || '',
    working,
    inProgress,
    limitations,
    notes,
    docSlug,
    hidden: !!(override.hide || manifest.hide)
  };
}

