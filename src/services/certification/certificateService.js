/**
 * OpenHW Studio - Certification Service
 * Handles certification logic, competency verification, deterministic credential ID generation,
 * and social verification parameters for completed journeys.
 */

// All 22 official Arduino journey projects with competencies & domain classification
export const ARDUINO_CERTIFICATION_DOMAINS = [
  {
    domain: "Foundational Circuitry & Passive Components",
    skills: ["Current Limiting", "PWM Color Modulation", "Piezo Frequency Generation", "Voltage Division", "Photoresistor Signal Conditioning"],
    slugs: ["led-blink", "rgb-led", "buzzer", "potentiometer", "ldr"]
  },
  {
    domain: "Actuation, Control Loops & Thermal Physics",
    skills: ["Precision Servo Timing (50Hz PPM)", "Addressable LED Strip Bus", "Mechanical Switch Debounce Logic", "Analog Temperature Calibration"],
    slugs: ["servo-motor", "led-strip", "button-debounce", "temperature-sensor"]
  },
  {
    domain: "Electromechanical Drivers & Power Systems",
    skills: ["DC Motor H-Bridge Driver Logic", "Flyback Diode Snubber Operation", "Current Sink/Source Limits"],
    slugs: ["dc-motor"]
  },
  {
    domain: "Time-of-Flight & Micro-Optoelectronic Displays",
    skills: ["External Interrupt Vectors", "Ultrasonic Echo Pulse Math", "1-Wire DHT Protocol", "LiquidCrystal 4-Bit Parallel Interfacing"],
    slugs: ["push-button", "ultrasonic-sensor", "dht11-sensor", "lcd-display"]
  },
  {
    domain: "Advanced Bus Architectures & Inertial Kinematics",
    skills: ["Inductive Galvanic Isolation (Relay)", "I2C OLED Bitmap Engine (SSD1306)", "High-Density NeoPixel Arrays", "Matrix Keypad Scanning", "Rotary Quadrature Decoding", "Multiplexed 7-Segment Displays", "4-Phase Bipolar Stepper Sequencing", "6-DOF IMU Quaternion Filtering (MPU6050)"],
    slugs: ["relay-control", "oled-graphics", "neopixel-effects", "keypad-lock", "rotary-menu", "seven-segment-clock", "stepper-motor", "mpu6050-tilt"]
  }
];

export const ALL_ARDUINO_CERT_SLUGS = ARDUINO_CERTIFICATION_DOMAINS.flatMap(d => d.slugs);

/**
 * Checks whether user has completed all mandatory slugs for Arduino Journey
 * @param {string[]} completedProjects
 * @returns {boolean}
 */
export function isArduinoJourneyComplete(completedProjects = []) {
  if (!Array.isArray(completedProjects)) return false;
  return ALL_ARDUINO_CERT_SLUGS.every(slug => completedProjects.includes(slug));
}

/**
 * Calculates current journey progress stats
 * @param {string[]} completedProjects 
 */
export function getArduinoCertificationProgress(completedProjects = []) {
  const completedSet = new Set(completedProjects || []);
  const completed = ALL_ARDUINO_CERT_SLUGS.filter(slug => completedSet.has(slug));
  const remaining = ALL_ARDUINO_CERT_SLUGS.filter(slug => !completedSet.has(slug));
  const total = ALL_ARDUINO_CERT_SLUGS.length;
  const percentage = Math.round((completed.length / total) * 100);
  const isComplete = completed.length === total;

  return {
    total,
    completedCount: completed.length,
    remainingCount: remaining.length,
    percentage,
    isComplete,
    completedSlugs: completed,
    remainingSlugs: remaining
  };
}

// All 12 official ESP32 journey projects
export const ALL_ESP32_CERT_SLUGS = [
  'esp32-blink', 'esp32-analog', 'esp32-pwm',
  'esp32-wifi-scan', 'esp32-web-server', 'esp32-http-client',
  'esp32-mqtt', 'esp32-ble', 'esp32-deep-sleep',
  'esp32-oled-wifi', 'esp32-sensor-cloud', 'esp32-cam-stream'
];

/**
 * Checks whether user has completed all mandatory slugs for ESP32 Journey
 */
export function isEsp32JourneyComplete(completedProjects = []) {
  if (!Array.isArray(completedProjects)) return false;
  return ALL_ESP32_CERT_SLUGS.every(slug => completedProjects.includes(slug));
}

/**
 * Calculates ESP32 journey progress stats
 */
export function getEsp32CertificationProgress(completedProjects = []) {
  const completedSet = new Set(completedProjects || []);
  const completed = ALL_ESP32_CERT_SLUGS.filter(slug => completedSet.has(slug));
  const remaining = ALL_ESP32_CERT_SLUGS.filter(slug => !completedSet.has(slug));
  const total = ALL_ESP32_CERT_SLUGS.length;
  const percentage = Math.round((completed.length / total) * 100);
  const isComplete = completed.length === total;

  return {
    total,
    completedCount: completed.length,
    remainingCount: remaining.length,
    percentage,
    isComplete,
    completedSlugs: completed,
    remainingSlugs: remaining
  };
}

/**
 * Deterministically generates an official verification ID from user identifier and timestamp
 * Format: OHW-<TRACK>-<YEAR>-<HASH>
 */
export function generateCertificateId(userId = 'ANON', userEmail = '', track = 'ARD') {
  const cleanId = (userId || 'STUDENT').toString().replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'NODE';
  
  // Compute deterministic 4-character hex hash from email or identifier
  let hashVal = 0x811c9dc5;
  const str = `${userEmail || userId || 'openhw'}-${track.toLowerCase()}-journey-certification`;
  for (let i = 0; i < str.length; i++) {
    hashVal ^= str.charCodeAt(i);
    hashVal += (hashVal << 1) + (hashVal << 4) + (hashVal << 7) + (hashVal << 8) + (hashVal << 24);
  }
  const hexHash = Math.abs(hashVal).toString(16).padStart(4, '0').slice(-4).toUpperCase();
  const year = new Date().getFullYear();

  return `OHW-${track.toUpperCase()}-${year}-${cleanId}${hexHash}`;
}

/**
 * Pre-builds official LinkedIn Add-To-Profile Certification URL
 */
export function buildLinkedInCertUrl({ certName, certId, issueYear, issueMonth }) {
  const base = "https://www.linkedin.com/profile/add";
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: certName || "Certified Embedded Systems Specialist - Arduino Architecture",
    organizationName: "OpenHW Studio - FOSSEE",
    issueYear: String(issueYear || new Date().getFullYear()),
    issueMonth: String(issueMonth || new Date().getMonth() + 1),
    certId: certId || "",
    certUrl: window.location.origin ? `${window.location.origin}/certificate/${certId}` : `https://openhw-studio.fossee.in/certificate/${certId}`
  });

  return `${base}?${params.toString()}`;
}

/**
 * Full catalogue of OpenHW Studio credentials
 */
export const CERTIFICATION_TRACKS = [
  {
    id: 'arduino-specialist',
    trackKey: 'arduino',
    codePrefix: 'ARD',
    title: 'Certified Embedded Systems Specialist — Arduino Architecture',
    badgeTitle: 'AVR ATmega328P Mastery',
    subtitle: 'Circuit Fundamentals, Real-Time Actuation, I2C/SPI Protocols & IMU Filtering',
    description: 'Conferred upon demonstrating mastery over 22 hardware engineering islands across 5 progressive worlds. Validates microsecond precision timing, PWM motor sequencing, sensor calibration, OLED graphics buffers, and 6-DOF inertial kinematics.',
    totalProjects: 22,
    worldsCount: 5,
    difficulty: 'All Levels (Foundation to Advanced)',
    credentialType: 'Professional Hardware Micro-Credential',
    accentColor: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    iconName: 'Cpu',
    competencies: [
      'Current & Voltage Division',
      'PWM Signal Modulation',
      'Servo 50Hz PPM Control',
      'I2C Display Graphics Buffers',
      'External Hardware Interrupts',
      'Ultrasonic Time-of-Flight',
      'Matrix Keypad Scanning',
      'MPU6050 6-DOF IMU Kinematics'
    ],
    journeyUrl: '/adventure?journey=arduino',
    status: 'active'
  },
  {
    id: 'esp32-iot-architect',
    trackKey: 'esp32',
    codePrefix: 'ESP',
    title: 'Certified IoT Systems Architect — ESP32 & FreeRTOS',
    badgeTitle: 'Dual-Core Xtensa & Cloud Architecture',
    subtitle: 'Dual-Core Task Scheduling, 802.11 WiFi Stacks, BLE Beacons & Edge Telemetry',
    description: 'Validates proficiency in real-time embedded computing with FreeRTOS multitasking, concurrent network protocols, HTTP/WebSocket servers, MQTT edge-to-cloud pipelines, and deep-sleep low power consumption on the ESP32 platform.',
    totalProjects: 12,
    worldsCount: 4,
    difficulty: 'Intermediate to Advanced',
    credentialType: 'Specialized Systems Micro-Credential',
    accentColor: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    iconName: 'Wifi',
    competencies: [
      'Dual-Core FreeRTOS Task Scheduling',
      'WiFi 802.11 b/g/n Networking',
      'Embedded Web Server & REST Endpoints',
      'MQTT Protocol & Broker Integration',
      'Bluetooth Low Energy (BLE GATT)',
      'Ultra Low Power Deep-Sleep Cycles'
    ],
    journeyUrl: '/adventure?journey=esp32',
    status: 'active'
  },
  {
    id: 'stm32-systems-engineer',
    trackKey: 'stm32',
    codePrefix: 'STM',
    title: 'ARM Cortex-M Embedded Engineer — STM32 & CMSIS',
    badgeTitle: 'ARM Cortex-M4 & Bare-Metal C',
    subtitle: 'Hardware Registers, Direct Memory Access (DMA), Nested Vectored Interrupts',
    description: 'Deep dive into industrial 32-bit microcontrollers. Master bare-metal register manipulation, DMA streaming for zero-CPU audio and sensor acquisition, NVIC interrupt priority tables, and real-time CMSIS abstraction.',
    totalProjects: 15,
    worldsCount: 5,
    difficulty: 'Advanced / Industrial',
    credentialType: 'Professional Engineering Track',
    accentColor: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    iconName: 'Layers',
    competencies: [
      'ARM Cortex-M4 Architecture',
      'Bare-Metal Register Programming',
      'DMA Streams & Peripheral Bus',
      'NVIC Interrupt Priority Resolution',
      'Hardware Timer Input Capture',
      'CMSIS-Core & HAL Libraries'
    ],
    journeyUrl: null,
    status: 'roadmap'
  },
  {
    id: 'pico-rp2040-developer',
    trackKey: 'pico',
    codePrefix: 'PICO',
    title: 'Certified Embedded Systems Developer — Raspberry Pi Pico (RP2040)',
    badgeTitle: 'RP2040 Dual ARM Cortex-M0+',
    subtitle: 'Dual-Core Multiprocessing, Programmable I/O (PIO), MicroPython & C/C++ SDK',
    description: 'Master the Raspberry Pi RP2040 microcontroller architecture. Harness custom Programmable I/O (PIO) state machines for custom hardware protocols, inter-core FIFO synchronization, high-throughput DMA streaming, and low-latency peripheral actuation.',
    totalProjects: 14,
    worldsCount: 4,
    difficulty: 'Intermediate to Advanced',
    credentialType: 'Official Microcontroller Specialization',
    accentColor: '#c51a4a',
    gradient: 'linear-gradient(135deg, #c51a4a 0%, #e11d48 100%)',
    iconName: 'Cpu',
    competencies: [
      'Dual-Core ARM Cortex-M0+ Execution',
      'Programmable I/O (PIO) State Machines',
      'Inter-Core FIFO & Multicore Locks',
      'MicroPython & C/C++ Pico SDK',
      'DMA Peripheral Burst Transactions',
      'Hardware PWM, I2C, SPI & UART Interfaces'
    ],
    journeyUrl: null,
    status: 'roadmap'
  }
];
