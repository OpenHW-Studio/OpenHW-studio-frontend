import { buildWireRoutePoints } from '../../utils/wireRouting.js';

// ─── RENDER ROUNDED PATH FROM POINT ARRAY ─────────────────────────────────
export function renderRoundedPath(pts) {
  if (!pts || pts.length < 2) return '';
  const r = 10;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
    const distPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const distNext = Math.hypot(next.x - curr.x, next.y - curr.y);
    const cornerR = Math.min(r, distPrev / 2, distNext / 2);
    if (cornerR < 0.5) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }
    const ps = { x: curr.x + (prev.x - curr.x) * (cornerR / distPrev), y: curr.y + (prev.y - curr.y) * (cornerR / distPrev) };
    const pe = { x: curr.x + (next.x - curr.x) * (cornerR / distNext), y: curr.y + (next.y - curr.y) * (cornerR / distNext) };
    d += ` L ${ps.x} ${ps.y} Q ${curr.x} ${curr.y} ${pe.x} ${pe.y}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// ─── COMPUTE ORTHOGONAL WIRE CORNER POINTS ─────────────────────────────────
export function computeWireOrthoPoints(p1, e1, e2, p2, waypoints = [], offset = 0, routingInstructions = []) {
  if (routingInstructions && routingInstructions.length > 0) {
    let currentX = p1.x;
    let currentY = p1.y;
    const pts = [{ x: currentX, y: currentY }];
    let starIndex = routingInstructions.indexOf('*');
    const SCALE = 1.5; 

    if (starIndex === -1) {
      for (const inst of routingInstructions) {
        if (inst.startsWith('v')) currentY += Number(inst.slice(1)) * SCALE;
        if (inst.startsWith('h')) currentX += Number(inst.slice(1)) * SCALE;
        pts.push({ x: currentX, y: currentY });
      }
      pts.push(p2);
    } else {
      for (let i = 0; i < starIndex; i++) {
        const inst = routingInstructions[i];
        if (inst.startsWith('v')) currentY += Number(inst.slice(1)) * SCALE;
        if (inst.startsWith('h')) currentX += Number(inst.slice(1)) * SCALE;
        pts.push({ x: currentX, y: currentY });
      }

      let endX = p2.x;
      let endY = p2.y;
      const endPtsBackwards = [{ x: endX, y: endY }];
      
      for (let i = routingInstructions.length - 1; i > starIndex; i--) {
        const inst = routingInstructions[i];
        if (inst.startsWith('v')) endY -= Number(inst.slice(1)) * SCALE;
        if (inst.startsWith('h')) endX -= Number(inst.slice(1)) * SCALE;
        endPtsBackwards.unshift({ x: endX, y: endY });
      }

      if (endPtsBackwards.length > 0) {
         const joinPt = endPtsBackwards[0];
         const dx = joinPt.x - currentX;
         const dy = joinPt.y - currentY;
         
         if (Math.abs(dx) > 0.1 && Math.abs(dy) > 0.1) {
             const prevInst = starIndex > 0 ? routingInstructions[starIndex - 1] : '';
             if (prevInst.startsWith('h')) pts.push({ x: currentX, y: joinPt.y });
             else pts.push({ x: joinPt.x, y: currentY });
         }
         pts.push(...endPtsBackwards);
      } else {
         pts.push(p2);
      }
    }
    return snapPointsToHalfPixel(makeOrthogonal(pts));
  }

  const numericOffset = typeof offset === 'object' && offset !== null ? (Number(offset.offset) || 0) : (Number(offset) || 0);

  if (waypoints.length > 0 && waypoints[0]?._corner) {
    let pts = [p1, ...waypoints, p2];
    pts = pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
    if (numericOffset !== 0 && pts.length > 2) {
      const newPts = [p1];
      for (let i = 1; i < pts.length - 1; i++) {
        newPts.push({ x: pts[i].x + numericOffset, y: pts[i].y + numericOffset });
      }
      newPts.push(p2);
      return newPts;
    }
    return pts;
  }
  return buildWireRoutePoints(p1, e1, e2, p2, waypoints, offset);
}

// ─── SINGLE SOURCE OF TRUTH: full orthogonal point list for any wire mode ──
export function getWirePoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  const numericOffset = typeof offset === 'object' && offset !== null ? (Number(offset.offset) || 0) : (Number(offset) || 0);

  if (waypoints.length > 0 && waypoints[0]?._corner) {
    let pts = [p1, ...waypoints, p2];
    pts = pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
    if (numericOffset !== 0 && pts.length > 2) {
      const newPts = [p1];
      for (let i = 1; i < pts.length - 1; i++) {
        newPts.push({ x: pts[i].x + numericOffset, y: pts[i].y + numericOffset });
      }
      newPts.push(p2);
      return newPts;
    }
    return pts;
  }

  if (waypoints.length > 0) {
    const hints = [e1, ...waypoints, e2];
    let pts = [p1];
    for (let i = 0; i < hints.length - 1; i++) {
      const a = hints[i], b = hints[i + 1];
      pts.push(a);
      const midX = (a.x + b.x) / 2;
      pts.push({ x: midX, y: a.y });
      pts.push({ x: midX, y: b.y });
    }
    pts.push(e2, p2);
    return pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  }

  return computeWireOrthoPoints(p1, e1, e2, p2, [], offset);
}

// Preview wire while drawing
export function multiRoutePath(p1, p2, waypoints = []) {
  if (!p1 || !p2) return '';
  const hints = [p1, ...waypoints, p2];
  let pts = [];
  for (let i = 0; i < hints.length - 1; i++) {
    const a = hints[i], b = hints[i + 1];
    if (i === 0) pts.push(a);
    const midX = (a.x + b.x) / 2;
    pts.push({ x: midX, y: a.y });
    pts.push({ x: midX, y: b.y });
    pts.push(b);
  }
  pts = pts.filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x || pt.y !== arr[i - 1].y);
  return renderRoundedPath(pts);
}

// Builds the SVG path string for a placed wire.
export function buildWirePath(p1, e1, e2, p2, waypoints = [], pathOverride = null, offset = 0, routingInstructions = []) {
  if (routingInstructions && routingInstructions.length > 0) {
    const pts = computeWireOrthoPoints(p1, e1, e2, p2, waypoints, offset, routingInstructions);
    return renderRoundedPath(pts);
  }

  const pts = Array.isArray(pathOverride) && pathOverride.length > 1
    ? pathOverride
    : getWirePoints(p1, e1, e2, p2, waypoints, offset);
  return renderRoundedPath(pts);
}

export function wireColor(pinLabel) {
  if (!pinLabel) return '#2ecc71';
  const l = pinLabel.toUpperCase();
  if (l.includes('GND') || l === 'CATHODE') return '#808080';
  if (l.includes('5V') || l.includes('3.3V') || l === 'VCC' || l === 'ANODE') return '#e74c3c';
  return '#2ecc71';
}
