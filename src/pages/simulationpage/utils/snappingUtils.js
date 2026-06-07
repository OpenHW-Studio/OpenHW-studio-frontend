import { COMPONENT_REGISTRY } from './componentRegistry';
import { getResolvedPinExitSide } from '../../../utils/pinExit.js';
import { computeWireOrthoPoints } from '../wireUtils';

// Snaps a coordinate value to the nearest multiple of size (default 15px)
export function snapToGrid(val, size = 15) {
  return Math.round(val / size) * size;
}

export function getComponentBounds(comp) {
  if (!comp) return { x: 0, y: 0, w: 0, h: 0 };
  const reg = COMPONENT_REGISTRY[comp.type];
  if (!reg) return { x: 0, y: 0, w: comp.w || 0, h: comp.h || 0 };
  if (typeof reg.BOUNDS === 'function') {
    return reg.BOUNDS(comp.attrs || {});
  }
  return reg.BOUNDS || { x: 0, y: 0, w: comp.w || 0, h: comp.h || 0 };
}

export function getPinPosForComp(comp, pinId, pinDefs) {
  if (!comp) return null;
  const pins = pinDefs[comp.type] || [];
  const searchId = String(pinId).toLowerCase();

  const normalize = (id) => {
    let s = String(id).toLowerCase();
    if (s === 'p1') return '1';
    if (s === 'p2') return '2';
    if (s === 'a') return 'anode';
    if (s === 'k') return 'cathode';
    if (s === '3.3v' || s === '3v3') return '3v3';
    return s.replace(/[:.]/g, '_');
  };

  const normSearch = normalize(searchId);

  let pin = pins.find(p => {
    const pid = String(p.id).toLowerCase();
    return pid === searchId || normalize(pid) === normSearch;
  });

  if (!pin) {
    pin = pins.find(p => {
      const pid = String(p.id).toLowerCase();
      const normPid = normalize(pid);
      return pid === searchId || normPid.startsWith(normSearch + '_') || normPid.startsWith(normSearch + '.') || pid.startsWith(searchId + '.') || pid.startsWith(searchId + '_');
    });
  }
  if (!pin) {
    return { x: comp.x + (comp.w || 40) / 2, y: comp.y + (comp.h || 40) / 2, isFallback: true };
  }
  const rotation = comp.rotation || 0;
  const cw = comp.w || 0;
  const ch = comp.h || 0;
  if (rotation === 0) return { x: comp.x + pin.x, y: comp.y + pin.y };

  const cx = cw / 2, cy = ch / 2;
  const rad = (rotation * Math.PI) / 180;
  const dx = pin.x - cx, dy = pin.y - cy;
  return {
    x: comp.x + cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: comp.y + cy + dx * Math.sin(rad) + dy * Math.cos(rad)
  };
}

export function getPinExitPointForComp(comp, pinId, pinDefs) {
  if (!comp) return null;
  const pins = pinDefs[comp.type] || [];
  const searchId = String(pinId).toLowerCase();

  const normalize = (id) => {
    let s = String(id).toLowerCase();
    if (s === 'p1') return '1';
    if (s === 'p2') return '2';
    if (s === 'a') return 'anode';
    if (s === 'k') return 'cathode';
    if (s === '3.3v' || s === '3v3') return '3v3';
    return s.replace(/[:.]/g, '_');
  };

  const normSearch = normalize(searchId);

  let pin = pins.find(p => {
    const pid = String(p.id).toLowerCase();
    return pid === searchId || normalize(pid) === normSearch;
  });

  if (!pin) {
    pin = pins.find(p => {
      const pid = String(p.id).toLowerCase();
      const normPid = normalize(pid);
      return pid === searchId || normPid.startsWith(normSearch + '_') || normPid.startsWith(normSearch + '.') || pid.startsWith(searchId + '.') || pid.startsWith(searchId + '_');
    });
  }

  if (!pin) {
    return { x: comp.x + (comp.w || 40) / 2, y: comp.y + (comp.h || 40) / 2, isFallback: true };
  }

  const pPos = getPinPosForComp(comp, pinId, pinDefs);
  if (!pPos) return null;

  const bounds = getComponentBounds(comp);
  const localX = (Number(pin.x) || 0) - (Number(bounds.x) || 0);
  const localY = (Number(pin.y) || 0) - (Number(bounds.y) || 0);
  const distLeft = localX;
  const distRight = (Number(bounds.w) || comp.w || 0) - localX;
  const distTop = localY;
  const distBottom = (Number(bounds.h) || comp.h || 0) - localY;
  const bodyEdgeGap = 3;
  const rotation = comp.rotation || 0;
  let dx = 0, dy = 0;

  const dir = getResolvedPinExitSide(comp, pin, pins, bounds);
  if (!dir) return { x: pPos.x, y: pPos.y, dir: 'bottom' };
  
  const MIN_EXIT_STUB = 30;
  if (dir === 'left') {
    dx = -(Math.max(distLeft + bodyEdgeGap, MIN_EXIT_STUB));
    dy = 0;
  } else if (dir === 'right') {
    dx = Math.max(distRight + bodyEdgeGap, MIN_EXIT_STUB);
    dy = 0;
  } else if (dir === 'top') {
    dx = 0;
    dy = -(Math.max(distTop + bodyEdgeGap, MIN_EXIT_STUB));
  } else if (dir === 'bottom') {
    dx = 0;
    dy = Math.max(distBottom + bodyEdgeGap, MIN_EXIT_STUB);
  }

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rawExitX = pPos.x + (dx * cos - dy * sin);
  const rawExitY = pPos.y + (dx * sin + dy * cos);

  let exitX = rawExitX;
  let exitY = rawExitY;
  if (Math.abs(rawExitX - pPos.x) < 0.1) {
    exitX = pPos.x;
    exitY = Math.round(rawExitY / 15) * 15;
  } else {
    exitX = Math.round(rawExitX / 15) * 15;
    exitY = pPos.y;
  }

  return {
    x: exitX,
    y: exitY,
    dir
  };
}

export function resolveWireWaypoints(wire, compMap, pinDefs) {
  if (!wire.from || !wire.to) return wire.waypoints || [];
  const [fromCompId, fromPinId] = wire.from.split(':');
  const [toCompId, toPinId] = wire.to.split(':');
  const fromComp = compMap.get(fromCompId);
  const toComp = compMap.get(toCompId);
  if (!fromComp || !toComp) return wire.waypoints || [];

  const p1 = getPinPosForComp(fromComp, fromPinId, pinDefs);
  const p2 = getPinPosForComp(toComp, toPinId, pinDefs);
  if (!p1 || !p2) return wire.waypoints || [];

  const e1 = getPinExitPointForComp(fromComp, fromPinId, pinDefs) || p1;
  const e2 = getPinExitPointForComp(toComp, toPinId, pinDefs) || p2;

  const pts = computeWireOrthoPoints(p1, e1, e2, p2, [], 0, wire.routingInstructions);
  if (pts.length > 2) {
    return pts.slice(1, -1).map(pt => ({ x: pt.x, y: pt.y, _corner: true }));
  }
  return [];
}

export function resolveAllWiresWaypoints(wires, components, pinDefs) {
  const compMap = new Map(components.map(c => [c.id, c]));
  return wires.map(wire => {
    if (Array.isArray(wire.routingInstructions) && wire.routingInstructions.length > 0) {
      const waypoints = resolveWireWaypoints(wire, compMap, pinDefs);
      return { ...wire, waypoints, routingInstructions: undefined };
    }
    return wire;
  });
}
