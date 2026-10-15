const _exportShadowSheetCache = new WeakMap();
let _babelMod = null;
let _h2cMod = null;
let _jszipMod = null;
let _exportLogoPromise = null;

export const getBabel = async () => {
  if (!_babelMod) _babelMod = await import('@babel/standalone');
  return _babelMod;
};

export const getHtml2canvas = async () => {
  if (!_h2cMod) _h2cMod = (await import('html2canvas')).default;
  return _h2cMod;
};

// Perf (bundle-split): jszip loaded on demand (project save/load, Wokwi ZIP
// import, component ZIP upload). Previously statically imported by 4 modules
// in the SimulatorPage chunk.
export const getJSZip = async () => {
  if (!_jszipMod) _jszipMod = (await import('jszip')).default;
  return _jszipMod;
};

// Sync access to the Babel module namespace once getBabel() has resolved.
// Returns null while still loading (callers must handle the loading state).
export const getBabelSync = () => _babelMod && (_babelMod.transform ? _babelMod : _babelMod.default ? { transform: (...a) => _babelMod.default.transform(...a) } : null);

export const ensureExportLogo = () => {
  if (!_exportLogoPromise) {
    _exportLogoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/logo-Photoroom.png';
    });
  }
  return _exportLogoPromise;
};

export function getSerializedShadowSheet(sheet) {
  if (!sheet) return '';
  if (_exportShadowSheetCache.has(sheet)) return _exportShadowSheetCache.get(sheet);
  let cssText = '';
  try {
    cssText = Array.from(sheet.cssRules || []).map(rule => rule.cssText).join('\n');
  } catch (error) {
    cssText = '';
  }
  _exportShadowSheetCache.set(sheet, cssText);
  return cssText;
}

export function cleanupEditCopyPayloadStorage(prefix) {
  const removeMatching = (storageLike) => {
    try {
      const keys = [];
      for (let i = 0; i < storageLike.length; i += 1) {
        const k = storageLike.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      keys.forEach((k) => storageLike.removeItem(k));
    } catch (_) {
      // Ignore storage access failures
    }
  };

  removeMatching(sessionStorage);
  removeMatching(localStorage);
}

export function writeEditCopyPayload(data, prefix, copyKey) {
  const serialized = JSON.stringify(data || {});
  const payloadKey = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const pointer = JSON.stringify({
    __openhwEditCopyPointer: true,
    version: 2,
    storage: 'session',
    key: payloadKey,
    createdAt: Date.now(),
  });

  const writePointerPayload = () => {
    sessionStorage.setItem(payloadKey, serialized);
    localStorage.setItem(copyKey, pointer);
  };

  try {
    writePointerPayload();
    return { ok: true };
  } catch (_) {
    // Fall through
  }

  try {
    localStorage.setItem(copyKey, serialized);
    return { ok: true };
  } catch (_) {
    // Fall through
  }

  cleanupEditCopyPayloadStorage(prefix);

  try {
    writePointerPayload();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
