/**
 * Guards dynamically-loaded component code against blocked browser APIs.
 * Extracted verbatim from SimulatorPage.jsx module scope (previously a
 * file-local function). Single canonical home — SimulatorPage.jsx and
 * useBackendComponentSync.js both import from here.
 */

const UNSAFE_DYNAMIC_CODE_PATTERN =
  /\b(?:importScripts|XMLHttpRequest|WebSocket|EventSource|SharedWorker|Worker|navigator\.sendBeacon|document\.cookie|localStorage|sessionStorage|indexedDB)\b|(?:\bfetch\s*\()|(?:\beval\s*\()|(?:\bnew\s+Function\b)/i;

export function assertSafeDynamicModule(code, label) {
  const cleanCode = String(code || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(?:^|[^:])\/\/[^\r\n]*/g, "")
    .replace(/'(?:[^'\\]|\\.)*'/g, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, "")
    .replace(/`(?:[^`\\]|\\.)*`/g, "");
  if (UNSAFE_DYNAMIC_CODE_PATTERN.test(cleanCode)) {
    throw new Error(`${label} uses blocked browser APIs in sandbox mode`);
  }
}
