let nextIdRef = { value: 1 };
let nextWireIdRef = { value: 1 };

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

export function syncNextIds(comps, ws, setNextId, setNextWireId) {
  for (const c of (comps || [])) {
    const m = c.id && c.id.match(/_(\d+)$/);
    if (m) nextIdRef.value = Math.max(nextIdRef.value, parseInt(m[1], 10) + 1);
  }
  for (const w of (ws || [])) {
    const m = w.id && w.id.match(/^w(\d+)$/);
    if (m) nextWireIdRef.value = Math.max(nextWireIdRef.value, parseInt(m[1], 10) + 1);
  }

  if (typeof setNextId === 'function') setNextId(nextIdRef.value);
  if (typeof setNextWireId === 'function') setNextWireId(nextWireIdRef.value);
}

export function idCounters() {
  return {
    get nextId() {
      return nextIdRef.value;
    },
    set nextId(v) {
      nextIdRef.value = v;
    },
    get nextWireId() {
      return nextWireIdRef.value;
    },
    set nextWireId(v) {
      nextWireIdRef.value = v;
    },
  };
}
