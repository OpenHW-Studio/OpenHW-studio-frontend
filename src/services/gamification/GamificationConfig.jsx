
// ── Starting components (none - all unlocked via adventure) ───────────────────

// ── Starting components — ALWAYS unlocked, no adventure map needed ─────────────
// Arduino boards are the base learning platform and must never be locked.
export const STARTING_COMPONENTS = [
  // Arduino boards — ALL variants always unlocked (short ID + both prefixes)
  'uno',  'wokwi-arduino-uno',  'openhw-arduino-uno',
  'nano', 'wokwi-arduino-nano', 'openhw-arduino-nano',
  'mega', 'wokwi-arduino-mega', 'openhw-arduino-mega',
  // Core passive components
  'led',        'wokwi-led',        'openhw-led',
  'resistor',   'wokwi-resistor',   'openhw-resistor',
  'breadboard', 'wokwi-breadboard', 'openhw-breadboard',
  'wokwi-breadboard-half', 'openhw-breadboard-half',
  // Boards that map to 'uno'/'nano'/'mega' — alias coverage
  'arduino-uno', 'arduino-nano', 'arduino-mega',
  // ESP32 boards — always unlocked for ESP32 journey
  'esp32',           'wokwi-esp32-devkit-v1', 'openhw-esp32',
  'esp32-cam',       'wokwi-esp32-cam',        'openhw-esp32-cam',
  'esp32-devkit-v1', 'esp32-wroom-32',
];

// ── Level config (XP-based titles / badges, separate from component unlocking) ─
export const LEVELS = [
  {
    id: 1,
    title: 'Spark Starter',
    subtitle: 'Your first circuit!',
    description: 'Build a blinking LED — the "Hello World" of electronics.',
    xpRequired: 0,
    xpReward: 100,
    color: '#22c55e',
    icon: '💡',
    unlockedComponents: [
      'wokwi-arduino-uno',
      'openhw-arduino-uno',
      'wokwi-led',
      'openhw-led',
      'wokwi-resistor',
      'openhw-resistor',
    ],
    badge: {
      id: 'badge_spark_starter',
      name: 'Spark Starter',
      description: 'Made your first LED blink!',
      icon: '💡',
      rarity: 'common',
    },
  },
  {
    id: 2,
    title: 'Color Explorer',
    subtitle: 'Mixing colors with light',
    description: 'Control an RGB LED and mix any color you want.',
    xpRequired: 100,
    xpReward: 150,
    color: '#a855f7',
    icon: '🌈',
    unlockedComponents: [
      'wokwi-breadboard',
      'openhw-breadboard',
      'wokwi-breadboard-half',
      'openhw-breadboard-half',
      'wokwi-breadboard-mini',
      'openhw-breadboard-mini',
      'wokwi-rgb-led',
      'openhw-rgb-led',
    ],
    badge: {
      id: 'badge_color_explorer',
      name: 'Color Explorer',
      description: 'Mixed colors with an RGB LED!',
      icon: '🌈',
      rarity: 'common',
    },
  },
  {
    id: 3,
    title: 'Sound Maker',
    subtitle: 'Making music with code',
    description: 'Play tones and melodies with a buzzer.',
    xpRequired: 250,
    xpReward: 120,
    color: '#f59e0b',
    icon: '🎵',
    unlockedComponents: [
      'wokwi-buzzer',
      'openhw-buzzer',
    ],
    badge: {
      id: 'badge_sound_maker',
      name: 'Sound Maker',
      description: 'Played a melody with a buzzer!',
      icon: '🎵',
      rarity: 'common',
    },
  },
  {
    id: 4,
    title: 'Knob Controller',
    subtitle: 'Reading analog signals',
    description: 'Use a potentiometer to control brightness.',
    xpRequired: 370,
    xpReward: 130,
    color: '#06b6d4',
    icon: '🎛️',
    unlockedComponents: [
      'wokwi-potentiometer',
      'openhw-potentiometer',
      'wokwi-slide-potentiometer',
      'openhw-slide-potentiometer',
    ],
    badge: {
      id: 'badge_knob_controller',
      name: 'Knob Controller',
      description: 'Used a potentiometer to control brightness!',
      icon: '🎛️',
      rarity: 'uncommon',
    },
  },
  {
    id: 5,
    title: 'Light Chaser',
    subtitle: 'Sensing the world around you',
    description: 'Auto-control your LED based on how bright the room is.',
    xpRequired: 500,
    xpReward: 140,
    color: '#eab308',
    icon: '🌞',
    unlockedComponents: [
      'wokwi-photoresistor',
      'openhw-photoresistor',
      'wokwi-ldr-module',
      'openhw-ldr-module',
    ],
    badge: {
      id: 'badge_light_chaser',
      name: 'Light Chaser',
      description: 'Built a light-sensing circuit!',
      icon: '🌞',
      rarity: 'uncommon',
    },
  },
  {
    id: 6,
    title: 'Motion Master',
    subtitle: 'Making things move',
    description: 'Control a servo motor with precise angles.',
    xpRequired: 640,
    xpReward: 200,
    color: '#3b82f6',
    icon: '⚙️',
    unlockedComponents: [
      'wokwi-lcd1602',
      'wokwi-lcd1602-i2c',
      'openhw-lcd1602-i2c',
      'wokwi-lcd2004-i2c',
      'openhw-lcd2004-i2c',
      'wokwi-ssd1306-oled',
      'openhw-ssd1306-oled',
      'wokwi-max7219',
      'openhw-max7219',
      'wokwi-ili9341',
      'openhw-ili9341',
      'wokwi-7segment',
      'openhw-7segment',
      'wokwi-tm1637-7segment',
      'openhw-tm1637-7segment',
      'wokwi-servo',
      'openhw-servo',
    ],
    badge: {
      id: 'badge_motion_master',
      name: 'Motion Master',
      description: 'Controlled a servo motor!',
      icon: '⚙️',
      rarity: 'uncommon',
    },
  },
  {
    id: 7,
    title: 'Light Show Artist',
    subtitle: 'Creating LED animations',
    description: 'Drive dazzling NeoPixel LED strips.',
    xpRequired: 840,
    xpReward: 220,
    color: '#ec4899',
    icon: '✨',
    unlockedComponents: [
      'wokwi-neopixel-matrix',
      'openhw-neopixel-matrix',
      'wokwi-neopixel-ring',
      'openhw-neopixel-ring',
    ],
    badge: {
      id: 'badge_light_artist',
      name: 'Light Show Artist',
      description: 'Created an LED strip animation!',
      icon: '✨',
      rarity: 'rare',
    },
  },
  {
    id: 8,
    title: 'Button Ninja',
    subtitle: 'Clean & reliable input',
    description: 'Handle button presses without glitches.',
    xpRequired: 1060,
    xpReward: 250,
    color: '#14b8a6',
    icon: '🔘',
    unlockedComponents: [
      'wokwi-pushbutton',
      'openhw-pushbutton',
    ],
    badge: {
      id: 'badge_button_ninja',
      name: 'Button Ninja',
      description: 'Mastered button debouncing!',
      icon: '🔘',
      rarity: 'rare',
    },
  },
  {
    id: 9,
    title: 'Temperature Detective',
    subtitle: 'Measuring the environment',
    description: 'Read temperature and log it to the serial monitor.',
    xpRequired: 1310,
    xpReward: 260,
    color: '#ef4444',
    icon: '🌡️',
    badge: {
      id: 'badge_temp_detective',
      name: 'Temperature Detective',
      description: 'Read temperature from a sensor!',
      icon: '🌡️',
      rarity: 'rare',
    },
    unlockedComponents: [
      'wokwi-ntc-temperature-sensor',
      'openhw-ntc-temperature-sensor',
      'wokwi-dht22',
      'openhw-dht22',
    ],
  },
  {
    id: 10,
    title: 'Circuit Champion',
    subtitle: 'Full unlock achieved!',
    description: "You've mastered the fundamentals. Build anything!",
    xpRequired: 1570,
    xpReward: 500,
    color: '#fbbf24',
    icon: '🏆',
    unlockedComponents: [
      'wokwi-motor',
      'openhw-motor',
      'wokwi-l293d',
      'openhw-l293d',
    ],
    badge: {
      id: 'badge_circuit_champion',
      name: 'Circuit Champion',
      description: 'Completed all projects. A true maker!',
      icon: '🏆',
      rarity: 'legendary',
    },
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

// isComponentUnlocked now receives the unlockedComponentTypes array/set from context state
export function isComponentUnlocked(componentType, unlockedComponentTypes) {
  if (!unlockedComponentTypes) {
    return STARTING_COMPONENTS.includes(componentType) ||
      (componentType.startsWith('openhw-') && STARTING_COMPONENTS.includes(componentType.replace('openhw-', 'wokwi-'))) ||
      (componentType.startsWith('wokwi-') && STARTING_COMPONENTS.includes(componentType.replace('wokwi-', 'openhw-')));
  }
  if (unlockedComponentTypes === '*') return true;
  
  const check = (type) => {
    if (Array.isArray(unlockedComponentTypes)) return unlockedComponentTypes.includes(type);
    if (unlockedComponentTypes instanceof Set) return unlockedComponentTypes.has(type);
    return false;
  };

  if (check(componentType)) return true;
  if (componentType.startsWith('openhw-') && check(componentType.replace('openhw-', 'wokwi-'))) return true;
  if (componentType.startsWith('wokwi-') && check(componentType.replace('wokwi-', 'openhw-'))) return true;
  return false;
}

// Total XP needed to reach a level
export function xpForLevel(levelId) {
  return LEVELS.find(l => l.id === levelId)?.xpRequired ?? 0;
}

// Legacy compat: getUnlockedComponents kept so existing imports don't break
// Returns the STARTING_COMPONENTS set (actual unlocks now tracked in context)
export function getUnlockedComponents() {
  return new Set(STARTING_COMPONENTS);
}
