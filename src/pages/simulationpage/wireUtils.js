import { buildWireRoutePoints } from '../../utils/wireRouting.js';
import { makeOrthogonal } from '../../utils/wireUtils.js';

function snapPointsToHalfPixel(pts) {
  return (pts || []).map(p => ({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2, _corner: p._corner }));
}

// ─── RENDER ROUNDED PATH FROM POINT ARRAY ─────────────────────────────────
export function renderRoundedPath(pts) {
  if (!pts || pts.length < 2) return '';
  const r = 6;
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

    // Parse Wokwi routing instructions (e.g. ["v10", "h-5", "*", "v5"])
    // Steps before * are relative to start. Steps after * are relative to end.
    let starIndex = routingInstructions.indexOf('*');
    
    // We scale by 1.5 since Wokwi grid was scaled by 1.5 in projectUtils.js
    const SCALE = 1.5; 

    if (starIndex === -1) {
      // Just step through continuously from p1
      for (const inst of routingInstructions) {
        if (inst.startsWith('v')) currentY += Number(inst.slice(1)) * SCALE;
        if (inst.startsWith('h')) currentX += Number(inst.slice(1)) * SCALE;
        pts.push({ x: currentX, y: currentY });
      }
      pts.push(p2);
    } else {
      // Steps from source (p1)
      for (let i = 0; i < starIndex; i++) {
        const inst = routingInstructions[i];
        if (inst.startsWith('v')) currentY += Number(inst.slice(1)) * SCALE;
        if (inst.startsWith('h')) currentX += Number(inst.slice(1)) * SCALE;
        pts.push({ x: currentX, y: currentY });
      }

      // Steps backwards from destination (p2).
      // Wokwi "after star" instructions are offsets backwards from the destination.
      let endX = p2.x;
      let endY = p2.y;
      const endPtsBackwards = [{ x: endX, y: endY }];
      
      // To correctly apply backwards instructions: Wokwi goes backwards starting from the target.
      // E.g. "h10" after "*" means the point before the end is 10px to the left of the end.
      // Wait, Wokwi format: the instructions are just sequential, 
      // but read backwards from the target.
      for (let i = routingInstructions.length - 1; i > starIndex; i--) {
        const inst = routingInstructions[i];
        if (inst.startsWith('v')) endY -= Number(inst.slice(1)) * SCALE;
        if (inst.startsWith('h')) endX -= Number(inst.slice(1)) * SCALE;
        endPtsBackwards.unshift({ x: endX, y: endY });
      }

      // Add the bridging connection
      if (endPtsBackwards.length > 0) {
         // Auto-route between current point and the start of the end sequence
         const joinPt = endPtsBackwards[0];
         
         // Simple 1-step L-shape routing
         const dx = joinPt.x - currentX;
         const dy = joinPt.y - currentY;
         
         if (Math.abs(dx) > 0.1 && Math.abs(dy) > 0.1) {
             const prevInst = starIndex > 0 ? routingInstructions[starIndex - 1] : '';
             if (prevInst.startsWith('h')) {
                 // We moved horizontally last, so move vertically first
                 pts.push({ x: currentX, y: joinPt.y });
             } else {
                 pts.push({ x: joinPt.x, y: currentY });
             }
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
    pts = pts.filter((pt, i, arr) => i === 0 || Math.abs(pt.x - arr[i - 1].x) > 0.1 || Math.abs(pt.y - arr[i - 1].y) > 0.1);
    if (numericOffset !== 0 && pts.length > 2) {
      const newPts = [p1];
      for (let i = 1; i < pts.length - 1; i++) {
        newPts.push({ x: pts[i].x + numericOffset, y: pts[i].y + numericOffset });
      }
      newPts.push(p2);
      return snapPointsToHalfPixel(makeOrthogonal(newPts));
    }
    return snapPointsToHalfPixel(makeOrthogonal(pts));
  }
  const pts = buildWireRoutePoints(p1, e1, e2, p2, waypoints, offset);
  return snapPointsToHalfPixel(makeOrthogonal(pts));
}


// ─── BUILD FULL WIRE PATH STRING ───────────────────────────────────────────

export function buildWirePath(p1, e1, e2, p2, waypoints = [], pathOverride = null, offset = 0, routingInstructions = []) {
  const rawPts = Array.isArray(pathOverride) && pathOverride.length > 1
    ? pathOverride
    : computeWireOrthoPoints(p1, e1, e2, p2, waypoints, offset, routingInstructions);
  const pts = snapPointsToHalfPixel(makeOrthogonal(rawPts));
  return renderRoundedPath(pts);
}

// ─── GET WIRE POINTS FOR DRAGGING ──────────────────────────────────────────
export function getWirePoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  const pts = computeWireOrthoPoints(p1, e1, e2, p2, waypoints, offset);
  return snapPointsToHalfPixel(makeOrthogonal(pts));
}

// ─── PREVIEW WIRE ROUTER (Drawing mode) ───────────────────────────────────
export function multiRoutePath(p1, p2, waypoints = []) {
  if (!p1 || !p2) return '';
  const hints = [p1, ...waypoints, p2];
  const pts = [];
  for (let i = 0; i < hints.length - 1; i++) {
    const a = hints[i], b = hints[i + 1];
    if (i === 0) pts.push(a);
    const midX = Math.round(((a.x + b.x) / 2) / 15) * 15;
    pts.push({ x: midX, y: a.y });
    pts.push({ x: midX, y: b.y });
    pts.push(b);
  }
  return renderRoundedPath(makeOrthogonal(pts));
}

// ─── AUTOMATED WIRE COLORING LOGIC ────────────────────────────────────────
export function wireColor(pinLabel) {
  if (!pinLabel) return '#2ecc71';
  const l = pinLabel.toUpperCase();

  // Power & Ground (Highest priority)
  if (l === 'GND' || l.includes('.GND') || l.includes('_GND') || l === 'VSS' || l === 'CATHODE' || l === 'COM') return '#1f2937'; 
  if (l === 'VCC' || l === 'VDD' || l === '5V' || l === '3V3' || l === '3.3V' || l === 'VIN' || l === 'ANODE' || l === 'V+') return '#ef4444'; 

  // UART
  if (l.includes('RX')) return '#f97316'; // Orange
  if (l.includes('TX')) return '#ea580c'; // Deep Orange

  // I2C
  if (l.includes('SDA')) return '#3b82f6'; // Blue
  if (l.includes('SCL')) return '#eab308'; // Yellow/Amber

  // SPI - Specific Signal Separation
  if (l.includes('MOSI') || l.includes('DIN') || l.includes('SDI')) return '#8b5cf6'; // Violet
  if (l.includes('MISO') || l.includes('DOUT') || l.includes('SDO')) return '#d946ef'; // Fuchsia
  if (l === 'SCK') return '#6366f1';  // Indigo
  if (l.includes('SCLK') || l.includes('CLK')) return '#4f46e5'; // Deep Indigo
  if (l === 'CS') return '#ec4899';   // Pink
  if (l.includes('SS') || l.includes('SCE')) return '#be185d';  // Deep Pink/Maroon

  // Analog
  if ((l.startsWith('A') && !isNaN(l.substring(1))) || l.includes('ANALOG') || l.includes('ADC')) return '#10b981'; // Emerald

  // PWM / Special
  if (l.includes('PWM') || l.includes('~') || l.includes('EN')) return '#06b6d4'; // Cyan

  return '#2ecc71'; // Default Green
}
