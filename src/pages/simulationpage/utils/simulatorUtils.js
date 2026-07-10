export function resolveUiExport(exportsUI) {
  if (!exportsUI) return null;

  if (exportsUI.default && typeof exportsUI.default === 'function') return exportsUI.default;
  if (exportsUI.UI && typeof exportsUI.UI === 'function') return exportsUI.UI;

  const keys = Object.keys(exportsUI);
  const blocked = (k) => {
    const l = String(k).toLowerCase();
    return l.includes('contextmenu') || l === 'bounds' || l === 'contextmenuduringrun' || l === 'contextmenuonlyduringrun';
  };

  const fnKey = keys.find((k) => typeof exportsUI[k] === 'function' && !blocked(k));
  if (fnKey) return exportsUI[fnKey];

  const anyKey = keys.find((k) => !blocked(k));
  if (anyKey) return exportsUI[anyKey];

  return null;
}

export function extractCompileSummaryLines(stdoutText) {
  const text = String(stdoutText || '');
  if (!text.trim()) return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const summaryPatterns = [
    /^Sketch uses\s+/i,
    /^Global variables use\s+/i,
    /^Program\s+size\s*:/i,
    /^Flash\s*:/i,
    /^RAM\s*:/i,
    /\btext\s+data\s+bss\s+dec\s+hex\b/i,
    /^\d+\s+\d+\s+\d+\s+\d+\s+[0-9a-f]+\s+/i,
  ];

  const dedup = new Set();
  const out = [];
  lines.forEach((line) => {
    if (!summaryPatterns.some((pattern) => pattern.test(line))) return;
    if (dedup.has(line)) return;
    dedup.add(line);
    out.push(line);
  });

  return out.slice(0, 8);
}

export function formatRunDuration(secondsValue) {
  const totalSeconds = Math.max(0, Math.floor(Number(secondsValue || 0)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function normalizeHashValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;

  if (ArrayBuffer.isView(value)) {
    const len = Number(value.length || 0);
    return {
      kind: 'typed-array',
      length: len,
      preview: Array.from(value).slice(0, 24),
    };
  }

  if (Array.isArray(value)) {
    if (value.length > 64) {
      return {
        kind: 'array',
        length: value.length,
        preview: value.slice(0, 64).map((entry) => normalizeHashValue(entry, depth + 1)),
      };
    }
    return value.map((entry) => normalizeHashValue(entry, depth + 1));
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (depth > 4 && keys.length > 24) {
      return {
        kind: 'object',
        keys: keys.sort().slice(0, 24),
        size: keys.length,
      };
    }

    const out = {};
    keys
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        out[key] = normalizeHashValue(value[key], depth + 1);
      });
    return out;
  }

  return String(value);
}

export function fnv1aHash(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function computeRenderSyncHash(payload) {
  return fnv1aHash(JSON.stringify(normalizeHashValue(payload, 0)));
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function resolveComponentIdFormat(type) {
  const rawType = String(type || '').toLowerCase();

  if (rawType.includes('arduino') && rawType.includes('uno')) {
    return { prefix: 'uno', separator: '' };
  }
  if (rawType.includes('pico-w') || rawType.includes('picow')) {
    return { prefix: 'picow', separator: '' };
  }
  if (rawType.includes('rp2040') || rawType.includes('pico')) {
    return { prefix: 'pico', separator: '' };
  }

  let cleanType = rawType;
  if (cleanType.startsWith('openhw-')) {
    cleanType = cleanType.slice(7);
  } else if (cleanType.startsWith('wokwi-')) {
    cleanType = cleanType.slice(6);
  }

  const fallback = cleanType
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'component';

  return { prefix: fallback, separator: '_' };
}

export function allocateComponentId(type, usedIdsInput) {
  const usedIds = usedIdsInput instanceof Set
    ? usedIdsInput
    : new Set(Array.isArray(usedIdsInput) ? usedIdsInput : []);
  const { prefix, separator } = resolveComponentIdFormat(type);
  const pattern = new RegExp(`^${prefix}${separator}(\\d+)$`, 'i');

  let maxIndex = 0;
  usedIds.forEach((id) => {
    const match = String(id || '').match(pattern);
    if (!match) return;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      maxIndex = Math.max(maxIndex, parsed);
    }
  });

  let index = Math.max(1, maxIndex + 1);
  let candidate = `${prefix}${separator}${index}`;
  while (usedIds.has(candidate)) {
    index += 1;
    candidate = `${prefix}${separator}${index}`;
  }

  usedIds.add(candidate);
  return candidate;
}

export function toPascalCase(value) {
  const safe = String(value || 'component');
  return safe
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, c => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '') || 'Component';
}

export function extractFunctionSource(fn) {
  if (typeof fn !== 'function') return '';
  try {
    let src = String(fn).trim();
    src = src.replace(/\b_s\s*\([^)]*\);?/g, '');
    src = src.replace(/\$RefreshSig\$\s*\([^)]*\)/g, '(() => {})');
    src = src.replace(/\$RefreshReg\$\s*\([^)]*\);?/g, '');
    return src.trim();
  } catch (e) {
    return '';
  }
}
