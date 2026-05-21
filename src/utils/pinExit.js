const VALID_EXIT_SIDES = new Set(['left', 'right', 'top', 'bottom']);
const PIN_EXIT_CACHE = new Map();

function normalizePinId(id) {
  return String(id || '').toLowerCase().replace(/[:.]/g, '_');
}

function normalizeExitSide(value) {
  const side = String(value || '').toLowerCase();
  return VALID_EXIT_SIDES.has(side) ? side : null;
}

function findGroup(groups, value, tolerance) {
  for (const group of groups) {
    if (Math.abs(group.center - value) <= tolerance) {
      return group;
    }
  }
  return null;
}

function buildAxisGroups(pins, axis, tolerance) {
  const groups = [];
  const sorted = [...pins].sort((a, b) => a[axis] - b[axis] || a.otherAxis - b.otherAxis);

  for (const pin of sorted) {
    const value = pin[axis];
    let group = findGroup(groups, value, tolerance);
    if (!group) {
      group = { center: value, pins: [] };
      groups.push(group);
    }
    group.pins.push(pin);
    group.center = group.pins.reduce((sum, item) => sum + item[axis], 0) / group.pins.length;
  }

  return groups.filter(group => group.pins.length > 1);
}

function chooseNearestEdge(pin, bounds) {
  const bx = Number(bounds?.x) || 0;
  const by = Number(bounds?.y) || 0;
  const bw = Number(bounds?.w) || 0;
  const bh = Number(bounds?.h) || 0;
  const localX = (Number(pin.x) || 0) - bx;
  const localY = (Number(pin.y) || 0) - by;
  const dTop = localY;
  const dBottom = bh - localY;
  const dLeft = localX;
  const dRight = bw - localX;
  const minDist = Math.min(dTop, dBottom, dLeft, dRight);
  if (minDist === dTop) return 'top';
  if (minDist === dBottom) return 'bottom';
  if (minDist === dRight) return 'right';
  return 'left';
}

function getNearestEdgeInfo(pin, bounds) {
  const bx = Number(bounds?.x) || 0;
  const by = Number(bounds?.y) || 0;
  const bw = Number(bounds?.w) || 0;
  const bh = Number(bounds?.h) || 0;
  const localX = (Number(pin.x) || 0) - bx;
  const localY = (Number(pin.y) || 0) - by;
  const dTop = localY;
  const dBottom = bh - localY;
  const dLeft = localX;
  const dRight = bw - localX;
  const minDist = Math.min(dTop, dBottom, dLeft, dRight);
  let side = 'left';
  if (minDist === dTop) side = 'top';
  else if (minDist === dBottom) side = 'bottom';
  else if (minDist === dRight) side = 'right';
  return { side, minDist, dTop, dBottom, dLeft, dRight, localX, localY };
}

function getSideDistance(pin, bounds, side) {
  const info = getNearestEdgeInfo(pin, bounds);
  if (side === 'top') return info.dTop;
  if (side === 'bottom') return info.dBottom;
  if (side === 'left') return info.dLeft;
  if (side === 'right') return info.dRight;
  return info.minDist;
}

function buildExitLookup(compType, pins, bounds) {
  const compW = Number(bounds?.w) || 0;
  const compH = Number(bounds?.h) || 0;
  // Include component dimensions in cache key so per-instance bounds
  // (scaling / custom sizes) don't reuse a lookup built for a different size.
  const keyX = Math.round(Number(bounds?.x) || 0);
  const keyY = Math.round(Number(bounds?.y) || 0);
  const keyW = Math.round(compW);
  const keyH = Math.round(compH);
  const cacheKey = `${compType || '__unknown__'}::${keyX},${keyY},${keyW}x${keyH}`;
  const cached = PIN_EXIT_CACHE.get(cacheKey);
  if (cached) return cached;

  const lookup = new Map();
  const bx = Number(bounds?.x) || 0;
  const by = Number(bounds?.y) || 0;
  const normalizedPins = (pins || [])
    .map(pin => ({
      ...pin,
      normalizedId: normalizePinId(pin.id),
      exitSide: normalizeExitSide(pin.exit),
      x: (Number(pin.x) || 0) - bx,
      y: (Number(pin.y) || 0) - by,
      otherAxis: 0,
    }))
    .filter(pin => pin.normalizedId);

  for (const pin of normalizedPins) {
    if (pin.exitSide) {
      lookup.set(pin.normalizedId, pin.exitSide);
    }
  }

  const unresolved = normalizedPins.filter(pin => !lookup.has(pin.normalizedId));
  if (unresolved.length === 0) {
    PIN_EXIT_CACHE.set(cacheKey, lookup);
    return lookup;
  }

  // Nearest-edge is now a fallback only. Grouping gets first chance to decide.
  const sizeMin = Math.max(1, Math.min(compW || 0, compH || 0));
  const nearestThreshold = Math.max(4, Math.round(sizeMin * 0.035));
  const tolerance = Math.max(2, Math.min(compW || 0, compH || 0) * 0.015);
  const rowGroups = buildAxisGroups(unresolved, 'y', tolerance);
  const colGroups = buildAxisGroups(unresolved, 'x', tolerance);
  const candidates = new Map();

  const addCandidate = (pin, side, score) => {
    if (!candidates.has(pin.normalizedId)) {
      candidates.set(pin.normalizedId, []);
    }
    candidates.get(pin.normalizedId).push({ side, score });
  };

  for (const group of rowGroups) {
    const side = group.center <= compH / 2 ? 'top' : 'bottom';
    for (const pin of group.pins) {
      addCandidate(pin, side, getSideDistance(pin, bounds, side) + group.pins.length * 0.01);
    }
  }

  for (const group of colGroups) {
    const side = group.center <= compW / 2 ? 'left' : 'right';
    for (const pin of group.pins) {
      addCandidate(pin, side, getSideDistance(pin, bounds, side) + group.pins.length * 0.01);
    }
  }

  for (const pin of unresolved) {
    const pinCandidates = candidates.get(pin.normalizedId) || [];
    if (pinCandidates.length > 0) {
      pinCandidates.sort((a, b) => a.score - b.score);
      lookup.set(pin.normalizedId, pinCandidates[0].side);
      continue;
    }
    const near = getNearestEdgeInfo(pin, bounds);
    if (near.minDist <= nearestThreshold) {
      lookup.set(pin.normalizedId, near.side);
      try { console.debug('[pinExit] nearest-edge fallback', pin.normalizedId, near); } catch (e) {}
      continue;
    }
    lookup.set(pin.normalizedId, chooseNearestEdge(pin, bounds));
  }

  PIN_EXIT_CACHE.set(cacheKey, lookup);
  return lookup;
}

export function getResolvedPinExitSide(comp, pin, pins, bounds = null) {
  if (!comp || !pin) return null;
  const lookup = buildExitLookup(comp.type, pins, bounds || { x: 0, y: 0, w: Number(comp.w) || 0, h: Number(comp.h) || 0 });
  return lookup.get(normalizePinId(pin.id)) || chooseNearestEdge(pin, bounds || { x: 0, y: 0, w: Number(comp.w) || 0, h: Number(comp.h) || 0 });
}
