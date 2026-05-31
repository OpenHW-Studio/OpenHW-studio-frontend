// Tuned spacing/tolerance for bundling (aligned to 15px grid)
const WIRE_SPACING = 15;
// How far along the trunk each wire's turn point is staggered per spacing step
const STAGGER_STEP = 15;
const OVERLAP_TOLERANCE = 4;

function dedupePoints(points) {
  const out = [];
  for (const pt of points || []) {
    if (!pt) continue;
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - pt.x) < 0.1 && Math.abs(last.y - pt.y) < 0.1) continue;
    out.push({ x: pt.x, y: pt.y });
  }
  return out;
}

function orthogonalizePair(a, b, horizontalFirst) {
  if (Math.abs(a.x - b.x) < 0.1 || Math.abs(a.y - b.y) < 0.1) return [a, b];
  if (horizontalFirst) {
    return [a, { x: b.x, y: a.y }, b];
  }
  return [a, { x: a.x, y: b.y }, b];
}

export function buildBaseRoutePoints(p1, e1, e2, p2, waypoints = [], offset = 0, respectExitSide = true) {
  if (!p1 || !e1 || !e2 || !p2) return [];

  const cleanedWaypoints = Array.isArray(waypoints) ? waypoints.filter(Boolean) : [];
  if (cleanedWaypoints.length > 0) {
    const pts = [p1, e1, ...cleanedWaypoints, e2, p2];
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const prev = out[out.length - 1];
      const curr = pts[i];
      const horizontalFirst = Math.abs(curr.x - prev.x) >= Math.abs(curr.y - prev.y);
      out.push(...orthogonalizePair(prev, curr, horizontalFirst).slice(1));
    }
    return dedupePoints(out);
  }

  const dx = e2.x - e1.x;
  const dy = e2.y - e1.y;
  const horizontalFirst = Math.abs(dx) >= Math.abs(dy);

  let route = [];

  if (!respectExitSide) {
    // SHORTEST DISTANCE FALLBACK
    let overallHorizontalFirst;
    if (Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y)) {
      // Side-by-side: always route horizontal out of the Left-most component
      overallHorizontalFirst = (p1.x < p2.x);
    } else {
      // Top-to-bottom: always route vertical out of the Top-most component
      overallHorizontalFirst = (p1.y > p2.y);
    }
    if (typeof offset === 'object' && offset !== null && (typeof offset.bundleMidX === 'number' || typeof offset.bundleMidY === 'number')) {
      const laneOffset = Number(offset.offset) || 0;
      if (overallHorizontalFirst) {
        // Side-by-side layout uses a Horizontal trunk. Wires drop vertically from pin to reach trunk.
        let trunkY = typeof offset.bundleMidY === 'number' ? offset.bundleMidY + laneOffset : p1.y + laneOffset;
        
        // Clamp trunkY away from the pin line using exit directions as boundary guides
        const e1Dir = offset.e1Dir || '';
        const e2Dir = offset.e2Dir || '';
        if (e1Dir === 'bottom' || e2Dir === 'bottom') {
          trunkY = Math.max(trunkY, p1.y + 15, p2.y + 15);
        } else if (e1Dir === 'top' || e2Dir === 'top') {
          trunkY = Math.min(trunkY, p1.y - 15, p2.y - 15);
        } else {
          // General fallback: if no vertical exit, just make sure we don't run exactly on the pin line
          if (Math.abs(trunkY - p1.y) < 10) trunkY += 15;
        }

        route = [p1, { x: p1.x, y: trunkY }, { x: p2.x, y: trunkY }, p2];
      } else {
        // Top-to-bottom layout uses a Vertical trunk. Wires go horizontally from pin to reach trunk.
        let trunkX = typeof offset.bundleMidX === 'number' ? offset.bundleMidX + laneOffset : p1.x + laneOffset;
        
        // Clamp trunkX away from the pin line using exit directions
        const e1Dir = offset.e1Dir || '';
        const e2Dir = offset.e2Dir || '';
        if (e1Dir === 'right' || e2Dir === 'right') {
          trunkX = Math.max(trunkX, p1.x + 15, p2.x + 15);
        } else if (e1Dir === 'left' || e2Dir === 'left') {
          trunkX = Math.min(trunkX, p1.x - 15, p2.x - 15);
        } else {
          if (Math.abs(trunkX - p1.x) < 10) trunkX += 15;
        }

        route = [p1, { x: trunkX, y: p1.y }, { x: trunkX, y: p2.y }, p2];
      }
      route = dedupePoints(route);
    } else {
      route = orthogonalizePair(p1, p2, overallHorizontalFirst);
    }
  } else {
    // === START: EXIT SIDE ROUTING ===
    let shift = 0, stagger = 0, stagger2 = 0;
    if (typeof offset === 'object' && offset !== null) {
      shift = Number(offset.offset) || 0;
      stagger = Number(offset.stagger) || 0;
      stagger2 = Number(offset.stagger2) || stagger;
    } else {
      shift = Number(offset) || 0;
      stagger = (WIRE_SPACING !== 0) ? (shift / WIRE_SPACING) * STAGGER_STEP : 0;
      stagger2 = stagger;
    }
    const laneOffset = shift;

    // Whether each exit stub goes horizontally or vertically from the pin
    const e1StubHoriz = Math.abs(e1.x - p1.x) >= Math.abs(e1.y - p1.y);
    const e2StubHoriz = Math.abs(e2.x - p2.x) >= Math.abs(e2.y - p2.y);

    // Helper to ensure we don't overlap the stub if forced to double back
    const getShiftX = (x, targetX, stg) => {
      if (Math.abs(targetX - x) > 5) return targetX;
      return x + (stg ? stg : 15) * (Math.sign(dx) || 1);
    };
    const getShiftY = (y, targetY, stg) => {
      if (Math.abs(targetY - y) > 5) return targetY;
      return y + (stg ? stg : 15) * (Math.sign(dy) || 1);
    };

    if (horizontalFirst) {
      let midX = typeof offset.bundleMidX === 'number'
        ? offset.bundleMidX + laneOffset
        : Math.round(((e1.x + e2.x) / 2) / 15) * 15 + laneOffset;

      let p1Points = [];
      let currentY1;
      if (!e1StubHoriz) {
        const dirY1 = e1.dir ? (e1.dir === 'top' ? -1 : 1) : (Math.sign(e1.y - p1.y) || 1);
        const turnY1 = e1.y + dirY1 * Math.abs(stagger);
        currentY1 = turnY1;
        p1Points = [p1, { x: p1.x, y: turnY1 }];
        midX = getShiftX(p1.x, midX, stagger);
      } else {
        const dirX1 = e1.dir ? (e1.dir === 'left' ? -1 : 1) : (Math.sign(e1.x - p1.x) || 1);
        const turnX1 = e1.x + dirX1 * Math.abs(stagger);
        if (Math.sign(midX - turnX1) === -dirX1) {
          currentY1 = getShiftY(p1.y, e2.y, stagger);
          p1Points = [p1, { x: turnX1, y: p1.y }, { x: turnX1, y: currentY1 }];
        } else {
          currentY1 = p1.y;
          p1Points = [p1, { x: turnX1, y: p1.y }];
        }
      }

      let p2Points = [];
      let currentY2;
      if (e2StubHoriz) {
        const dirX2 = e2.dir ? (e2.dir === 'left' ? -1 : 1) : (Math.sign(e2.x - p2.x) || 1);
        const turnX2 = e2.x + dirX2 * Math.abs(stagger2);
        if (Math.sign(midX - turnX2) === -dirX2) {
          currentY2 = getShiftY(p2.y, currentY1, stagger2);
          p2Points = [{ x: turnX2, y: currentY2 }, { x: turnX2, y: p2.y }, p2];
        } else {
          currentY2 = p2.y;
          p2Points = [{ x: turnX2, y: p2.y }, p2];
        }
      } else {
        const dirY2 = e2.dir ? (e2.dir === 'top' ? -1 : 1) : (e2.y < p2.y ? -1 : 1);
        const turnY2 = e2.y + dirY2 * Math.abs(stagger2);

        let canOptimize = false;
        if (dirY2 === -1 && currentY1 <= e2.y) canOptimize = true;
        if (dirY2 === 1 && currentY1 >= e2.y) canOptimize = true;

        currentY2 = canOptimize ? currentY1 : turnY2;
        p2Points = [{ x: p2.x, y: currentY2 }, p2];
        midX = getShiftX(p2.x, midX, stagger2);
      }

      route = [...p1Points, { x: midX, y: currentY1 }, { x: midX, y: currentY2 }, ...p2Points];
    } else {
      // verticalFirst
      let midY = typeof offset.bundleMidY === 'number'
        ? offset.bundleMidY + laneOffset
        : Math.round(((e1.y + e2.y) / 2) / 15) * 15 + laneOffset;

      let p1Points = [];
      let currentX1;
      if (!e1StubHoriz) {
        const dirY1 = e1.dir ? (e1.dir === 'top' ? -1 : 1) : (Math.sign(e1.y - p1.y) || 1);
        const turnY1 = e1.y + dirY1 * Math.abs(stagger);
        if (Math.sign(midY - turnY1) === -dirY1) {
          currentX1 = getShiftX(p1.x, e2.x, stagger);
          p1Points = [p1, { x: p1.x, y: turnY1 }, { x: currentX1, y: turnY1 }];
        } else {
          currentX1 = p1.x;
          p1Points = [p1, { x: p1.x, y: turnY1 }];
        }
      } else {
        const dirX1 = e1.dir ? (e1.dir === 'left' ? -1 : 1) : (Math.sign(e1.x - p1.x) || 1);
        const turnX1 = e1.x + dirX1 * Math.abs(stagger);
        currentX1 = turnX1;
        p1Points = [p1, { x: turnX1, y: p1.y }];
        midY = getShiftY(p1.y, midY, stagger);
      }

      let p2Points = [];
      let currentX2;
      if (!e2StubHoriz) {
        const dirY2 = e2.dir ? (e2.dir === 'top' ? -1 : 1) : (Math.sign(e2.y - p2.y) || 1);
        const turnY2 = e2.y + dirY2 * Math.abs(stagger2);
        if (Math.sign(midY - turnY2) === -dirY2) {
          currentX2 = getShiftX(p2.x, currentX1, stagger2);
          p2Points = [{ x: currentX2, y: turnY2 }, { x: p2.x, y: turnY2 }, p2];
        } else {
          currentX2 = p2.x;
          p2Points = [{ x: p2.x, y: turnY2 }, p2];
        }
      } else {
        const dirX2 = e2.dir ? (e2.dir === 'left' ? -1 : 1) : (e2.x < p2.x ? -1 : 1);
        const turnX2 = e2.x + dirX2 * Math.abs(stagger2);

        let canOptimize = false;
        if (dirX2 === -1 && currentX1 <= e2.x) canOptimize = true;
        if (dirX2 === 1 && currentX1 >= e2.x) canOptimize = true;

        currentX2 = canOptimize ? currentX1 : turnX2;
        p2Points = [{ x: currentX2, y: p2.y }, p2];
        midY = getShiftY(p2.y, midY, stagger2);
      }

      route = [...p1Points, { x: currentX1, y: midY }, { x: currentX2, y: midY }, ...p2Points];
    }
    // === END: EXIT SIDE ROUTING ===
  }

  return dedupePoints(route);
}

function segmentsFromPoints(points, wireId) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (Math.abs(a.x - b.x) < 0.1 && Math.abs(a.y - b.y) < 0.1) continue;
    const vertical = Math.abs(a.x - b.x) < Math.abs(a.y - b.y);
    segments.push({
      wireId,
      vertical,
      start: { x: a.x, y: a.y },
      end: { x: b.x, y: b.y },
      centerLine: vertical ? a.x : a.y,
    });
  }
  return segments;
}

function overlapRange(seg) {
  if (seg.vertical) {
    return [Math.min(seg.start.y, seg.end.y), Math.max(seg.start.y, seg.end.y)];
  }
  return [Math.min(seg.start.x, seg.end.x), Math.max(seg.start.x, seg.end.x)];
}

function segmentsOverlap(a, b) {
  if (a.vertical !== b.vertical) return false;
  if (Math.abs(a.centerLine - b.centerLine) > OVERLAP_TOLERANCE) return false;
  const [a0, a1] = overlapRange(a);
  const [b0, b1] = overlapRange(b);
  return !(a1 < b0 || b1 < a0);
}

export function calculateWireBundleOffsets(wires, resolveWirePoints, respectExitSide = true) {
  const offsets = new Map();
  for (const wire of wires || []) {
    if (wire?.id != null) offsets.set(wire.id, { offset: 0, stagger: 0 });
  }

  const allResolved = [];
  for (const wire of wires || []) {
    const r = resolveWirePoints ? resolveWirePoints(wire) : null;
    if (!r || !r.p1 || !r.e1 || !r.e2 || !r.p2) continue;

    // Determine exit direction for e1
    let e1Dir = r.e1.dir;
    if (!e1Dir) {
      if (Math.abs(r.e1.y - r.p1.y) >= Math.abs(r.e1.x - r.p1.x)) {
        e1Dir = r.e1.y < r.p1.y ? 'top' : 'bottom';
      } else {
        e1Dir = r.e1.x < r.p1.x ? 'left' : 'right';
      }
    }

    // Determine exit direction for e2 (destination approach direction)
    let e2Dir = r.e2.dir;
    if (!e2Dir) {
      if (Math.abs(r.e2.y - r.p2.y) >= Math.abs(r.e2.x - r.p2.x)) {
        e2Dir = r.e2.y < r.p2.y ? 'top' : 'bottom';
      } else {
        e2Dir = r.e2.x < r.p2.x ? 'left' : 'right';
      }
    }

    const [srcCompId] = (wire.from || '').split(':');
    const [dstCompId] = (wire.to || '').split(':');

    allResolved.push({
      wire,
      p1: r.p1,
      e1: r.e1,
      e2: r.e2,
      p2: r.p2,
      srcCompId,
      dstCompId,
      e1Dir,
      e2Dir
    });
  }

  // Phase 1 & 2: Unified Component Edge Clearance with Global Collision Detection
  // Collect ALL connection points (both e1 and e2) and group them purely by the physical component edge.
  const edgeGroups = new Map();
  for (const r of allResolved) {
    const k1 = `${r.srcCompId}::${r.e1Dir}`;
    if (!edgeGroups.has(k1)) edgeGroups.set(k1, []);
    edgeGroups.get(k1).push({ wireId: r.wire.id, p: r.p1, isSrc: true });

    const k2 = `${r.dstCompId}::${r.e2Dir}`;
    if (!edgeGroups.has(k2)) edgeGroups.set(k2, []);
    edgeGroups.get(k2).push({ wireId: r.wire.id, p: r.p2, isSrc: false });
  }

  const usedY = new Map();
  const usedX = new Map();

  for (const [key, group] of edgeGroups.entries()) {
    if (group.length === 0) continue;

    const [, dirStr] = key.split('::');
    const isHorizontalEdge = dirStr === 'top' || dirStr === 'bottom';
    const dirSign = (dirStr === 'top' || dirStr === 'left') ? -1 : 1;

    if (isHorizontalEdge) {
      group.sort((a, b) => a.p.x - b.p.x);
    } else {
      group.sort((a, b) => a.p.y - b.p.y);
    }

    let baseStaggerIndex = 1;
    group.forEach((entry) => {
      const cur = offsets.get(entry.wireId) || { offset: 0, stagger: 0, stagger2: 0 };

      let proposedStagger;
      if (isHorizontalEdge) {
        let proposedY;
        do {
          proposedStagger = baseStaggerIndex * STAGGER_STEP;
          proposedY = entry.p.y + dirSign * proposedStagger;
          // Only bump if the line is taken by a DIFFERENT wire
          if (usedY.has(proposedY) && usedY.get(proposedY) !== entry.wireId) {
            baseStaggerIndex++;
          } else {
            break;
          }
        } while (true);
        usedY.set(proposedY, entry.wireId);
        baseStaggerIndex++; // Increment for the next pin in this group
      } else {
        let proposedX;
        do {
          proposedStagger = baseStaggerIndex * STAGGER_STEP;
          proposedX = entry.p.x + dirSign * proposedStagger;
          if (usedX.has(proposedX) && usedX.get(proposedX) !== entry.wireId) {
            baseStaggerIndex++;
          } else {
            break;
          }
        } while (true);
        usedX.set(proposedX, entry.wireId);
        baseStaggerIndex++;
      }

      if (entry.isSrc) {
        cur.stagger = proposedStagger;
      } else {
        cur.stagger2 = proposedStagger;
      }
      offsets.set(entry.wireId, cur);
    });
  }

  // Phase 3: Unified Bus Grouping by Congested Component Edge
  // Count connections for each component edge
  const edgeCounts = new Map();
  for (const r of allResolved) {
    const k1 = `${r.srcCompId}::${r.e1Dir}`;
    edgeCounts.set(k1, (edgeCounts.get(k1) || 0) + 1);

    const k2 = `${r.dstCompId}::${r.e2Dir}`;
    edgeCounts.set(k2, (edgeCounts.get(k2) || 0) + 1);
  }

  // Group wires by their primary (most congested) component edge
  const busGroups = new Map();
  for (const r of allResolved) {
    const k1 = `${r.srcCompId}::${r.e1Dir}`;
    const k2 = `${r.dstCompId}::${r.e2Dir}`;
    const count1 = edgeCounts.get(k1) || 0;
    const count2 = edgeCounts.get(k2) || 0;

    let primaryKey;
    if (count1 > count2) {
      primaryKey = k1;
    } else if (count2 > count1) {
      primaryKey = k2;
    } else {
      primaryKey = k1 < k2 ? k1 : k2; // Deterministic tie-breaker
    }

    if (!busGroups.has(primaryKey)) busGroups.set(primaryKey, []);
    busGroups.get(primaryKey).push(r);
  }

  for (const [primaryKey, group] of busGroups.entries()) {
    const [compA, edgeA] = primaryKey.split('::');
    const isHorizontalEdge = edgeA === 'top' || edgeA === 'bottom';
    const count = group.length;

    // Sort and determine flow direction relative to the primary edge on compA
    if (isHorizontalEdge) {
      // Sort wires horizontally by their pin X coordinate on compA
      group.sort((a, b) => {
        const pinA = a.srcCompId === compA ? a.p1.x : a.p2.x;
        const pinB = b.srcCompId === compA ? b.p1.x : b.p2.x;
        return pinA - pinB;
      });

      // Flow direction check: if other end is to the right of primary edge, reverse
      const avgPrimaryX = group.reduce((sum, r) => sum + (r.srcCompId === compA ? r.p1.x : r.p2.x), 0) / count;
      const avgOtherX = group.reduce((sum, r) => sum + (r.srcCompId === compA ? r.p2.x : r.p1.x), 0) / count;
      if (avgPrimaryX < avgOtherX) {
        group.reverse();
      }
    } else {
      // Sort wires vertically by their pin Y coordinate on compA
      group.sort((a, b) => {
        const pinA = a.srcCompId === compA ? a.p1.y : a.p2.y;
        const pinB = b.srcCompId === compA ? b.p1.y : b.p2.y;
        return pinA - pinB;
      });

      // Flow direction check: if other end is below primary edge, reverse
      const avgPrimaryY = group.reduce((sum, r) => sum + (r.srcCompId === compA ? r.p1.y : r.p2.y), 0) / count;
      const avgOtherY = group.reduce((sum, r) => sum + (r.srcCompId === compA ? r.p2.y : r.p1.y), 0) / count;
      if (avgPrimaryY < avgOtherY) {
        group.reverse();
      }
    }

    // Calculate proposed midpoints
    let sumE1X = 0, sumE1Y = 0, sumE2X = 0, sumE2Y = 0;
    group.forEach(r => {
      sumE1X += r.e1.x; sumE1Y += r.e1.y;
      sumE2X += r.e2.x; sumE2Y += r.e2.y;
    });
    const avgE1X = sumE1X / count;
    const avgE2X = sumE2X / count;
    const proposedMidX = Math.round(((avgE1X + avgE2X) / 2) / 15) * 15;

    const avgE1Y = sumE1Y / count;
    const avgE2Y = sumE2Y / count;
    const proposedMidY = Math.round(((avgE1Y + avgE2Y) / 2) / 15) * 15;

    const avgPinX = group.reduce((sum, r) => sum + (r.srcCompId === compA ? r.p1.x : r.p2.x), 0) / count;
    const avgPinY = group.reduce((sum, r) => sum + (r.srcCompId === compA ? r.p1.y : r.p2.y), 0) / count;

    // Determine if the trunk is above/left or below/right of the pins to set offset multiplier sign
    const sign = isHorizontalEdge
      ? (Math.sign(proposedMidY - avgPinY) || 1)
      : (Math.sign(proposedMidX - avgPinX) || 1);

    group.forEach((r, index) => {
      const cur = offsets.get(r.wire.id) || { offset: 0, stagger: 0, stagger2: 0 };
      cur.offset = (index - Math.floor(count / 2)) * WIRE_SPACING * sign;
      cur.bundleMidX = proposedMidX;
      cur.bundleMidY = proposedMidY;
      cur.e1Dir = r.e1Dir;
      cur.e2Dir = r.e2Dir;
      offsets.set(r.wire.id, cur);
    });
  }

  // Calculate base routes for all wires
  const allRoutes = new Map();
  for (const r of allResolved) {
    const cur = offsets.get(r.wire.id);
    const pts = buildBaseRoutePoints(r.p1, r.e1, r.e2, r.p2, r.wire.waypoints, cur, respectExitSide);
    allRoutes.set(r.wire.id, pts);
  }

  // Apply micro-shifts
  const finalRoutes = applyMicroShifts(allRoutes, respectExitSide);

  // Attach final points to offsets
  for (const [wireId, cur] of offsets.entries()) {
    if (finalRoutes.has(wireId)) {
      cur.points = finalRoutes.get(wireId);
    }
  }

  return offsets;
}

function applyMicroShifts(allRoutes, respectExitSide = true) {
  const segments = [];
  for (const [wireId, points] of allRoutes.entries()) {
    segments.push(...segmentsFromPoints(points, wireId));
  }

  const linesX = new Map(); // centerLine -> array of vertical segments
  const linesY = new Map(); // centerLine -> array of horizontal segments

  for (const seg of segments) {
    const map = seg.vertical ? linesX : linesY;
    let foundKey = null;
    for (const key of map.keys()) {
      if (Math.abs(key - seg.centerLine) < 0.1) {
        foundKey = key; break;
      }
    }
    if (foundKey === null) {
      foundKey = seg.centerLine;
      map.set(foundKey, []);
    }
    map.get(foundKey).push(seg);
  }

  const occupiedLanes = [];
  for (const seg of segments) {
    const [s, e] = overlapRange(seg);
    occupiedLanes.push({ wireId: seg.wireId, vertical: seg.vertical, centerLine: seg.centerLine, start: s, end: e });
  }

  const shiftMap = new Map(); // wireId -> array of shifts

  const isLaneEmpty = (isVertical, centerLine, start, end, ignoreWireId) => {
    for (const lane of occupiedLanes) {
      if (lane.wireId === ignoreWireId) continue;
      if (lane.vertical !== isVertical) continue;
      if (Math.abs(lane.centerLine - centerLine) < 0.1) {
        if (Math.max(start, lane.start) < Math.min(end, lane.end)) {
          return false;
        }
      }
    }
    return true;
  };

  const processLines = (map, isVertical) => {
    for (const [centerLine, segs] of map.entries()) {
      if (segs.length <= 1) continue;

      const points = new Set();
      for (const seg of segs) {
        const [s, e] = overlapRange(seg);
        points.add(s);
        points.add(e);
      }
      const sortedPoints = Array.from(points).sort((a, b) => a - b);

      for (let i = 0; i < sortedPoints.length - 1; i++) {
        const start = sortedPoints[i];
        const end = sortedPoints[i + 1];
        if (Math.abs(end - start) < 0.1) continue;

        const mid = (start + end) / 2;

        const activeSegs = segs.filter(seg => {
          const [s, e] = overlapRange(seg);
          return s < mid && e > mid;
        });

        if (activeSegs.length > 1) {
          // Sort active segments so the longest wires get processed first
          activeSegs.sort((a, b) => {
            const lenA = Math.abs(a.end.x - a.start.x) + Math.abs(a.end.y - a.start.y);
            const lenB = Math.abs(b.end.x - b.start.x) + Math.abs(b.end.y - b.start.y);
            return lenB - lenA;
          });

          activeSegs.forEach((seg, index) => {
            if (index === 0) return; // The longest wire gets offset 0
            
            const step = respectExitSide ? 2.5 : 5;
            
            let offset = 0;
            let iteration = 1;
            while (true) {
              const mag = Math.ceil(iteration / 2) * step;
              const sign = iteration % 2 === 0 ? -1 : 1;
              const testOffset = mag * sign;
              
              if (isLaneEmpty(isVertical, centerLine + testOffset, start, end, seg.wireId)) {
                offset = testOffset;
                break;
              }
              iteration++;
              if (iteration > 20) { // Safety fallback
                offset = Math.ceil(index / 2) * step * (index % 2 === 0 ? -1 : 1);
                break;
              }
            }

            occupiedLanes.push({ wireId: seg.wireId, vertical: isVertical, centerLine: centerLine + offset, start: start, end: end });

            if (!shiftMap.has(seg.wireId)) shiftMap.set(seg.wireId, []);
            shiftMap.get(seg.wireId).push({
              vertical: isVertical,
              centerLine: centerLine,
              start: start,
              end: end,
              offset: offset
            });
          });
        }
      }
    }
  };

  processLines(linesX, true);
  processLines(linesY, false);

  // Merge adjacent shifts with the same offset
  for (const [wireId, shifts] of shiftMap.entries()) {
    shifts.sort((a, b) => {
      if (a.vertical !== b.vertical) return a.vertical ? 1 : -1;
      if (Math.abs(a.centerLine - b.centerLine) > 0.1) return a.centerLine - b.centerLine;
      return a.start - b.start;
    });

    const merged = [];
    for (const s of shifts) {
      if (merged.length === 0) {
        merged.push(s);
        continue;
      }
      const last = merged[merged.length - 1];
      if (last.vertical === s.vertical &&
        Math.abs(last.centerLine - s.centerLine) < 0.1 &&
        Math.abs(last.offset - s.offset) < 0.1 &&
        Math.abs(last.end - s.start) < 0.1) {
        last.end = s.end; // Merge!
      } else {
        merged.push(s);
      }
    }
    shiftMap.set(wireId, merged);
  }

  const finalRoutes = new Map();
  for (const [wireId, points] of allRoutes.entries()) {
    const shifts = shiftMap.get(wireId) || [];
    if (shifts.length === 0) {
      finalRoutes.set(wireId, points);
      continue;
    }

    let currentPts = [...points];
    for (const shift of shifts) {
      let newPts = [];
      for (let i = 0; i < currentPts.length - 1; i++) {
        const a = currentPts[i];
        const b = currentPts[i + 1];
        newPts.push(a);

        const isVert = Math.abs(a.x - b.x) < Math.abs(a.y - b.y);
        if (isVert !== shift.vertical) continue;

        const cl = isVert ? a.x : a.y;
        if (Math.abs(cl - shift.centerLine) > 0.1) continue;

        const [s, e] = isVert ? [Math.min(a.y, b.y), Math.max(a.y, b.y)] : [Math.min(a.x, b.x), Math.max(a.x, b.x)];

        if (s <= shift.start + 0.1 && e >= shift.end - 0.1) {
          let s1 = { x: a.x, y: a.y };
          let s2 = { x: b.x, y: b.y };

          if (isVert) {
            s1.y = shift.start;
            s2.y = shift.end;
            if (a.y > b.y) {
              s1.y = shift.end;
              s2.y = shift.start;
            }

            if (Math.abs(a.y - s1.y) > 0.1) newPts.push({ x: a.x, y: s1.y });
            newPts.push({ x: a.x + shift.offset, y: s1.y });
            newPts.push({ x: a.x + shift.offset, y: s2.y });
            if (Math.abs(b.y - s2.y) > 0.1) newPts.push({ x: a.x, y: s2.y });
          } else {
            s1.x = shift.start;
            s2.x = shift.end;
            if (a.x > b.x) {
              s1.x = shift.end;
              s2.x = shift.start;
            }

            if (Math.abs(a.x - s1.x) > 0.1) newPts.push({ x: s1.x, y: a.y });
            newPts.push({ x: s1.x, y: a.y + shift.offset });
            newPts.push({ x: s2.x, y: a.y + shift.offset });
            if (Math.abs(b.x - s2.x) > 0.1) newPts.push({ x: s2.x, y: a.y });
          }
        }
      }
      newPts.push(currentPts[currentPts.length - 1]);
      currentPts = dedupePoints(newPts);
    }
    finalRoutes.set(wireId, simplifyCollinear(currentPts));
  }
  return finalRoutes;
}

function simplifyCollinear(points) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    if (i < 2) {
      out.push(points[i]);
      continue;
    }
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    const c = points[i];

    const isCollinearX = Math.abs(a.x - b.x) < 0.1 && Math.abs(b.x - c.x) < 0.1;
    const isCollinearY = Math.abs(a.y - b.y) < 0.1 && Math.abs(b.y - c.y) < 0.1;

    if (isCollinearX || isCollinearY) {
      out[out.length - 1] = c; // Merge collinear points
    } else {
      out.push(c);
    }
  }
  return out;
}

export function buildWireRoutePoints(p1, e1, e2, p2, waypoints = [], offset = 0) {
  if (offset && offset.points) return offset.points;
  return buildBaseRoutePoints(p1, e1, e2, p2, waypoints, offset);
}
