
// ── Starting components (always available from Day 1) ─────────────────────────
export const STARTING_COMPONENTS = [
  'wokwi-arduino-uno',
  'wokwi-led',
  'wokwi-resistor',
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
  common:    { color: '#9ca3af', glow: '#9ca3af44', label: 'Common' },
  uncommon:  { color: '#22c55e', glow: '#22c55e44', label: 'Uncommon' },
  rare:      { color: '#3b82f6', glow: '#3b82f644', label: 'Rare' },
  epic:      { color: '#a855f7', glow: '#a855f744', label: 'Epic' },
  legendary: { color: '#fbbf24', glow: '#fbbf2444', label: 'Legendary' },
};

// isComponentUnlocked now receives the unlockedComponentTypes array/set from context state
export function isComponentUnlocked(componentType, unlockedComponentTypes) {
  if (!unlockedComponentTypes) return STARTING_COMPONENTS.includes(componentType);
  if (unlockedComponentTypes === '*') return true;
  if (Array.isArray(unlockedComponentTypes)) return unlockedComponentTypes.includes(componentType);
  if (unlockedComponentTypes instanceof Set) return unlockedComponentTypes.has(componentType);
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
