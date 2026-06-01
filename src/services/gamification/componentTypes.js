export const STARTER_COMPONENT_TYPES = [
  'openhw-arduino-uno',
  'openhw-led',
  'openhw-resistor',
  'openhw-breadboard',
  'openhw-breadboard-half',
  'openhw-breadboard-mini',
];

export function canonicalComponentType(value) {
  if (value === '*') return '*';
  const raw = String(value?.type || value?.wokwiType || value?.id || value || '').trim();
  if (!raw) return null;
  if (raw === '*') return '*';
  if (raw.startsWith('openhw-')) return raw;
  if (raw.startsWith('wokwi-')) return `openhw-${raw.slice(6)}`;
  return `openhw-${raw}`;
}

export function componentTypeAliases(value) {
  const canonical = canonicalComponentType(value);
  if (!canonical) return [];
  if (canonical === '*') return ['*'];
  const aliases = new Set([canonical]);
  if (canonical.startsWith('openhw-')) aliases.add(`wokwi-${canonical.slice(7)}`);
  return [...aliases];
}

export function normalizeUnlockList(values, { includeAliases = true } = {}) {
  if (values === '*') return '*';
  const input = Array.isArray(values) ? values : [];
  if (input.includes('*')) return '*';
  const out = new Set();
  for (const value of input) {
    const types = includeAliases ? componentTypeAliases(value) : [canonicalComponentType(value)];
    for (const type of types) {
      if (type) out.add(type);
    }
  }
  return [...out];
}

export function hasUnlockedComponent(unlocks, componentType) {
  if (unlocks === '*') return true;
  if (!Array.isArray(unlocks)) return false;
  if (unlocks.includes('*')) return true;
  const aliases = componentTypeAliases(componentType);
  return aliases.some((type) => unlocks.includes(type));
}
