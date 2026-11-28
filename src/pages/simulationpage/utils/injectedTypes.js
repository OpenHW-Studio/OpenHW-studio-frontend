/**
 * Tracks component types dynamically injected from the backend (not built-in).
 * Extracted from SimulatorPage.jsx module scope so the backend-sync hook and
 * any future consumer share one canonical set.
 */
export const BACKEND_INJECTED_TYPES = new Set();
