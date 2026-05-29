import { COMPONENT_REGISTRY } from '../../pages/simulationpage/utils/componentRegistry.js';

// Map component groups to categories for ComponentsPage
const GROUP_TO_CATEGORY = {
  Boards: 'Boards',
  Basic: 'Basic',
  Output: 'Output',
  Outputs: 'Output',
  Input: 'Input',
  Inputs: 'Input',
  Passives: 'Passive',
  Power: 'Power',
  Sensors: 'Sensor',
  Displays: 'Display',
  Actuators: 'Actuator',
  Misc: 'Misc',
  Logic: 'Logic',
};

// Icon mapping for components - uses emoji based on type
function getIconForType(shortId, manifest) {
  const icons = {
    led: '💡', resistor: '⚡', buzzer: '🔊', button: '🔘',
    'rgb-led': '🌈', potentiometer: '🎛️', servo: '⚙️',
    neopixel: '✨', lcd: '🖥️', 'lcd1602-i2c': '🖥️', 'lcd2004-i2c': '🖥️',
    'lcd1602': '🖥️', ultrasonic: '📡', 'analog-joystick': '🕹️',
    motor: '🔩', 'motor-driver': '🔌', l293d: '🔌',
    arduino: '🟩', 'arduino-uno': '🟩', 'arduino-nano': '🟩',
    'arduino-mega': '🟩', pico: '🟩', 'pico-w': '🟩',
    breadboard: '🔌', battery: '🔋',
  };
  // Try shortId first, then check for wokwi type forms
  const shortIcon = icons[shortId];
  if (shortIcon) return shortIcon;
  // Fallback to label first char
  return manifest.label ? manifest.label.charAt(0) : '🔧';
}

function getColorForGroup(group) {
  const colors = {
    Boards: '#6366f1', Basic: '#10b981', Output: '#22c55e',
    Outputs: '#22c55e', Input: '#3b82f6', Inputs: '#3b82f6',
    Passives: '#f59e0b', Power: '#ef4444', Sensors: '#14b8a6',
    Displays: '#ec4899', Actuators: '#06b6d4', Misc: '#8b5cf6', Logic: '#8b5cf6',
  };
  return colors[group] || '#3b82f6';
}

// Build COMPONENTS dynamically from the emulator component registry
export const COMPONENTS = Object.entries(COMPONENT_REGISTRY)
  .filter(([type, mod]) => mod.manifest && !mod.manifest.hiddenAlias)
  .map(([type, mod]) => {
    const m = mod.manifest;
    const shortId = type.replace('openhw-', '').replace('wokwi-', '');
    return {
      id: shortId,
      name: m.label || shortId,
      fullName: m.label || shortId,
      icon: getIconForType(shortId, m),
      color: getColorForGroup(m.group),
      category: GROUP_TO_CATEGORY[m.group] || 'Misc',
      description: m.description || '',
      wokwiType: type, // Full type for simulator matching
    };
  });

// ─── Config helpers ───────────────────────────────────────────────────────────
export const COMPONENT_MAP = Object.fromEntries(COMPONENTS.map(c => [c.id, c]))

export const CATEGORIES = ['All', ...new Set(COMPONENTS.map(c => c.category))]

export function getUnlockedComponents(unlockedIds = []) {
  return COMPONENTS.filter(c => unlockedIds.includes(c.id))
}

export function getLockedComponents(unlockedIds = []) {
  return COMPONENTS.filter(c => !unlockedIds.includes(c.id))
}

export function canStartProject(project, unlockedIds = []) {
  if (!project.requiredComponents) return true
  return project.requiredComponents.every(id => unlockedIds.includes(id))
}

export function getMissingComponents(project, unlockedIds = []) {
  if (!project.requiredComponents) return []
  return project.requiredComponents
    .filter(id => !unlockedIds.includes(id))
    .map(id => COMPONENT_MAP[id])
    .filter(Boolean)
}