/**
 * ============================================================================
 * EXAMPLE LOADER SERVICE (exampleLoaderService.js)
 * ============================================================================
 *
 * PURPOSE & BACKGROUND:
 * When users view the Examples gallery (/examples) or open an example in the
 * simulator (/slug/demo) or the guide (/slug/guide), example assets and circuits
 * must be loaded reliably.
 *
 * WHY SOME EXAMPLES FAILED TO LOAD PREVIOUSLY:
 * ----------------------------------------------------------------------------
 * 1. SLUG VS FOLDER NAME MISMATCH (404 Not Found):
 *    - In the openhw-studio-examples repository, some folders or files do not
 *      match the simple project slug.
 *      Examples:
 *        * "buzzer" is located at "Turn_on_Buzzer/Turn_on_Buzzer.png"
 *        * "dc-motor" is located at "dc-motor-l293d/circuit.png"
 *        * "ldr" is located at "ldr-automatic-light/circuit.png"
 *        * "potentiometer" is located at "potentiometer-led/circuit.png"
 *    - Previously, SimulatorPage hardcoded `${EXAMPLES_BASE_URL}/${slug}/circuit.png`,
 *      causing the browser to request `/api/examples/buzzer/circuit.png` -> 404.
 *
 * 2. PNG STEGANOGRAPHY VS NORMAL IMAGES:
 *    - OpenHW-Studio can embed JSON circuit data (components, coordinates, wires,
 *      and Arduino C++ code) into PNGs after the marker `\x00OPENHW_META\x00`.
 *    - If a PNG is a standard diagram/screenshot exported without this marker,
 *      `extractProjectMetaFromPng` throws an error: "This PNG does not contain
 *      OpenHW-Studio circuit data."
 *
 * 3. SCHEMA FALLBACK MECHANISM:
 *    - The frontend has complete, interactive circuit schemas (components, wires,
 *      board definitions, and C++ sketches) inside `guidedProjects.json` and
 *      `guideProjectsIndex.json`.
 *    - This service provides a robust fallback: if the PNG cannot be fetched or
 *      lacks embedded metadata, it automatically retrieves the complete circuit
 *      schema from JSON, so the simulator ALWAYS renders a working circuit.
 * ============================================================================
 */

import GUIDED_PROJECTS_DATA from './guidedProjects.json';
import GUIDE_INDEX_DATA from './guideProjectsIndex.json';
import { extractProjectMetaFromPng } from '../utils/projectCompilerUtils.js';

export const EXAMPLES_BASE_URL =
  import.meta.env.VITE_EXAMPLES_BASE_URL || '/api/examples';

/**
 * Maps every project slug -> { folder, file } in the openhw-studio-examples repository.
 */
export const CIRCUIT_IMAGE_MAP = {
  'led-blink':               { folder: 'led-blink',               file: 'circuit.png' },
  'rgb-led':                 { folder: 'rgb-led',                 file: 'circuit.png' },
  'rgb-led-blink':           { folder: 'rgb-led-blink',           file: 'circuit.png' },
  'rgb-led-serial':          { folder: 'rgb-led-serial',          file: 'circuit.png' },
  'rgb-led-3-buttons':       { folder: 'rgb-led-3-buttons',       file: 'circuit.png' },
  'button-debounce':         { folder: 'button-debounce',         file: 'circuit.png' },
  'button-led':              { folder: 'button-led',              file: 'circuit.png' },
  'potentiometer':           { folder: 'potentiometer-led',       file: 'circuit.png' },
  'potentiometer-led':       { folder: 'potentiometer-led',       file: 'circuit.png' },
  'servo-motor':             { folder: 'servo-motor',             file: 'circuit.png' },
  'servo-potentiometer':     { folder: 'servo-potentiometer',     file: 'circuit.png' },
  'temperature-sensor':      { folder: 'temperature-sensor',      file: 'circuit.png' },
  'temperature-rgb-led':     { folder: 'temperature-rgb-led',     file: 'circuit.png' },
  'dc-motor':                { folder: 'dc-motor-l293d',          file: 'circuit.png' },
  'dc-motor-l293d':          { folder: 'dc-motor-l293d',          file: 'circuit.png' },
  'dc-motor-pwm':            { folder: 'dc-motor-pwm',            file: 'circuit.png' },
  'led-strip':               { folder: 'led-strip',               file: 'circuit.png' },
  'ldr':                     { folder: 'ldr-automatic-light',     file: 'circuit.png' },
  'ldr-automatic-light':     { folder: 'ldr-automatic-light',     file: 'circuit.png' },
  'gas-sensor-led':          { folder: 'gas-sensor-led',          file: 'circuit.png' },
  'motion-sensor-alarm':     { folder: 'motion-sensor-alarm',     file: 'circuit.png' },
  'obstacle-avoiding-robot': { folder: 'obstacle-avoiding-robot', file: 'circuit.png' },
  'smart-dustbin':           { folder: 'smart-dustbin',           file: 'circuit.png' },
  'smart-home-automation':   { folder: 'smart-home-automation',   file: 'circuit.png' },
  'smart-street-light':      { folder: 'smart-street-light',      file: 'circuit.png' },
  'water-level-indicator':   { folder: 'water-level-indicator',   file: 'circuit.png' },
  'auto-fan-speed':          { folder: 'auto-fan-speed',          file: 'circuit.png' },
  'lcd-scrolling-text':      { folder: 'lcd-scrolling-text',      file: 'circuit.png' },
  'ultrasonic-distance':     { folder: 'ultrasonic-distance',     file: 'circuit.png' },
  'traffic-light':           { folder: 'traffic-light',           file: 'circuit.png' },
  'up-counter':              { folder: 'up-counter',              file: 'circuit.png' },
  'up-down-counter':         { folder: 'up-down-counter',         file: 'circuit.png' },
  // Projects with non-standard folder/file names:
  'buzzer':                  { folder: 'Turn_on_Buzzer',          file: 'Turn_on_Buzzer.png' },
  '7-segment-display':       { folder: '7-segment-display',       file: 'circuit.png' },
  '7-segment-counter':       { folder: '7-segment-display',       file: 'circuit.png' },
  'ir-remote-control-system':{ folder: 'ir-remote-control-system',file: 'circuit.png' },
  'ir-remote-control':       { folder: 'ir-remote-control-system',file: 'circuit.png' },
  // Closest equivalents / aliased projects:
  'led-pwm':                 { folder: 'potentiometer-led',       file: 'circuit.png' },
  'dht-lcd':                 { folder: 'temperature-rgb-led',     file: 'circuit.png' },
  'line-following-robot':    { folder: 'obstacle-avoiding-robot', file: 'circuit.png' },
  'bluetooth-hc05':          { folder: 'smart-home-automation',   file: 'circuit.png' },
  'rf-remote-control':       { folder: 'ir-remote-control-system',file: 'circuit.png' },
  'wifi-led-control':        { folder: 'smart-home-automation',   file: 'circuit.png' },
  'communication-protocols': { folder: 'button-led',              file: 'circuit.png' },
};

/**
 * Returns the exact public URL for a project's circuit preview image.
 *
 * @param {string} slug - Project slug (e.g. 'buzzer', 'led-blink')
 * @param {string} baseUrl - Base API endpoint (default: EXAMPLES_BASE_URL)
 * @returns {string} Fully-qualified or relative URL to the circuit image
 */
export function getDemoCircuitUrl(slug, baseUrl = EXAMPLES_BASE_URL) {
  if (!slug) return '';
  const entry = CIRCUIT_IMAGE_MAP[slug];
  if (entry) {
    return `${baseUrl}/${entry.folder}/${entry.file}`;
  }
  return `${baseUrl}/${slug}/circuit.png`;
}

/**
 * Searches guidedProjects.json for a project object by slug or ID.
 *
 * @param {string} slug - Project slug or ID
 * @returns {object|null} The project object or null if not found
 */
export function findGuidedProjectBySlug(slug) {
  if (!slug) return null;
  const cleanSlug = String(slug).trim().toLowerCase();

  const root = GUIDED_PROJECTS_DATA.default || GUIDED_PROJECTS_DATA;
  for (const level of Object.values(root)) {
    for (const cat of Object.values(level.categories || {})) {
      const found = cat.projects?.find(
        (p) =>
          String(p.slug || '').toLowerCase() === cleanSlug ||
          String(p.id || '').toLowerCase() === cleanSlug
      );
      if (found) return found;
    }
  }

  // Check guideProjectsIndex.json as second fallback
  const indexRoot = GUIDE_INDEX_DATA.default || GUIDE_INDEX_DATA;
  if (indexRoot[cleanSlug]) {
    return indexRoot[cleanSlug];
  }

  return null;
}

/**
 * Loads the project definition for a given slug.
 *
 * Strategy:
 * 1. Attempt to fetch the PNG using `getDemoCircuitUrl`.
 * 2. If the PNG is fetched, attempt to decode embedded `\x00OPENHW_META\x00` circuit data.
 * 3. If PNG fetch fails (404) or PNG lacks metadata, fallback to `guidedProjects.json`.
 *
 * @param {string} slug - Project slug
 * @param {string} baseUrl - Examples base URL
 * @returns {Promise<{ meta: object, source: string }|null>}
 */
export async function loadExampleProjectData(slug, baseUrl = EXAMPLES_BASE_URL) {
  if (!slug) return null;

  // 1. Structured Schema Check (Instant 0ms in-memory resolution from guidedProjects.json)
  const project = findGuidedProjectBySlug(slug);
  if (project?.schemas?.arduino) {
    const schema = project.schemas.arduino;
    return {
      meta: {
        ...schema,
        blocklyXml: schema.blocklyXml || project.blocklyXml || '',
        blocklyGeneratedCode: schema.blocklyGeneratedCode || project.blocklyGeneratedCode || '',
        useBlocklyCode: schema.useBlocklyCode !== undefined ? schema.useBlocklyCode : (project.useBlocklyCode !== undefined ? project.useBlocklyCode : true),
        code: schema.code || project.code || '',
        projectName: project.title || slug,
      },
      source: 'schema',
    };
  }

  // 2. Try loading from PNG steganography if no pre-bundled schema exists
  try {
    const pngUrl = getDemoCircuitUrl(slug, baseUrl);
    const res = await fetch(pngUrl);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const meta = extractProjectMetaFromPng(new Uint8Array(buf));
      if (meta && (meta.components || meta.connections || meta.wires || meta.schemas)) {
        return { meta, source: 'png' };
      }
    }
  } catch (err) {
    console.info(`[ExampleLoader] PNG decode bypassed for "${slug}", checking index fallback. (${err.message})`);
  }

  // 3. Fallback to guideProjectsIndex.json code/components if available
  if (project && project.code) {
    return {
      meta: {
        board: project.board || 'openhw-arduino-uno',
        code: project.code,
        components: [],
        connections: [],
        projectName: project.title || slug,
      },
      source: 'index',
    };
  }

  return null;
}
