/**
 * Orthogonal path simplification logic to remove redundant segments
 */
export function simplifyOrthogonalPath(points) {
  if (points.length <= 2) return points;

  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Check if points are collinear (on the same vertical or horizontal line)
    const isHorizontal = Math.abs(prev.y - curr.y) < 0.1 && Math.abs(curr.y - next.y) < 0.1;
    const isVertical = Math.abs(prev.x - curr.x) < 0.1 && Math.abs(curr.x - next.x) < 0.1;
    const isDuplicate = Math.abs(prev.x - curr.x) < 0.1 && Math.abs(prev.y - curr.y) < 0.1;

    if (!isHorizontal && !isVertical && !isDuplicate) {
      result.push(curr);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Detect if a point (mx, my) is near a wire segment or waypoint
 */
export function getWireInteraction(mx, my, points, threshold = 8) {
  // 1. Check Waypoints
  for (let i = 1; i < points.length - 1; i++) {
    const wp = points[i];
    const dist = Math.hypot(mx - wp.x, my - wp.y);
    if (dist < threshold) {
      return { type: 'waypoint', index: i };
    }
  }

  // 2. Check Segments
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dist = distToSegment(mx, my, p1, p2);
    if (dist < threshold) {
      const isHoriz = Math.abs(p1.y - p2.y) < 1;
      return { type: 'segment', index: i, isHoriz };
    }
  }

  return null;
}

function distToSegment(px, py, p1, p2) {
  const l2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
  if (l2 === 0) return Math.hypot(px - p1.x, py - p1.y);
  let t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (p1.x + t * (p2.x - p1.x)), py - (p1.y + t * (p2.y - p1.y)));
}
