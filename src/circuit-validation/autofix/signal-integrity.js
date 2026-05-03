/**
 * Lightweight Signal Integrity Helpers for Phase 4 enhancements
 * Provides simple heuristics to detect high-speed nets and recommend fixes.
 */

function endpointCompId(endpoint) {
  return String(endpoint || '').split('.')[0] || '';
}

function endpointPinName(endpoint) {
  return String(endpoint || '').split('.').slice(1).join('.') || '';
}

function endpointPoint(endpoint, byId) {
  const compId = endpointCompId(endpoint);
  const comp = byId.get(compId);
  if (!comp) return null;
  const x = Number(comp.x);
  const y = Number(comp.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function estimateSegmentLength(fromPt, toPt) {
  if (!fromPt || !toPt) return null;
  const dx = toPt.x - fromPt.x;
  const dy = toPt.y - fromPt.y;
  return Math.sqrt((dx * dx) + (dy * dy));
}

function normalizedNetKey(endpoint) {
  const pin = endpointPinName(endpoint).toUpperCase();
  return pin || String(endpoint || '').toUpperCase();
}

function diffBase(pinName) {
  const p = String(pinName || '').toUpperCase();
  if (!p) return null;
  const patterns = [
    [/(_P|\+|DP|TXP|RXP)$/, 'P'],
    [/(_N|-|DM|TXN|RXN)$/, 'N'],
  ];
  for (const [re, side] of patterns) {
    if (re.test(p)) {
      return { base: p.replace(re, ''), side };
    }
  }
  return null;
}

export function estimateNetLength(components = [], connections = [], netName = null) {
  const byId = new Map((components || []).map((c) => [String(c.id || ''), c]));
  let totalLength = 0;
  let segments = 0;
  const unknownSegments = [];

  (connections || []).forEach((c) => {
    const from = String(c.from || '');
    const to = String(c.to || '');
    if (netName) {
      const key = String(netName || '').toUpperCase();
      const inNet = normalizedNetKey(from).includes(key) || normalizedNetKey(to).includes(key);
      if (!inNet) return;
    }

    const p1 = endpointPoint(from, byId);
    const p2 = endpointPoint(to, byId);
    const len = estimateSegmentLength(p1, p2);
    if (Number.isFinite(len)) {
      totalLength += len;
      segments += 1;
    } else {
      unknownSegments.push({ from, to });
    }
  });

  return {
    net: netName || 'ALL',
    estimatedLength: Number(totalLength.toFixed(2)),
    segments,
    unknownSegmentCount: unknownSegments.length,
    unknownSegments,
  };
}

export function findDifferentialPairs(connections = []) {
  const grouped = new Map();

  (connections || []).forEach((c) => {
    const from = String(c.from || '');
    const to = String(c.to || '');
    const endpoints = [from, to];
    for (const ep of endpoints) {
      const pin = endpointPinName(ep);
      const parsed = diffBase(pin);
      if (!parsed) continue;
      const key = `${endpointCompId(ep)}:${parsed.base}`;
      if (!grouped.has(key)) grouped.set(key, { base: parsed.base, p: [], n: [] });
      grouped.get(key)[parsed.side.toLowerCase()].push({ endpoint: ep, connection: c });
    }
  });

  const pairs = [];
  for (const [key, value] of grouped.entries()) {
    if (value.p.length === 0 || value.n.length === 0) continue;
    pairs.push({
      key,
      base: value.base,
      positive: value.p,
      negative: value.n,
    });
  }
  return pairs;
}

export function flagDifferentialPairMismatches(components = [], connections = [], toleranceRatio = 0.15) {
  const pairs = findDifferentialPairs(connections);
  const issues = [];

  for (const pair of pairs) {
    const pEndpoints = pair.positive.map((p) => p.endpoint);
    const nEndpoints = pair.negative.map((n) => n.endpoint);

    const pLen = estimateNetLength(components, connections, endpointPinName(pEndpoints[0])).estimatedLength;
    const nLen = estimateNetLength(components, connections, endpointPinName(nEndpoints[0])).estimatedLength;
    const maxLen = Math.max(pLen, nLen, 1);
    const delta = Math.abs(pLen - nLen);
    const ratio = delta / maxLen;

    if (ratio > toleranceRatio) {
      issues.push({
        pair: pair.key,
        positiveLength: pLen,
        negativeLength: nLen,
        mismatchRatio: Number(ratio.toFixed(3)),
        recommendation: 'Match differential pair lengths and route in parallel with controlled spacing.',
      });
    }
  }

  return issues;
}

export function detectHighSpeedNets(components, connections) {
  // Heuristic: nets with many connections or known high-speed components
  const netCount = Object.create(null);
  connections.forEach((c) => {
    const from = String(c.from || '');
    const to = String(c.to || '');
    netCount[from] = (netCount[from] || 0) + 1;
    netCount[to] = (netCount[to] || 0) + 1;
  });

  const candidateNets = Object.entries(netCount)
    .filter(([, cnt]) => cnt >= 3) // threshold
    .map(([net]) => net);

  // Also detect nets connected to components that often require SI (e.g., oscillator, USB, SPI)
  const siNets = new Set(candidateNets);
  components.forEach((comp) => {
    const t = String(comp.type || '').toLowerCase();
    if (/oscillator|usb|spi|i2s|sdram|mcu|fpga/.test(t)) {
      // assume pins named like MCU:PA0 etc — add all connections referencing comp.id
      connections.forEach((c) => {
        if (String(c.from || '').startsWith(`${comp.id}.`) || String(c.to || '').startsWith(`${comp.id}.`)) {
          siNets.add(String(c.from || ''));
          siNets.add(String(c.to || ''));
        }
      });
    }
  });

  // Length-based heuristic: long traces are SI-sensitive at moderate/high edge rates
  const lengthSummary = estimateNetLength(components, connections);
  if (lengthSummary.estimatedLength > 200) {
    connections.forEach((c) => {
      siNets.add(String(c.from || ''));
      siNets.add(String(c.to || ''));
    });
  }

  // Differential pairs should be treated as SI-sensitive by default.
  const diffPairs = findDifferentialPairs(connections);
  diffPairs.forEach((pair) => {
    pair.positive.forEach((p) => siNets.add(p.endpoint));
    pair.negative.forEach((n) => siNets.add(n.endpoint));
  });

  return Array.from(siNets).filter(Boolean);
}

export function recommendSeriesTermination(netName) {
  return {
    type: 'series_termination',
    net: netName,
    suggestion: 'Add series termination resistor (22Ω-100Ω) near source to reduce ringing',
    confidence: 0.7,
  };
}

export function recommendTwistedPair(netName) {
  return {
    type: 'twisted_pair',
    net: netName,
    suggestion: 'For balanced differential signals, route as twisted pair and keep length matched',
    confidence: 0.65,
  };
}
