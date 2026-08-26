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
  'openhw-esp32': { hide: true },
  'openhw-esp32-cam': { hide: true },
  'openhw-arduino-nano': { hide: true },
  'openhw-arduino-mega': { hide: true },
  'openhw-attiny85': { hide: true },
  'openhw-stm32-blue-pill (frontend)': { hide: true },

  // Audio Components
  'openhw-sph0645': { hide: true },
  'openhw-pcm5102': { hide: true },
  'openhw-max98357': { hide: true },
  'openhw-inmp441': { hide: true },
  'openhw-5w-speaker': { hide: true },
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
