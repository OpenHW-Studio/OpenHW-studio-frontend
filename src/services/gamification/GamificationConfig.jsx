// ─── GamificationConfig.js ────────────────────────────────────────────────────
// Central configuration for all levels, unlockable components, badges, and XP.
// Import this wherever you need level/component data.

export const LEVELS = [
  {
    id: 1,
    title: 'Hello, World',
    subtitle: 'Your first circuit',
    description: 'Build a basic LED blink circuit. The foundation of every maker.',
    xpRequired: 0,
    xpReward: 100,
    color: '#22c55e',
    icon: '💡',
    unlockedComponents: [
      'wokwi-arduino-uno',
      'wokwi-led',
      'wokwi-resistor',
      'wokwi-breadboard',
      'wokwi-breadboard-half',
      'wokwi-breadboard-mini',
      'wokwi-a4988',
      'wokwi-stepper-motor',
      'wokwi-nlsf595',
      'wokwi-cd74hc4067',
      'wokwi-l293d',
      'wokwi-rgb-led',
      'wokwi-rotary-encoder',
      'wokwi-logic-analyzer',
      'wokwi-nokia-5110',
      'wokwi-soil-moisture-sensor',
      'wokwi-npn-transistor',
      'wokwi-diode',
      'wokwi-photodiode',
      'wokwi-pca9685',
    ],
    badge: {
      id: 'badge_hello_world',
      name: 'Hello World',
      description: 'Built your first blinking LED circuit',
      icon: '💡',
      rarity: 'common',
    },
    objectives: [
      'Place an Arduino Uno on the canvas',
      'Connect an LED via a resistor to pin 13',
      'Write code to blink every 1 second',
      'Run the simulation',
    ],
  },
  {
    id: 2,
    title: 'Button Masher',
    subtitle: 'Reading digital input',
    description: 'Control your LED with a push button. Learn about digital input.',
    xpRequired: 100,
    xpReward: 200,
    color: '#3b82f6',
    icon: '🔘',
    unlockedComponents: [
      'wokwi-pushbutton',
    ],
    badge: {
      id: 'badge_button_masher',
      name: 'Button Masher',
      description: 'Mastered digital input with a push button',
      icon: '🔘',
      rarity: 'common',
    },
    objectives: [
      'Add a push button to your circuit',
      'Wire the button to a digital pin',
      'LED turns on only when button is pressed',
      'Use digitalRead() in your code',
    ],
  },
  {
    id: 3,
    title: 'Analog Apprentice',
    subtitle: 'Variable signals',
    description: 'Use a potentiometer to control LED brightness via PWM.',
    xpRequired: 300,
    xpReward: 300,
    color: '#f59e0b',
    icon: '🎛️',
    unlockedComponents: [
      'wokwi-potentiometer',
      'wokwi-power-supply',
    ],
    badge: {
      id: 'badge_analog_apprentice',
      name: 'Analog Apprentice',
      description: 'Harnessed analog signals with a potentiometer',
      icon: '🎛️',
      rarity: 'uncommon',
    },
    objectives: [
      'Add a potentiometer to the circuit',
      'Read analog value from A0',
      'Map value to control LED brightness',
      'Use analogWrite() for PWM output',
    ],
  },
  {
    id: 4,
    title: 'Sound Engineer',
    subtitle: 'Audio & motion',
    description: 'Add a buzzer and servo motor. Bring your circuit to life.',
    xpRequired: 600,
    xpReward: 400,
    color: '#ec4899',
    icon: '🔊',
    unlockedComponents: [
      'wokwi-buzzer',
      'wokwi-servo',
    ],
    badge: {
      id: 'badge_sound_engineer',
      name: 'Sound Engineer',
      description: 'Controlled sound and movement simultaneously',
      icon: '🔊',
      rarity: 'uncommon',
    },
    objectives: [
      'Wire a buzzer to a digital PWM pin',
      'Add a servo motor',
      'Trigger buzzer sound on button press',
      'Sweep servo on potentiometer input',
    ],
  },
  {
    id: 5,
    title: 'Color Wizard',
    subtitle: 'RGB & addressable LEDs',
    description: 'Master color control with RGB LEDs and NeoPixel matrices.',
    xpRequired: 1000,
    xpReward: 500,
    color: '#8b5cf6',
    icon: '🌈',
    unlockedComponents: [
      'wokwi-rgb-led',
      'wokwi-neopixel-matrix',
      'wokwi-neopixel-ring',
    ],
    badge: {
      id: 'badge_color_wizard',
      name: 'Color Wizard',
      description: 'Created stunning RGB color patterns',
      icon: '🌈',
      rarity: 'rare',
    },
    objectives: [
      'Wire an RGB LED with 3 resistors',
      'Cycle through red, green, blue colors',
      'Add a NeoPixel matrix',
      'Create an animated color pattern',
    ],
  },
  {
    id: 6,
    title: 'Data Displayer',
    subtitle: 'Show your data',
    description: 'Display real-time sensor data on LCD and 7-segment displays.',
    xpRequired: 1500,
    xpReward: 600,
    color: '#06b6d4',
    icon: '📟',
    unlockedComponents: [
      'wokwi-lcd1602',
      'wokwi-7segment',
      'wokwi-tm1637-7segment',
    ],
    badge: {
      id: 'badge_data_displayer',
      name: 'Data Displayer',
      description: 'Showed real data on a display for the first time',
      icon: '📟',
      rarity: 'rare',
    },
    objectives: [
      'Connect an LCD display via I2C',
      'Show "Hello World" on LCD',
      'Display a counting number on 7-segment',
      'Update display with sensor readings',
    ],
  },
  {
    id: 7,
    title: 'Sensor Scout',
    subtitle: 'Feeling the environment',
    description: 'Add eyes and ears to your circuit with temperature, light, and ultrasonic sensors.',
    xpRequired: 2100,
    xpReward: 700,
    color: '#14b8a6',
    icon: '📡',
    unlockedComponents: [
      'wokwi-ntc-temperature-sensor',
      'wokwi-photoresistor-sensor',
      'wokwi-hc-sr04',
    ],
    badge: {
      id: 'badge_sensor_scout',
      name: 'Sensor Scout',
      description: 'Wired up 3 different environmental sensors',
      icon: '📡',
      rarity: 'rare',
    },
    objectives: [
      'Read temperature from NTC sensor',
      'Detect light with a photoresistor',
      'Measure distance with HC-SR04',
      'Print all 3 readings to serial monitor',
    ],
  },
  {
    id: 8,
    title: 'Motor Commander',
    subtitle: 'Mechanical power',
    description: 'Control DC motors with an H-bridge driver. Build a mini robot drive.',
    xpRequired: 2800,
    xpReward: 800,
    color: '#f97316',
    icon: '⚙️',
    unlockedComponents: [
      'wokwi-motor',
      'wokwi-motor-driver',
    ],
    badge: {
      id: 'badge_motor_commander',
      name: 'Motor Commander',
      description: 'Built a dual-motor drive circuit',
      icon: '⚙️',
      rarity: 'epic',
    },
    objectives: [
      'Wire L293D motor driver to Arduino',
      'Connect two DC motors',
      'Control speed with PWM',
      'Reverse motor direction with code',
    ],
  },
  {
    id: 9,
    title: 'Logic Legend',
    subtitle: 'Advanced circuits',
    description: 'Expand outputs with shift registers and implement logic gate circuits.',
    xpRequired: 3600,
    xpReward: 900,
    color: '#a855f7',
    icon: '🧠',
    unlockedComponents: [
      'shift_register',
    ],
    badge: {
      id: 'badge_logic_legend',
      name: 'Logic Legend',
      description: 'Implemented a shift register circuit',
      icon: '🧠',
      rarity: 'epic',
    },
    objectives: [
      'Wire a 74HC595 shift register',
      'Control 8 LEDs with 3 Arduino pins',
      'Implement a binary counter',
      'Run a Knight Rider LED pattern',
    ],
  },
  {
    id: 10,
    title: 'Circuit Master',
    subtitle: 'Full unlock achieved',
    description: 'You\'ve mastered the fundamentals. All components unlocked. Build anything.',
    xpRequired: 4500,
    xpReward: 1000,
    color: '#fbbf24',
    icon: '🏆',
    unlockedComponents: ['*'], // All components
    badge: {
      id: 'badge_circuit_master',
      name: 'Circuit Master',
      description: 'Completed all 10 levels. A true hardware engineer.',
      icon: '🏆',
      rarity: 'legendary',
    },
    objectives: [
      'Complete all previous levels',
      'Build a project using 5+ component types',
      'Write 50+ lines of Arduino code',
      'Share your project with the community',
    ],
  },
];

// Badge rarity colors and labels
export const RARITY_CONFIG = {
  common: { color: '#9ca3af', glow: '#9ca3af44', label: 'Common' },
  uncommon: { color: '#22c55e', glow: '#22c55e44', label: 'Uncommon' },
  rare: { color: '#3b82f6', glow: '#3b82f644', label: 'Rare' },
  epic: { color: '#a855f7', glow: '#a855f744', label: 'Epic' },
  legendary: { color: '#fbbf24', glow: '#fbbf2444', label: 'Legendary' },
};

// Returns which components are unlocked for a given level number
export function getUnlockedComponents(currentLevel) {
  const unlocked = new Set();
  for (const lvl of LEVELS) {
    if (lvl.id <= currentLevel) {
      if (lvl.unlockedComponents.includes('*')) return '*'; // All unlocked
      lvl.unlockedComponents.forEach(c => unlocked.add(c));
    }
  }
  return unlocked;
}

// Returns true if a component type is accessible at the given level
export function isComponentUnlocked(componentType, currentLevel) {
  const unlocked = getUnlockedComponents(currentLevel);
  if (unlocked === '*') return true;
  return unlocked.has(componentType);
}

// Returns the level at which a component first becomes available
export function getComponentUnlockLevel(componentType) {
  for (const lvl of LEVELS) {
    if (lvl.unlockedComponents.includes('*') || lvl.unlockedComponents.includes(componentType)) {
      return lvl.id;
    }
  }
  return null; // Not tied to any level (always available)
}

// Total XP needed to reach a level
export function xpForLevel(levelId) {
  return LEVELS.find(l => l.id === levelId)?.xpRequired ?? 0;
}