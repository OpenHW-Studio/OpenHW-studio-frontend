// Lightweight Manhattan A* router for orthogonal wiring
// Note: small, dependency-free implementation. Meant to be conservative and
// fallback to existing heuristics when a path can't be found.

function rectsToBlockedCells(obstacles, cellSize, clearance, bounds) {
  const blocked = new Set();
  for (const r of obstacles) {
    const x0 = Math.floor((r.x - clearance - bounds.minX) / cellSize);
    const y0 = Math.floor((r.y - clearance - bounds.minY) / cellSize);
    const x1 = Math.floor((r.x + r.w + clearance - bounds.minX) / cellSize);
    const y1 = Math.floor((r.y + r.h + clearance - bounds.minY) / cellSize);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) blocked.add(`${x},${y}`);
  }
  return blocked;
}

function buildBoundsFor(start, end, obstacles, padding = 48) {
  let minX = Math.min(start.x, end.x), minY = Math.min(start.y, end.y);
  let maxX = Math.max(start.x, end.x), maxY = Math.max(start.y, end.y);
  for (const r of obstacles) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { minX: Math.floor(minX - padding), minY: Math.floor(minY - padding), maxX: Math.ceil(maxX + padding), maxY: Math.ceil(maxY + padding) };
}

function reconstruct(node) {
  const pts = [];
  let cur = node;
  while (cur) {
    pts.push({ x: cur.x, y: cur.y });
    cur = cur.parent;
  }
  pts.reverse();
  // simplify collinear
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (i < 2) { out.push(pts[i]); continue; }
    const a = out[out.length - 2], b = out[out.length - 1], c = pts[i];
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
      out[out.length - 1] = c; // merge collinear
    } else out.push(c);
  }
  return out;
}

export function findPath(start, end, opts = {}) {
  const cellSize = opts.cellSize || 24;
  const clearance = typeof opts.clearance === 'number' ? opts.clearance : 8;
  const obstacles = opts.obstacles || [];
  const maxNodes = opts.maxNodes || 30000;

  const bounds = buildBoundsFor(start, end, obstacles);
  const minX = bounds.minX, minY = bounds.minY;
  const cols = Math.max(3, Math.ceil((bounds.maxX - minX) / cellSize));
  const rows = Math.max(3, Math.ceil((bounds.maxY - minY) / cellSize));

  const blocked = rectsToBlockedCells(obstacles, cellSize, clearance, bounds);

  const sX = Math.round((start.x - minX) / cellSize);
  const sY = Math.round((start.y - minY) / cellSize);
  const eX = Math.round((end.x - minX) / cellSize);
  const eY = Math.round((end.y - minY) / cellSize);

  const key = (x, y) => `${x},${y}`;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;

  const open = new Map();
  const closed = new Set();
  function pushNode(x, y, g, h, parent, dir) {
    const k = key(x, y);
    const f = g + h;
    const existing = open.get(k);
    if (existing && existing.f <= f) return;
    open.set(k, { x: x * cellSize + minX + cellSize / 2, y: y * cellSize + minY + cellSize / 2, gx: x, gy: y, g, h, f, parent, dir });
  }

  const startH = Math.abs(sX - eX) + Math.abs(sY - eY);
  pushNode(sX, sY, 0, startH, null, null);

  let nodes = 0;
  while (open.size > 0) {
    // pick lowest f
    let bestK = null, bestF = Infinity;
    for (const [k, v] of open) {
      if (v.f < bestF) { bestF = v.f; bestK = k; }
    }
    const current = open.get(bestK);
    open.delete(bestK);
    nodes++;
    if (nodes > maxNodes) return null;

    const cx = current.gx, cy = current.gy;
    if (cx === eX && cy === eY) {
      return reconstruct(current);
    }

    closed.add(bestK);

    const neigh = [[1,0],[0,1],[-1,0],[0,-1]];
    for (const [dx,dy] of neigh) {
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      if (blocked.has(nk)) continue;
      const g = current.g + 1 + (current.dir && current.dir !== (dx+'_'+dy) ? 0.5 : 0);
      const h = Math.abs(nx - eX) + Math.abs(ny - eY);
      pushNode(nx, ny, g, h, current, dx+'_'+dy);
    }
  }

  return null;
}

export function buildObstaclesFromComponents(components, opts = {}) {
  const out = [];
  const pad = opts.pad || 0;
  for (const c of components) {
    out.push({ x: c.x - pad, y: c.y - pad, w: (c.w || 40) + pad * 2, h: (c.h || 40) + pad * 2 });
  }
  return out;
}

export default { findPath, buildObstaclesFromComponents };
