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
  // Hide ESP32 (openhw-esp32, wokwi-esp32, esp32)
  'openhw-esp32': {
    hide: true,
  },
  'wokwi-esp32': {
    hide: true,
  },
  'esp32': {
    hide: true,
  },

  // Warn ESP32-CAM (openhw-esp32-cam, wokwi-esp32-cam, esp32-cam)
  'openhw-esp32-cam': {
    warning: 'ESP32-CAM simulation is currently not working.',
  },
  'wokwi-esp32-cam': {
    warning: 'ESP32-CAM simulation is currently not working.',
  },
  'esp32-cam': {
    warning: 'ESP32-CAM simulation is currently not working.',
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
